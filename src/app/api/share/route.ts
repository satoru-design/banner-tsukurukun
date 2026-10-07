import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

/**
 * 送信先の allowlist。
 *
 * 以前はリクエストボディの webhookUrl へ無条件に POST していたため、
 * クラウドのメタデータ endpoint や社内ネットワークへ任意の POST を
 * 中継させられる SSRF になっていた（ステータスコードが応答に載るので
 * 到達可否のオラクルにもなる）。
 * Team Share の用途は Slack の Incoming Webhook だけなので host を固定する。
 */
const ALLOWED_WEBHOOK_HOSTS = ['hooks.slack.com'];

const MAX_MESSAGE_LENGTH = 4000;

function isAllowedWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_WEBHOOK_HOSTS.includes(u.hostname.toLowerCase());
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { message, webhookUrl } = (await req.json()) as {
      message?: unknown;
      webhookUrl?: unknown;
    };

    if (typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `message は ${MAX_MESSAGE_LENGTH} 文字以内にしてください` },
        { status: 400 },
      );
    }

    const url = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';

    // MOCK BEHAVIOR: Webhook URLがなくても成功扱いとする（コンソールに出力）
    if (url === '') {
      console.log('Team Share (Mock Triggered):', message);
      return NextResponse.json({
        success: true,
        mock: true,
        note: 'Webhook URLが未設定のためモックとして成功しました',
      });
    }

    if (!isAllowedWebhookUrl(url)) {
      return NextResponse.json(
        { error: `webhookUrl は https://${ALLOWED_WEBHOOK_HOSTS[0]}/... のみ指定できます` },
        { status: 400 },
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
      // allowlist を通過した host 以外へ飛ばされないよう、リダイレクト追従を切る。
      redirect: 'manual',
    });

    if (!res.ok) {
      // 外部のステータスをそのまま返すと到達可否のオラクルになるため伏せる。
      console.error('Share Error: external webhook returned', res.status);
      return NextResponse.json(
        { error: 'Webhook の送信に失敗しました' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return internalErrorResponse('share', e, 'Webhook の送信に失敗しました');
  }
}
