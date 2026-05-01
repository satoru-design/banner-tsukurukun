/**
 * Phase A.15: 利用者の声セクション
 *
 * 配置: ComparisonSection と PricingSection の間
 * （社会的証明 → 価格判断 のファネル順、SaaS LP の標準パターン）
 *
 * デザイン:
 * - PC 3 カラム / モバイル 1 カラム
 * - グラデーションアバター + 役職表示
 * - キャッチコピーを emerald で強調
 * - Before/After 対比は背景色とラベルで明示（Before=slate-900, After=emerald 5%）
 */
const VOICES = [
  {
    initials: 'Y.K',
    avatarSrc: '/lp/avatars/yk-marketer.png',
    avatarRing: 'ring-rose-400/40',
    role: 'Web マーケター',
    demographic: '20代女性',
    catchphrase:
      'PDCA のスピードが劇的に向上！マーケターが自らクリエイティブを動かせる強み',
    before:
      'これまでは、バナー1枚の制作をデザイナーに依頼するたびに、依頼書の作成や細かな修正のやり取りで数日を要していました。特に AB テストを行いたい時、複数のバナー案を用意するコストと時間がネックになり、スピード感のある施策展開ができないことが最大の悩みでした。',
    after:
      '勝ちバナー作る君を導入してからは、思いついたキャッチコピーをその場で形にできるようになりました。デザイナーの手を煩わせることなく、数分でプロクオリティのバナーが数十パターン完成するため、テストの回数が以前の 5 倍以上に増加。結果として広告の CPA も大幅に改善されました。制作の「待ち時間」がゼロになり、本来集中すべき数値分析や戦略立案に時間を割けるようになったのが一番の収穫です。',
  },
  {
    initials: 'T.S',
    avatarSrc: '/lp/avatars/ts-designer.png',
    avatarRing: 'ring-sky-400/40',
    role: 'デザイナー',
    demographic: '30代男性',
    catchphrase:
      '単純作業からの解放。本来のクリエイティビティを発揮できる環境へ',
    before:
      'デザイナーとして、メインビジュアルの構築やブランディングといった上流工程に時間を割きたい一方で、現実はサイズ展開や文字要素の差し替えといった「定型作業」に追われる毎日でした。膨大なリサイズ作業だけで一日が終わってしまうこともあり、クリエイティブな仕事ができている実感が持てずに疲弊していました。',
    after:
      'このサービスを使い始めてから、ルーチンワークの大部分を AI に任せられるようになりました。驚いたのはその精度の高さです。レイアウトの崩れが少なく、微調整だけで納品レベルに仕上がるため、作業時間は従来の 1/10 以下に。空いた時間でサイト全体の UX 設計や新しい企画に集中できるようになり、仕事の質が劇的に向上しました。',
  },
  {
    initials: 'M.O',
    avatarSrc: '/lp/avatars/mo-owner.png',
    avatarRing: 'ring-amber-400/40',
    role: '物販事業経営者',
    demographic: '30代女性',
    catchphrase:
      '外注コストと納期に縛られない。少数精鋭の事業運営に欠かせない武器',
    before:
      '小規模で物販事業を運営しているため、新商品の発売やセール時期のたびに発生するバナー制作費が大きな負担でした。かといって、デザインの知識がない自分が作るとどうしても「素人感」が出てしまい、クリック率が上がらず売上に結びつかない。外注すれば納期まで 1 週間はかかるため、トレンドを逃してしまうことも多々ありました。',
    after:
      '勝ちバナー作る君を使い始めてから、商品写真をアップするだけでプロ級のバナーが瞬時に手に入るようになり、経営のフットワークが格段に軽くなりました。専門知識がなくても直感的に操作でき、その時のインプレッションを見て即座にクリエイティブを差し替えることができます。結果として、広告経由の売上は前年比で 150% を達成。高額な外注費をかけずにこれだけの成果を出せるのは、まさに救世主のようなツールです。',
  },
];

export const CustomerVoiceSection = () => {
  return (
    <section className="bg-slate-900 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          利用者の声
        </h2>
        <p className="text-slate-400 text-center mt-3">
          実際に「勝ちバナー作る君」を導入して変わった現場の声
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {VOICES.map((v) => (
            <VoiceCard key={v.initials} {...v} />
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-8">
          ※ 掲載されているお客様の声は、ご利用者本人の同意のもと、個人を特定できないようプライバシーに配慮した上で掲載しています。
        </p>
      </div>
    </section>
  );
};

function VoiceCard({
  initials,
  avatarSrc,
  avatarRing,
  role,
  demographic,
  catchphrase,
  before,
  after,
}: (typeof VOICES)[number]) {
  return (
    <article className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
      {/* Header: avatar + role */}
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={`${role} ${initials} さんのアバター`}
          className={`w-14 h-14 rounded-full object-cover shadow-lg ring-2 ${avatarRing}`}
          loading="lazy"
          decoding="async"
          width={56}
          height={56}
        />
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-100">{role}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {demographic} / {initials} さん
          </div>
        </div>
      </header>

      {/* Catchphrase */}
      <p className="text-base font-bold text-emerald-300 leading-relaxed">
        「{catchphrase}」
      </p>

      {/* Before */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="mb-2">
          <span className="inline-block px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-bold tracking-widest">
            BEFORE
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{before}</p>
      </div>

      {/* Arrow */}
      <div
        className="text-center text-emerald-400 text-xl leading-none -my-1"
        aria-hidden
      >
        ↓
      </div>

      {/* After */}
      <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4">
        <div className="mb-2">
          <span className="inline-block px-2 py-0.5 bg-emerald-500 text-slate-950 rounded text-[10px] font-bold tracking-widest">
            AFTER
          </span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">{after}</p>
      </div>
    </article>
  );
}
