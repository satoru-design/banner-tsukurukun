import type { LandingPage, User } from '@prisma/client';

/**
 * D14 Task 21: LP Maker Pro 2.0 新規 LP 公開を Slack に通知する。
 *
 * env: SLACK_WEBHOOK_URL_NEW_USER (既存の new-user webhook を流用)
 *   未設定なら no-op。
 *
 * 呼び出し元:
 *   - src/lib/lp/publish.ts publishLandingPage 内 (fire-and-forget)
 */
export async function notifyNewLpPublished(args: {
  lp: Pick<LandingPage, 'id' | 'title' | 'userId' | 'slug'>;
  user: Pick<User, 'email' | 'name' | 'plan'>;
}): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (!webhook) return;

  const userSlug = args.lp.userId.slice(-8);
  const publicUrl = `https://lpmaker-pro.com/site/${userSlug}/${args.lp.slug}`;
  const adminBadge = args.user.email === 'str.kk.co@gmail.com' ? ':crown: ' : '';

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `🎉 LP Maker Pro 2.0: 新規 LP 公開 ${adminBadge}\n*${args.lp.title}*\nby ${args.user.name ?? args.user.email} (${args.user.plan})\n${publicUrl}`,
      }),
    });
  } catch (e) {
    console.error('[slack] notify-new-lp failed', e);
  }
}
