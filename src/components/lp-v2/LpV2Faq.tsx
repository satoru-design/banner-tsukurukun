'use client';

import { useState } from 'react';

const FAQS = [
  { q: 'クレジットカード登録は最初から必要ですか?', a: 'いいえ。Free プランは Google アカウントだけで開始できます。Starter / Pro に切替えるタイミングで Stripe Checkout を経由します。' },
  { q: '解約はいつでもできますか?', a: 'はい。Customer Portal からワンクリックで解約予約ができます。当月末まで利用可能で、月途中の解約金はかかりません。' },
  { q: '生成したバナーは商用利用できますか?', a: '可能です。Pro / Starter / Free すべてのプランで、生成画像は自社の広告・SNS・販促物に商用利用できます（透かし版を除く）。' },
  { q: 'Pro の月 100 本を超えたらどうなりますか?', a: '101 本目以降は超過課金として、翌月の請求に自動加算されます。生成は止まらず継続できます（料金詳細はプランページをご参照ください）。' },
  { q: 'Free プランで 4 本目を生成するとどうなりますか?', a: '生成は可能ですが画像に「PREVIEW」透かしが入ります。本番利用には Starter 以上をご検討ください。' },
  { q: '勝ちバナー学習はどう動きますか?', a: '過去に成果が出たバナーをアップロードすると、Gemini Vision が抽象タグ（コピー軸 / 配色 / レイアウト等）を抽出し、新しい生成プロンプトに自動注入します。画像そのものは生成 API には送りません（漏洩防止）。' },
  { q: '他社の AI バナーツールと何が違いますか?', a: '17 サイズ一括生成 + 勝ちバナー学習 + プロンプト閲覧の 3 点が他社にない特徴です。とくに「なぜ勝ったか」を AI が言語化するので社内ナレッジが残ります。' },
  { q: '無料体験で作ったバナーは、解約・退会後も残りますか?', a: 'ご自身でダウンロードした画像はお手元に残ります。アカウント上の履歴は退会と同時に削除されますが、退会前であれば ZIP 一括ダウンロードでバックアップが可能です。' },
  { q: '入力した商品情報・LP URL は安全に扱われますか?', a: '生成プロンプト構築のために利用しますが、画像生成 API には商品画像そのものは送信しません（抽象タグのみ）。アップロード素材は暗号化保管、第三者提供は行いません。' },
  { q: '法人でまとめて契約したいのですが', a: 'Plan C（個別商談）でご相談ください。月 100 本以上 / 複数名利用 / カスタム機能などの要件に応じて見積りをお出しします。' },
];

export const LpV2Faq = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            FAQ
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            よくあるご質問
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div
                key={f.q}
                className="bg-stone-50 border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-stone-100 transition-colors"
                  aria-expanded={open}
                >
                  <span className="text-slate-900 font-medium">{f.q}</span>
                  <span
                    className={`text-emerald-700 transition-transform shrink-0 ml-3 ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
