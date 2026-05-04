/**
 * Phase A.11.1: プラン表示用の Pill コンポーネント。
 * Header と マイページの両方で再利用する。
 *
 * 不明な plan 値は free 表示にフォールバック（DB 異常値防御）。
 */
import { ReactElement } from 'react';

const PLAN_STYLES: Record<string, { label: string; className: string }> = {
  free: {
    label: 'Free',
    className: 'bg-slate-700 text-slate-200',
  },
  starter: {
    label: 'Starter',
    className: 'bg-sky-500 text-white',
  },
  pro: {
    label: 'Pro',
    className: 'bg-teal-500 text-white',
  },
  business: {
    label: 'Business',
    className: 'bg-emerald-500 text-white',
  },
  admin: {
    label: 'Admin',
    className: 'bg-purple-600 text-white',
  },
};

interface PlanPillProps {
  plan: string;
  /** size variant. デフォルト xs（ヘッダー用）。マイページ用に sm を使う */
  size?: 'xs' | 'sm';
}

export function PlanPill({ plan, size = 'xs' }: PlanPillProps): ReactElement {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`${sizeClass} rounded-full font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
