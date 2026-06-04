import { getPrisma } from '@/lib/prisma';
import { getPayjpClient } from './payjp-client';
import { getUsageLimit } from '@/lib/plans/limits';
import { LP_USAGE_LIMIT_PRO } from '@/lib/lp/limits';
import { getOverageRate, getLpOverageRate } from '@/lib/plans/overage-rates';

/**
 * Pay.jp 超過従量課金（移管 P5 / 「自前集計 + 都度課金で維持」の本体）
 *
 * Stripe はメータード課金で自動請求していたが、Pay.jp サブスクは固定額のみ。
 * 周期末（subscription.renewed webhook、または解約済みは cron）に、その周期の
 * 超過本数を usageCount / currentMonthLpUsageCount から算出し、保存カードへ
 * charges.create で都度課金する。
 *
 * 冪等性（実金額・最重要）:
 *   Pay.jp charges.create に idempotency key が無いため、OverageCharge テーブルの
 *   @@unique([userId, periodEnd]) で二重課金を防ぐ。
 *   既存レコードが succeeded/pending なら課金しない（顧客二重課金 > 売上漏れ の優先度で安全側）。
 *
 * 単価: banner pro ¥80 / business ¥40（上限超過分）、LP pro ¥980/本（上限 20 超）。
 */

export interface BillOverageResult {
  billed: boolean;
  reason?: 'no_overage' | 'no_customer' | 'already_billed' | 'pending_exists';
  amount?: number;
  bannerUnits?: number;
  lpUnits?: number;
  chargeId?: string;
}

/**
 * @param periodEnd 課金対象の周期境界（冪等キー）
 *
 * NOTE: 課金に使う plan は「終了した周期に適用されていたプラン」= DB の user.plan を使う。
 * renewed webhook ではこの関数を plan 同期の **前** に呼ぶため user.plan は旧プランのまま。
 * sub.plan.id（= ダウングレード後の新プラン）を使うと旧周期の超過を誤った単価で計算してしまう。
 */
export const billPayjpOverage = async (
  userId: string,
  periodEnd: Date
): Promise<BillOverageResult> => {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { billed: false, reason: 'no_overage' };

  const plan = user.plan;

  // 超過本数の算出
  const bannerLimit = getUsageLimit(plan);
  const bannerUnits =
    Number.isFinite(bannerLimit) && bannerLimit > 0
      ? Math.max(0, user.usageCount - bannerLimit)
      : 0;

  const lpUnits =
    plan === 'pro'
      ? Math.max(0, (user.currentMonthLpUsageCount ?? 0) - LP_USAGE_LIMIT_PRO)
      : 0;

  const amount = bannerUnits * getOverageRate(plan) + lpUnits * getLpOverageRate(plan);
  if (amount <= 0) return { billed: false, reason: 'no_overage' };

  if (!user.payjpCustomerId) {
    console.error(`[payjp-overage] user ${userId} has overage but no payjpCustomerId`);
    return { billed: false, reason: 'no_customer' };
  }

  // 冪等チェック: 同 periodEnd の記録の状態で分岐
  // - succeeded: 課金済み → 何もしない
  // - pending:   前回の課金結果が不明（タイムアウト等）→ 二重課金回避のため保留（手動確認）
  // - failed:    課金が確実に失敗（カード拒否等）→ 再試行可
  const existing = await prisma.overageCharge.findUnique({
    where: { userId_periodEnd: { userId, periodEnd } },
  });
  if (existing) {
    if (existing.status === 'succeeded') return { billed: false, reason: 'already_billed' };
    if (existing.status === 'pending') {
      console.error(
        `[payjp-overage] pending record for ${userId}@${periodEnd.toISOString()} — skip to avoid double charge (manual review)`
      );
      return { billed: false, reason: 'pending_exists' };
    }
    // failed → pending に戻して再試行
    await prisma.overageCharge.update({
      where: { userId_periodEnd: { userId, periodEnd } },
      data: { plan, bannerUnits, lpUnits, amount, status: 'pending' },
    });
  } else {
    // 新規 pending レコード（@@unique が並行二重実行をブロック）
    await prisma.overageCharge.create({
      data: { userId, periodEnd, plan, bannerUnits, lpUnits, amount, status: 'pending' },
    });
  }

  // 都度課金
  const payjp = getPayjpClient();
  let chargeId: string;
  try {
    const charge = await payjp.charges.create({
      amount,
      currency: 'jpy',
      customer: user.payjpCustomerId,
      description: `従量課金 ${plan} (banner ${bannerUnits} / lp ${lpUnits}本)`,
      metadata: {
        userId,
        plan,
        periodEnd: periodEnd.toISOString(),
        bannerUnits: String(bannerUnits),
        lpUnits: String(lpUnits),
      },
    });
    chargeId = charge.id;
  } catch (e) {
    // Pay.jp API がエラーを返した = 課金は成立していない → failed にして再試行可能にする
    await prisma.overageCharge.update({
      where: { userId_periodEnd: { userId, periodEnd } },
      data: { status: 'failed' },
    });
    throw e;
  }

  await prisma.overageCharge.update({
    where: { userId_periodEnd: { userId, periodEnd } },
    data: { status: 'succeeded', payjpChargeId: chargeId },
  });

  return { billed: true, amount, bannerUnits, lpUnits, chargeId };
};
