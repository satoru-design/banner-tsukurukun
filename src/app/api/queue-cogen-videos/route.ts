/**
 * POST /api/queue-cogen-videos (Phase B.7)
 *
 * 静止画生成 (/api/ironclad-generate) と分離した、動画 co-gen 専用エンドポイント。
 * クライアントは静止画完成後にこの API を呼んで:
 *  1. Imagen 4 で文字なしクリーン素材 (各 AR ぶん) を生成
 *  2. Claude Sonnet で Veo 用 prompt を生成
 *  3. GenerationVideo を pending 作成 (cron が拾って Veo 投入)
 *
 * これにより /api/ironclad-generate が 5 分タイムアウトする問題を解決する。
 *
 * Auth:
 *  - admin (plan='admin') かつ Generation の所有者のみ
 *  - 非 admin は 403
 *
 * Vibe Coding 六条:
 *  1. セキュリティ: auth 必須、Generation 所有者検証、admin 限定
 *  2. コスト: Imagen × N AR + Sonnet × N AR + GenerationVideo pending 作成
 *  3. 法規: -
 *  4. データ: 失敗時は何もキュー投入しない (atomic に)
 *  5. 性能: maxDuration=120s (Imagen 30-60s × 並列で十分余裕)
 *  6. 検証: aspectRatios 検証、admin 検証、Generation 検証
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import {
  generateCleanImageAndQueueVideo,
  type CoVideoOptions,
} from '@/lib/generations/clean-image';
import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface RequestBody {
  generationId: string;
  /** 動画 co-gen のソースになる材料 (clean image prompt + Sonnet narration 推測に使う) */
  materials: IroncladMaterials;
  /** Phase B.5 必須 (1+) */
  videoAspectRatios: ('9:16' | '16:9')[];
  videoProvider?: 'veo-3.1-fast' | 'veo-3.1-lite';
  videoDurationSeconds?: 4 | 6 | 8;
  videoNarrationEnabled?: boolean;
  videoNarrationScript?: string;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.plan !== 'admin') {
      return NextResponse.json(
        { error: '動画 co-gen は admin 限定 (β)' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Partial<RequestBody>;

    if (!body.generationId || typeof body.generationId !== 'string') {
      return NextResponse.json({ error: 'generationId is required' }, { status: 400 });
    }
    if (!body.materials || typeof body.materials !== 'object') {
      return NextResponse.json({ error: 'materials is required' }, { status: 400 });
    }
    const aspectRatios = Array.isArray(body.videoAspectRatios)
      ? body.videoAspectRatios.filter((x): x is '9:16' | '16:9' =>
          x === '9:16' || x === '16:9',
        )
      : [];
    if (aspectRatios.length === 0) {
      return NextResponse.json(
        { error: 'videoAspectRatios must contain at least one of "9:16" or "16:9"' },
        { status: 400 },
      );
    }

    // Generation 所有者検証
    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({
      where: { id: body.generationId },
      select: { id: true, userId: true },
    });
    if (!generation || generation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    const materials = body.materials as IroncladMaterials;
    const opts: CoVideoOptions = {
      provider: body.videoProvider,
      durationSeconds: body.videoDurationSeconds,
      aspectRatios,
      narrationEnabled: body.videoNarrationEnabled === true,
      narrationScript:
        typeof body.videoNarrationScript === 'string'
          ? body.videoNarrationScript.slice(0, 200)
          : undefined,
    };

    const cogen = await generateCleanImageAndQueueVideo({
      userId: session.user.id,
      generationId: body.generationId,
      materials,
      options: opts,
    });

    return NextResponse.json({ videos: cogen.videos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[queue-cogen-videos] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
