'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { LpFunnelTracker, trackSigninClicked } from '@/components/lp/LpFunnelTracker';

interface Props {
  isLpMaker: boolean;
}

export function SignInClient({ isLpMaker }: Props) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const from = searchParams.get('from') ?? 'direct';

  const brand = isLpMaker
    ? {
        accent: 'LP Maker',
        suffix: ' Pro 2.0',
        subtitle: '1 つのブリーフで LP と広告 17 サイズが同時に生まれる',
        accentColor: 'text-emerald-400',
        buttonClass: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
      }
    : {
        accent: '勝ちバナー',
        suffix: '作る君',
        subtitle: 'ブリーフを書くだけで勝ちバナーを17サイズ一括生成',
        accentColor: 'text-teal-400',
        buttonClass: 'bg-gradient-to-r from-teal-500 to-emerald-600',
      };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <LpFunnelTracker event="signin_landed" />

      <div className="max-w-sm w-full space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">
            <span className={brand.accentColor}>{brand.accent}</span>
            {brand.suffix}
          </h1>
          <p className="text-sm text-slate-400 mt-2">{brand.subtitle}</p>
        </div>

        {error === 'AccessDenied' && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded p-3 border border-red-700/50">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              現在ベータ運用中です。アクセス権がある場合は管理者にお問い合わせください。
            </span>
          </div>
        )}

        {error && error !== 'AccessDenied' && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded p-3 border border-red-700/50">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>ログインエラーが発生しました。再度お試しください。({error})</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            trackSigninClicked(from);
            signIn('google', { callbackUrl });
          }}
          className={`w-full px-6 py-3 rounded-xl text-white font-bold hover:opacity-90 transition ${brand.buttonClass}`}
        >
          Google アカウントでログイン
        </button>

        <p className="text-[11px] text-slate-500">
          ログインすることで利用規約に同意したものとみなされます
        </p>
      </div>
    </div>
  );
}
