'use client';

/**
 * Phase A.17.0: 「1 つ下のプラン」へのダウングレード提案モーダル
 *
 * 現プランの隣に置く DowngradeProposalButton から呼ばれる。
 *
 * - 現プラン → 一つ下のプランの差分（失う機能・節約額）を提示
 * - 確定で適切な遷移を実行:
 *     admin    → Business への新規 Checkout（subscription なしのため）
 *     business → DowngradeButton 相当（targetPlan='pro'）
 *     pro      → DowngradeButton 相当（targetPlan='starter'）
 *     starter  → Stripe Customer Portal で解約 → Free
 *     free     → ボタン自体非表示（このモーダルは出ない）
 */
import { useState } from 'react';
import { CheckoutButton } from './CheckoutButton';
import { DowngradeButton } from './DowngradeButton';
import { PortalButton } from './PortalButton';

type Plan = 'free' | 'starter' | 'pro' | 'business' | 'admin';

interface Props {
  currentPlan: Plan;
  onClose: () => void;
}

interface PlanInfo {
  name: string;
  emoji: string;
  price: string;
  monthlyJpy: number;
  limit: string;
  oneStepDown: Plan;
  losesFeatures: string[];
  savings: string;
  /** ダウングレード方法 */
  method: 'downgrade-api' | 'portal-cancel' | 'new-checkout';
}

const PLAN_MAP: Record<Plan, PlanInfo | null> = {
  admin: {
    name: 'Admin',
    emoji: '👑',
    price: '社内利用',
    monthlyJpy: 0,
    limit: '無制限',
    oneStepDown: 'business',
    losesFeatures: ['admin 専用機能（管理ダッシュボード等）'],
    savings: '— 顧客と同じ目線でプロダクト確認可能に',
    method: 'new-checkout',
  },
  business: {
    name: 'Business',
    emoji: '🚀',
    price: '¥39,800',
    monthlyJpy: 39800,
    limit: '1,000 枚',
    oneStepDown: 'pro',
    losesFeatures: [
      'メータード単価 ¥40 → ¥80（2 倍）',
      '利用上限 3,000 → 500 枚',
      '🔜 クライアント別フォルダ・拡張 Brand Kit（順次提供予定機能）',
    ],
    savings: '月額 ¥25,000 節約（¥39,800 → ¥14,800）',
    method: 'downgrade-api',
  },
  pro: {
    name: 'Pro',
    emoji: '💼',
    price: '¥14,800',
    monthlyJpy: 14800,
    limit: '100 枚',
    oneStepDown: 'starter',
    losesFeatures: [
      '対応サイズ: 全 17 → 5 サイズ（主要 SNS のみ）',
      '勝ちバナー添付・プロンプト閲覧',
      '複数スタイル並列生成',
      '一括 ZIP DL',
      'お気に入り 50 枚 → 5 枚',
      'メータード課金（超過運用不可、30 枚で固定）',
    ],
    savings: '月額 ¥10,820 節約（¥14,800 → ¥3,980）',
    method: 'downgrade-api',
  },
  starter: {
    name: 'Starter',
    emoji: '🌱',
    price: '¥3,980',
    monthlyJpy: 3980,
    limit: '30 枚',
    oneStepDown: 'free',
    losesFeatures: [
      '透かしなし生成（Free は PREVIEW 透かし入り）',
      '月 30 枚 → 月 3 枚（生涯）',
      'お気に入り 5 枚 → 不可',
    ],
    savings: '月額 ¥3,980 節約（無料化）',
    method: 'portal-cancel',
  },
  free: null, // free からはダウングレードなし
};

const DESTINATION_LABEL: Record<Plan, string> = {
  starter: '🌱 Starter',
  pro: '💼 Pro',
  business: '🚀 Business',
  free: 'Free',
  admin: 'Admin',
};

const DESTINATION_PRICE: Record<Plan, string> = {
  starter: '¥3,980 / 月',
  pro: '¥14,800 / 月',
  business: '¥39,800 / 月',
  free: '¥0',
  admin: '社内利用',
};

export function DowngradeProposalModal({ currentPlan, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const info = PLAN_MAP[currentPlan];

  if (!info) {
    onClose();
    return null;
  }

  const destination = info.oneStepDown;
  const businessPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE;

  const renderConfirmAction = () => {
    if (info.method === 'new-checkout') {
      // admin → Business: subscription を新規作成 (admin は元々 sub 持ってないため)
      if (!businessPriceId) {
        return (
          <p className="text-sm text-red-400">
            Business Price ID が未設定です。先に環境変数を設定してください。
          </p>
        );
      }
      return (
        <CheckoutButton
          basePriceId={businessPriceId}
          label="Business にダウングレード"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded font-bold disabled:opacity-50"
        />
      );
    }
    if (info.method === 'downgrade-api') {
      const target = destination as 'starter' | 'pro';
      return (
        <DowngradeButton
          targetPlan={target}
          label={`${DESTINATION_LABEL[destination]} にダウングレード（期末切替）`}
        />
      );
    }
    if (info.method === 'portal-cancel') {
      // Starter → Free: Stripe Customer Portal で解約してもらう
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Free（無料プラン）への変更は、Stripe Customer Portal で「解約」を選択してください。
            期末まで Starter として利用可能、その後 Free に戻ります。
          </p>
          <PortalButton />
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 text-xl leading-none"
          aria-label="閉じる"
        >
          ×
        </button>

        <h3 className="text-lg font-bold text-white mb-4">
          ダウングレードのご案内
        </h3>

        {/* 遷移可視化 */}
        <div className="flex items-center justify-between bg-slate-800/60 rounded-lg p-3 mb-4">
          <div className="text-center flex-1">
            <div className="text-xs text-slate-400 mb-1">現在</div>
            <div className="text-base font-bold text-white">{info.emoji} {info.name}</div>
            <div className="text-xs text-slate-500 mt-1">{info.price}</div>
          </div>
          <div className="text-2xl text-slate-500 px-3">→</div>
          <div className="text-center flex-1">
            <div className="text-xs text-slate-400 mb-1">変更後</div>
            <div className="text-base font-bold text-white">{DESTINATION_LABEL[destination]}</div>
            <div className="text-xs text-slate-500 mt-1">{DESTINATION_PRICE[destination]}</div>
          </div>
        </div>

        {/* 節約 */}
        <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-3 mb-4">
          <div className="text-xs text-emerald-400 font-bold mb-1">💰 節約</div>
          <div className="text-sm text-slate-200">{info.savings}</div>
        </div>

        {/* 失う機能 */}
        <div className="rounded border border-amber-500/30 bg-amber-950/20 p-3 mb-5">
          <div className="text-xs text-amber-400 font-bold mb-2">⚠️ 失う機能</div>
          <ul className="text-sm text-slate-300 space-y-1">
            {info.losesFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-slate-500 mt-0.5">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* タイミング注記 */}
        <p className="text-xs text-slate-500 mb-4">
          {info.method === 'downgrade-api'
            ? 'ダウングレードは次回更新日から有効になります。それまでは現プランの機能を引き続き利用できます。'
            : info.method === 'portal-cancel'
              ? 'Customer Portal でキャンセルすると期末で Free に切り替わります。'
              : '新規 Subscription を作成します（admin は元々 subscription を持たないため）。'}
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded font-bold"
            >
              ダウングレード手続きへ進む
            </button>
          ) : (
            <>{renderConfirmAction()}</>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm"
          >
            キャンセル（このまま {info.name} を継続）
          </button>
        </div>
      </div>
    </div>
  );
}
