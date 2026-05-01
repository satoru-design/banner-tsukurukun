'use client';

import { useState } from 'react';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xaqaazaz';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Phase A.15: /contact フォーム
 * - Formspree 経由で satoru@4thavenuelab.net へ送信
 * - 既存 ID `xaqaazaz` を流用（4thavenuelab.net と同じ）
 */
export const ContactForm = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg(null);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">✓</div>
        <h2 className="text-xl font-bold text-emerald-200">送信完了しました</h2>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          2 営業日以内（祝祭日を除く平日 10:00〜17:00 受付）を目安に <span className="text-emerald-300">satoru@4thavenuelab.net</span> から返信いたします。<br />
          少々お待ちください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-200 mb-1">
          お名前 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1">
          メールアドレス <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label htmlFor="company" className="block text-sm font-medium text-slate-200 mb-1">
          会社名（任意）
        </label>
        <input
          type="text"
          id="company"
          name="company"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label htmlFor="volume" className="block text-sm font-medium text-slate-200 mb-1">
          月の生成想定回数 <span className="text-red-400">*</span>
        </label>
        <select
          id="volume"
          name="volume"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
          defaultValue=""
        >
          <option value="" disabled>
            選択してください
          </option>
          <option value="〜100 回">〜100 回</option>
          <option value="100-500 回">100-500 回</option>
          <option value="500-1000 回">500-1000 回</option>
          <option value="1000+ 回">1000+ 回</option>
        </select>
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-200 mb-1">
          ご相談内容 <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 resize-y"
          placeholder="代理店契約のご相談 / カスタム機能 / 大規模利用 など"
        />
      </div>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agree"
          name="agree"
          required
          className="mt-1 w-4 h-4 accent-emerald-500"
        />
        <label htmlFor="agree" className="text-sm text-slate-300">
          プライバシーポリシーに同意します（送信内容は問合せ対応のみに使用、第三者提供しません）
        </label>
      </div>
      {errorMsg && (
        <div className="text-sm text-red-400">送信に失敗しました: {errorMsg}</div>
      )}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-3 rounded-lg transition-all"
      >
        {status === 'submitting' ? '送信中...' : '送信する'}
      </button>
    </form>
  );
};
