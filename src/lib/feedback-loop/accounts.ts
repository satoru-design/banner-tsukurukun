import { getPrisma } from '@/lib/prisma';

export class AccountConfigError extends Error {}

/** slug → ENV キー基底（'five-point-detox' → 'FIVE_POINT_DETOX'） */
export function envKeyBase(slug: string): string {
  return slug.replace(/-/g, '_').toUpperCase();
}

/** isActive な AdAccount 一覧 */
export async function getActiveAccounts() {
  return getPrisma().adAccount.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' } });
}

/** account の Meta access token（env）。未設定は AccountConfigError */
export function getAccountMetaToken(slug: string): string {
  const v = process.env[`ACCOUNT_${envKeyBase(slug)}_META_TOKEN`];
  if (!v) throw new AccountConfigError(`META token not set for account '${slug}'`);
  return v;
}

/** account の Slack webhook。専用→NEW_USER フォールバック→null */
export function getAccountWebhook(slug: string): string | null {
  return (
    process.env[`ACCOUNT_${envKeyBase(slug)}_SLACK_WEBHOOK`] ??
    process.env.SLACK_WEBHOOK_URL_NEW_USER ??
    null
  );
}
