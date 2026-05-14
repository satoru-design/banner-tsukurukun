const FEATURES = [
  { num: '01', title: '17 サイズ一括生成', desc: 'Instagram / Display / リワード / バナー広告... 主要 17 サイズを一度に出力。サイズ違いの追加発注、もう要りません。', radius: 'rounded-[16px]' },
  { num: '02', title: '勝ちバナー学習', desc: '過去に成果が出たバナーをアップロードすると、AI が勝ちパターンを抽出し新しい生成に反映します。', radius: 'rounded-[20px]' },
  { num: '03', title: 'Brand Kit 対応', desc: 'ロゴ・カラー・フォントの 3 要素を保存。生成バナー全体に統一感を担保します。', radius: 'rounded-[14px]' },
  { num: '04', title: 'プロンプト閲覧（Pro）', desc: 'AI がどう考えてバナーを生成したかを完全公開。ナレッジを社内に蓄積できます。', radius: 'rounded-[18px]' },
  { num: '05', title: '履歴管理', desc: '過去のすべての生成履歴を保存。再生成・コピー・ZIP 一括 DL も可能です。', radius: 'rounded-[14px]' },
  { num: '06', title: 'お気に入り保護', desc: '勝ちバナーは「お気に入り」に登録すれば、月次の履歴ローテーションで消えません。', radius: 'rounded-[22px]' },
];

export const LpV2Features = () => {
  return (
    <section id="features" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="mb-12">
          <div className="font-serif italic text-sm text-emerald-900">
            できること
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 mt-2">
            バナー制作の面倒を、ひとつに。
          </h2>
          <p className="text-sm text-slate-600 mt-4 max-w-2xl">
            私たちが現場で「これがあれば」と感じてきた機能を、ぜんぶ詰めました。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`bg-stone-50 border border-slate-300 ${f.radius} p-6 hover:border-emerald-700/60 transition-colors ${
                i % 2 === 1 ? 'md:translate-y-4' : ''
              }`}
            >
              <div className="font-serif italic text-emerald-800 text-sm font-bold">
                {f.num}
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 mt-3">{f.title}</h3>
              <p className="text-sm text-slate-700 mt-2 leading-[1.85]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
