import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { PortalButton } from './PortalButton';

/**
 * Phase A.12: 支払い失敗の警告バナー
 *
 * - User.paymentFailedAt が立っているユーザーに表示
 * - layout.tsx 直下に常駐させて全ページに出す
 * - Server Component（auth + DB 直接読み）
 * - PortalButton は Client Component だが Server Component の子に置ける
 */
export const PaymentFailedBanner = async () => {
  const user = await getCurrentUser();
  if (!user.userId) return null;

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { paymentFailedAt: true },
  });
  if (!dbUser?.paymentFailedAt) return null;

  return (
    <div
      role="alert"
      className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-50"
    >
      <p className="text-sm flex-1">
        ⚠️ お支払いが失敗しました。Customer Portal で支払い方法を更新してください。
      </p>
      <PortalButton />
    </div>
  );
};
