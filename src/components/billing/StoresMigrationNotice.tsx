import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';

// 上部バナー「お支払いはこちら」の遷移先 = STORES の Pro プラン商品ページ。
// URL を変えたい場合は環境変数 NEXT_PUBLIC_STORES_PRO_URL を設定すれば差し替え可能。
const STORES_PRO_URL =
  process.env.NEXT_PUBLIC_STORES_PRO_URL ??
  'https://5pointdetox.stores.jp/items/6a39ff52c99ac713779b3804';

/**
 * Task 15: STORES 移行告知バナー
 *
 * 表示条件（全て満たす場合のみ）:
 *   1. PAYMENT_PROVIDER === 'stores'
 *   2. ユーザーの plan が有料プラン（'free' 以外）
 *   3. 有効な有料期間が設定されていない、または7日以内に失効する
 *      （planExpiresAt == null、または planExpiresAt <= now + 7日）
 *      → 新しい STORES 決済での支払いが必要な状態
 *
 * 注: Invoice テーブルは手動 STORES 運用下では本番に未マイグレーションのため依存しない。
 *     既存の User.plan / User.planExpiresAt のみで判定する。
 *
 * Server Component（PaymentFailedBanner と同じパターン）
 */
export const StoresMigrationNotice = async () => {
  // 条件 1: プロバイダチェック（サーバー側は PAYMENT_PROVIDER を直接参照）
  if (process.env.PAYMENT_PROVIDER !== 'stores') return null;

  const user = await getCurrentUser();
  if (!user.userId) return null;

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { plan: true, planExpiresAt: true },
  });

  // 条件 2: 有料プランのみ
  if (!dbUser || dbUser.plan === 'free') return null;

  // 条件 3: 有効な有料期間が無い、または7日以内に失効（記念日ベース対応）
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const needsAction = dbUser.planExpiresAt == null || dbUser.planExpiresAt <= soon;
  if (!needsAction) return null;

  return (
    <div
      role="alert"
      className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-50"
    >
      <p className="text-sm flex-1">
        📢 お支払い方法が変更になりました。次回更新分よりSTORES請求書決済でのお支払いをお願いいたします。
      </p>
      <a
        href={STORES_PRO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
      >
        お支払いはこちら
      </a>
    </div>
  );
};
