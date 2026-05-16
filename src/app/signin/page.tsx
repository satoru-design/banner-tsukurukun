'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { LpFunnelTracker, trackSigninClicked } from '@/components/lp/LpFunnelTracker';

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const from = searchParams.get('from') ?? 'direct';

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      {/* Phase A.19: signin 到達イベント (from クエリ付き) */}
      <LpFunnelTracker event="signin_landed" />

      <div className="max-w-sm w-full space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-teal-400">勝ちバナー</span>作る君
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            ブリーフを書くだけで勝ちバナーを17サイズ一括生成
          </p>
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
          className="w-full px-6 py-3 rounded-xl text-white font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 transition"
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

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <SignInContent />
    </Suspense>
  );
}
