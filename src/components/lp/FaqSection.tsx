'use client';

import { useState } from 'react';

/**
 * Phase A.15: FAQ アコーディオン
 */
const FAQS = [
  {
    q: 'クレジットカード登録は最初から必要ですか?',
    a: 'いいえ。Free プランは Google アカウントだけで開始できます。Starter / Pro に切替えるタイミングで Stripe Checkout を経由します。',
  },
  {
    q: '解約はいつでもできますか?',
    a: 'はい。Customer Portal からワンクリックで解約予約ができます。当月末まで利用可能で、月途中の解約金はかかりません。',
  },
  {
    q: '生成したバナーは商用利用できますか?',
    a: '可能です。Pro / Starter / Free すべてのプランで、生成画像は自社の広告・SNS・販促物に商用利用できます（透かし版を除く）。',
  },
  {
    q: 'Pro の月 100 回を超えたらどうなりますか?',
    a: '101 回目以降は超過課金（¥80/回）として、翌月の請求に自動加算されます。生成は止まらず継続できます。',
  },
  {
    q: 'Free プランで 4 回目を生成するとどうなりますか?',
    a: '生成は可能ですが画像に「PREVIEW」透かしが入ります。本番利用には Starter 以上をご検討ください。',
  },
  {
    q: '勝ちバナー学習はどう動きますか?',
    a: '過去に成果が出たバナーをアップロードすると、Gemini Vision が抽象タグ（コピー軸 / 配色 / レイアウト等）を抽出し、新しい生成プロンプトに自動注入します。画像そのものは生成 API には送りません（漏洩防止）。',
  },
  {
    q: '他社の AI バナーツールと何が違いますか?',
    a: '17 サイズ一括生成 + 勝ちバナー学習 + プロンプト閲覧の 3 点が他社にない特徴です。とくに「なぜ勝ったか」を AI が言語化するので社内ナレッジが残ります。',
  },
  {
    q: '法人でまとめて契約したいのですが',
    a: 'Plan C（個別商談）でご相談ください。月 100 回以上 / 複数名利用 / カスタム機能などの要件に応じて見積りをお出しします。',
  },
];

export const FaqSection = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          よくあるご質問
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div
                key={f.q}
                className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                  aria-expanded={open}
                >
                  <span className="text-slate-100 font-medium">{f.q}</span>
                  <span
                    className={`text-emerald-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm text-slate-300 leading-relaxed">{f.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
