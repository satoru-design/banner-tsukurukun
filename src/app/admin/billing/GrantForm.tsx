'use client';

import { useState } from 'react';

interface GrantResult {
  email: string;
  plan: string;
  planExpiresAt: string | null;
}

export function GrantForm() {
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<string>('starter');
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrantResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/grant-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan, months: plan === 'free' ? 0 : months }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `エラー: HTTP ${res.status}`);
      } else {
        setResult(data as GrantResult);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-slate-400">
          ユーザーメール
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-600"
          placeholder="user@example.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="plan" className="text-sm text-slate-400">
          付与プラン
        </label>
        <select
          id="plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
        >
          <option value="free">free（降格）</option>
          <option value="starter">starter</option>
          <option value="pro">pro</option>
          <option value="business">business</option>
        </select>
      </div>

      {plan !== 'free' && (
        <div className="flex flex-col gap-1">
          <label htmlFor="months" className="text-sm text-slate-400">
            延長月数
          </label>
          <input
            id="months"
            type="number"
            min={1}
            max={24}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            required
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600 w-24"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {loading ? '処理中...' : 'プランを付与する'}
      </button>

      {error && (
        <div className="rounded-md border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          <p>
            <span className="font-medium">{result.email}</span> に{' '}
            <span className="font-medium">{result.plan}</span> を付与しました。
          </p>
          {result.planExpiresAt && (
            <p className="mt-1 text-xs text-emerald-400">
              有効期限: {new Date(result.planExpiresAt).toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
