'use client';

/**
 * D12 Task 19: Free/Starter 上限到達時のアップグレード訴求モーダル。
 *
 * 既存の checkout フローを再利用するため、ボタンは /account ページに
 * upgrade パラメータ付きで遷移させる（CheckoutButton 直接統合より確実）。
 */
interface Props {
  currentPlan: 'free' | 'starter' | 'pro' | 'admin';
  onClose: () => void;
}

export function UpgradeLpModal({ currentPlan, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">LP 上限を解除</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-300">
          {currentPlan === 'free' &&
            '月 1 本までの Free プランです。Starter で月 5 本、Pro で月 20 本まで作成できます。'}
          {currentPlan === 'starter' &&
            '月 5 本までの Starter プランです。Pro で月 20 本 + 超過分は実質無制限で利用可能です。'}
        </p>

        <div className="space-y-2">
          {currentPlan === 'free' && (
            <a
              href="/account?upgrade=starter"
              className="block text-center bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold py-3 rounded"
            >
              Starter にアップグレード
            </a>
          )}
          <a
            href="/account?upgrade=pro"
            className="block text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded"
          >
            Pro にアップグレード
          </a>
        </div>

        <p className="text-xs text-slate-500">
          早割コード LPMAKER_EARLY 適用可（先着・期間限定）
        </p>
      </div>
    </div>
  );
}
