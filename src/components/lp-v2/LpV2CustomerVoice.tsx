const VOICES = [
  {
    initials: 'Y.K',
    avatarSrc: '/lp/avatars/yk-marketer.webp',
    avatarRing: 'ring-rose-300/60',
    role: 'Web マーケター',
    demographic: '20代女性',
    proofBadge: 'AB テスト施策数を大幅増',
    catchphrase: 'PDCA のスピードが劇的に向上！マーケターが自らクリエイティブを動かせる強み',
    before: 'これまでは、バナー1枚の制作をデザイナーに依頼するたびに、依頼書の作成や細かな修正のやり取りで数日を要していました。特に AB テストを行いたい時、複数のバナー案を用意するコストと時間がネックになり、スピード感のある施策展開ができないことが最大の悩みでした。',
    after: '勝ちバナー作る君を導入してからは、思いついたキャッチコピーをその場で形にできるようになりました。デザイナーの手を煩わせることなく、数分でプロクオリティのバナーが何パターンも完成するため、AB テストの回数を以前より大幅に増やせています。制作の「待ち時間」がほぼなくなり、本来集中すべき数値分析や戦略立案に時間を割けるようになったのが一番の収穫です。',
  },
  {
    initials: 'T.S',
    avatarSrc: '/lp/avatars/ts-designer.webp',
    avatarRing: 'ring-sky-300/60',
    role: 'デザイナー',
    demographic: '30代男性',
    proofBadge: '上流工程に時間を投下',
    catchphrase: '単純作業からの解放。本来のクリエイティビティを発揮できる環境へ',
    before: 'デザイナーとして、メインビジュアルの構築やブランディングといった上流工程に時間を割きたい一方で、現実はサイズ展開や文字要素の差し替えといった「定型作業」に追われる毎日でした。膨大なリサイズ作業だけで一日が終わってしまうこともあり、クリエイティブな仕事ができている実感が持てずに疲弊していました。',
    after: 'このサービスを使い始めてから、ルーチンワークの大部分を AI に任せられるようになりました。驚いたのはその精度の高さです。レイアウトの崩れが少なく、微調整だけで納品レベルに仕上がるため、リサイズ作業に費やしていた時間が大幅に短縮されました。空いた時間でサイト全体の UX 設計や新しい企画に集中できるようになり、仕事の質が劇的に向上しました。',
  },
  {
    initials: 'M.O',
    avatarSrc: '/lp/avatars/mo-owner.webp',
    avatarRing: 'ring-amber-300/60',
    role: '物販事業経営者',
    demographic: '30代女性',
    proofBadge: '外注コスト・納期から解放',
    catchphrase: '外注コストと納期に縛られない。少数精鋭の事業運営に欠かせない武器',
    before: '小規模で物販事業を運営しているため、新商品の発売やセール時期のたびに発生するバナー制作費が大きな負担でした。かといって、デザインの知識がない自分が作るとどうしても「素人感」が出てしまい、クリック率が上がらず売上に結びつかない。外注すれば納期まで 1 週間はかかるため、トレンドを逃してしまうことも多々ありました。',
    after: '勝ちバナー作る君を使い始めてから、商品写真をアップするだけでプロ級のバナーが瞬時に手に入るようになり、経営のフットワークが格段に軽くなりました。専門知識がなくても直感的に操作でき、その時のインプレッションを見て即座にクリエイティブを差し替えることができます。高額な外注費をかけずに広告施策が回せるようになり、少数精鋭の運営に欠かせないツールになっています。',
  },
];

export const LpV2CustomerVoice = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            Voices
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 leading-snug">
            導入後に起きた、現場のリアルな変化
          </h2>
          <p className="text-sm text-slate-500 mt-4">
            マーケター・デザイナー・経営者、それぞれの「止まりごと」を解いた事例
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {VOICES.map((v) => (
            <VoiceCard key={v.initials} {...v} />
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-10">
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
  proofBadge,
  catchphrase,
  before,
  after,
}: (typeof VOICES)[number]) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={`${role} ${initials} さんのアバター`}
          className={`w-14 h-14 rounded-full object-cover ring-2 ${avatarRing}`}
          loading="lazy"
          decoding="async"
          width={56}
          height={56}
        />
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-900">{role}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {demographic} / {initials} さん
          </div>
        </div>
      </header>

      <div>
        <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-700/10 border border-emerald-700/25 px-3 py-1.5 rounded-full">
          {proofBadge}
        </span>
      </div>

      <p className="text-base font-bold text-emerald-800 leading-relaxed">
        「{catchphrase}」
      </p>

      <div className="bg-stone-50 border border-slate-200 rounded-lg p-4">
        <div className="mb-2">
          <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold tracking-widest">
            BEFORE
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{before}</p>
      </div>

      <div className="text-center text-emerald-700 text-base leading-none -my-1" aria-hidden>
        ↓
      </div>

      <div className="bg-emerald-700/5 border border-emerald-700/25 rounded-lg p-4">
        <div className="mb-2">
          <span className="inline-block px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold tracking-widest">
            AFTER
          </span>
        </div>
        <p className="text-xs text-slate-800 leading-relaxed">{after}</p>
      </div>
    </article>
  );
}
