const FEATURES = [
  { num: '01', title: '17 サイズ一括生成', desc: 'Instagram / Display / リワード / バナー広告... 主要 17 サイズを一度に出力。サイズ違いの追加発注ゼロ。' },
  { num: '02', title: '勝ちバナー学習', desc: '過去に成果が出たバナーをアップロードすると、AI が勝ちパターンを抽出し新しい生成に反映。' },
  { num: '03', title: 'Brand Kit 対応', desc: 'ロゴ・カラー・フォントの 3 要素を保存。生成バナー全体に統一感を担保。' },
  { num: '04', title: 'プロンプト閲覧（Pro）', desc: 'AI がどう考えてバナーを生成したかを完全公開。ナレッジを社内に蓄積できる。' },
  { num: '05', title: '履歴管理', desc: '過去のすべての生成履歴を保存。再生成・コピー・ZIP 一括 DL も可能。' },
  { num: '06', title: 'お気に入り保護', desc: '勝ちバナーは「お気に入り」に登録すれば、月次の履歴ローテーションで消えない。' },
];

export const LpV2Features = () => {
  return (
    <section id="features" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            Features
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            機能ハイライト
          </h2>
          <p className="text-sm text-slate-500 mt-4">
            バナー制作のすべての面倒を、ひとつのツールで
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-stone-50 border border-slate-200 rounded-xl p-6 hover:border-emerald-700/40 transition-colors"
            >
              <div className="text-emerald-800 font-mono text-xs font-bold tabular-nums tracking-widest">
                {f.num}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-3">{f.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
