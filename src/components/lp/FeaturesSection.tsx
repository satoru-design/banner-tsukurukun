/**
 * Phase A.15: 機能カード 6 個
 */
const FEATURES = [
  {
    icon: '🎯',
    title: '17 サイズ一括生成',
    desc: 'Instagram / Display / リワード / バナー広告... 主要 17 サイズを一度に出力。サイズ違いの追加発注ゼロ。',
  },
  {
    icon: '🏆',
    title: '勝ちバナー学習',
    desc: '過去に成果が出たバナーをアップロードすると、AI が勝ちパターンを抽出し新しい生成に反映。',
  },
  {
    icon: '🎨',
    title: 'Brand Kit 対応',
    desc: 'ロゴ・カラー・フォントの3要素を保存。生成バナー全体に統一感を担保。',
  },
  {
    icon: '🔍',
    title: 'プロンプト閲覧（Pro）',
    desc: 'AI がどう考えてバナーを生成したかを完全公開。ナレッジを社内に蓄積できる。',
  },
  {
    icon: '📁',
    title: '履歴管理',
    desc: '過去のすべての生成履歴を保存。再生成・コピー・ZIP 一括 DL も可能。',
  },
  {
    icon: '⭐',
    title: 'お気に入り保護',
    desc: '勝ちバナーは「お気に入り」に登録すれば、月次の履歴ローテーションで消えない。',
  },
];

export const FeaturesSection = () => {
  return (
    <section className="bg-slate-900 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          機能ハイライト
        </h2>
        <p className="text-slate-400 text-center mt-3">
          バナー制作のすべての面倒を、ひとつのツールで
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-slate-950 border border-slate-800 rounded-xl p-6 hover:border-emerald-500/40 transition-colors"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-base font-bold text-slate-100">{f.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
