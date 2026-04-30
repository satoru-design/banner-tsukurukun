import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';

/**
 * Phase A.14: Pro プランの今月超過分を表示
 *
 * - usageCount > USAGE_LIMIT_PRO の時のみ表示
 * - 「今月超過: N 回 × ¥80 = ¥X」を見せる
 * - Stripe 側の usage と同期（payment_succeeded で usageCount=0 リセット）
 */
interface Props {
  plan: string;
  usageCount: number;
}

export const ProOverageDisplay = ({ plan, usageCount }: Props) => {
  if (plan !== 'pro') return null;
  const overage = Math.max(0, usageCount - USAGE_LIMIT_PRO);
  if (overage === 0) return null;
  const yen = overage * 80;
  return (
    <div className="text-sm text-amber-300 mt-2">
      今月超過: {overage} 回 × ¥80 = ¥{yen.toLocaleString('ja-JP')}（次回請求に追加）
    </div>
  );
};
