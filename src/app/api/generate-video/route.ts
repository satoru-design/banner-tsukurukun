/**
 * POST /api/generate-video
 *  Phase B.1 動画生成ジョブを起動して即座に videoId を返す。
 *  実際の生成は /api/cron/process-video-jobs が拾って非同期実行する。
 *
 * Vibe Coding 六条:
 *  1. セキュリティ: auth() 必須、generationId は session.userId のもののみ受理
 *  2. コスト: ユーザープランに基づき provider を制限、料金事前見積もり
 *  3. 法規: 入力画像 URL のドメイン検証 (自社 Blob のみ受理)
 *  4. データ不可逆性: status='pending' で作成、失敗時は status='failed'
 *  5. 性能: maxDuration=30 (ジョブ起動だけ)
 *  6. 検証: provider 一覧と allowedDurations を SDK 側でバリデート
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import {
  getVideoProvider,
  VideoProviderId,
  VideoAspectRatio,
  VideoDurationSeconds,
} from '@/lib/video-providers';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface PostBody {
  generationId?: string;
  inputImageUrl?: string;
  promptJa?: string;
  promptEn?: string;
  format?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  provider?: string;
  generateAudio?: boolean;
}

const VALID_PROVIDERS: VideoProviderId[] = [
  'veo-3.1-fast',
  'veo-3.1-lite',
  'kling-2.1-standard',
  'kling-2.1-pro',
  'kling-2.1-master',
];
const VALID_ASPECT: VideoAspectRatio[] = ['9:16', '16:9', '1:1'];

/** 1 ユーザーあたりの未処理 (pending/processing) 動画ジョブの上限。 */
const MAX_IN_FLIGHT_VIDEOS_PER_USER = 5;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 動画化は admin 限定 β。/api/queue-cogen-videos と /api/suggest-video-prompt は
    // 既に admin gate を持つが、ジョブを直接キューに積むこの route だけ抜けていた。
    // Veo / Kling は 1 本あたり実費が出るため、同じ線に揃える。
    if (session.user.plan !== 'admin') {
      return NextResponse.json(
        { error: '動画化は現在 admin 限定 (β)' },
        { status: 403 },
      );
    }

    // 未処理ジョブの本数に上限を設ける。上限が無いと 1 ユーザーが
    // pending を積み放題で、毎分動くワーカーが順次 provider に投げ続ける。
    const prismaForQuota = getPrisma();
    const inFlight = await prismaForQuota.generationVideo.count({
      where: {
        status: { in: ['pending', 'processing'] },
        generation: { userId: session.user.id },
      },
    });
    if (inFlight >= MAX_IN_FLIGHT_VIDEOS_PER_USER) {
      return NextResponse.json(
        {
          error: `未処理の動画ジョブが ${MAX_IN_FLIGHT_VIDEOS_PER_USER} 件あります。完了までお待ちください。`,
          inFlight,
          limit: MAX_IN_FLIGHT_VIDEOS_PER_USER,
        },
        { status: 429 },
      );
    }

    const body = (await req.json()) as PostBody;

    const generationId = String(body.generationId ?? '');
    if (!generationId) {
      return NextResponse.json({ error: 'generationId is required' }, { status: 400 });
    }

    const promptJa = body.promptJa?.trim();
    const promptEn = body.promptEn?.trim();
    if (!promptJa && !promptEn) {
      return NextResponse.json(
        { error: 'promptJa or promptEn is required' },
        { status: 400 },
      );
    }

    const providerId = (body.provider ?? 'veo-3.1-fast') as VideoProviderId;
    if (!VALID_PROVIDERS.includes(providerId)) {
      return NextResponse.json({ error: `Invalid provider: ${providerId}` }, { status: 400 });
    }

    const aspectRatio = (body.aspectRatio ?? '9:16') as VideoAspectRatio;
    if (!VALID_ASPECT.includes(aspectRatio)) {
      return NextResponse.json({ error: `Invalid aspectRatio: ${aspectRatio}` }, { status: 400 });
    }

    const durationSeconds = (body.durationSeconds ?? 8) as VideoDurationSeconds;
    const provider = getVideoProvider(providerId);
    if (!provider.allowedDurations.includes(durationSeconds)) {
      return NextResponse.json(
        {
          error: `Provider ${providerId} only supports durations: ${provider.allowedDurations.join('/')}`,
        },
        { status: 400 },
      );
    }

    const generateAudio = Boolean(body.generateAudio) && provider.supportsAudio;

    // 既存 Generation の所有者確認
    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { id: true, userId: true },
    });
    if (!generation || generation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // 入力画像 URL のドメイン検証 (自社 Vercel Blob のみ受理)
    const inputImageUrl = body.inputImageUrl?.trim() || undefined;
    if (inputImageUrl) {
      try {
        const u = new URL(inputImageUrl);
        const ALLOWED_HOSTS = ['public.blob.vercel-storage.com'];
        const ok = ALLOWED_HOSTS.some(
          (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
        );
        if (!ok) {
          return NextResponse.json(
            { error: `inputImageUrl host not allowed: ${u.hostname}` },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'inputImageUrl must be a valid URL' },
          { status: 400 },
        );
      }
    }

    // 料金事前計算 (UI 側でも表示するが、サーバー側でも記録)
    const costEstimate = provider.estimateCost(durationSeconds, { audio: generateAudio });

    // DB レコード作成 (status='pending')
    // 実際の API 呼び出しは cron ワーカーが pending を拾って実行
    const video = await prisma.generationVideo.create({
      data: {
        generationId,
        format: body.format ?? `${aspectRatio} ${durationSeconds}s`,
        aspectRatio,
        status: 'pending',
        provider: providerId,
        inputImageUrl,
        durationSeconds,
        generateAudio,
        prompt: promptEn ?? promptJa ?? '',
        promptJa: promptJa,
        costUsd: 0, // 完了時に確定値を書き込む
        providerMetadata: { estimatedCostUsd: costEstimate },
      },
      select: {
        id: true,
        status: true,
        provider: true,
        durationSeconds: true,
        aspectRatio: true,
      },
    });

    return NextResponse.json({
      videoId: video.id,
      status: video.status,
      provider: video.provider,
      estimatedCostUsd: costEstimate,
    });
  } catch (error: unknown) {
    return internalErrorResponse('generate-video POST', error, '動画ジョブの作成に失敗しました');
  }
}
