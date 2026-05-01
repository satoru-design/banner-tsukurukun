import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: '勝ちバナー作る君（autobanner.jp）のプライバシーポリシー。',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-50 mb-2">
        プライバシーポリシー
      </h1>
      <p className="text-sm text-slate-400 mb-8">最終更新日：2026年5月1日</p>

      <p className="text-sm text-slate-300 leading-relaxed mb-8">
        株式会社4th Avenue Lab（以下「当社」といいます）は、本ウェブサイトおよび「勝ちバナー作る君」（autobanner.jp、以下「本サービス」といいます）における、利用者の個人情報の取扱いについて、以下のとおり定めます。
      </p>

      <Article num="1" title="取得する個人情報">
        <p className="mb-2">当社は、本サービスの提供にあたり、以下の個人情報を取得する場合があります。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>メールアドレス（Google アカウント認証時に取得）</li>
          <li>お名前（Google アカウントのプロフィール）</li>
          <li>プロフィール画像（Google アカウントのプロフィール）</li>
          <li>決済情報（Stripe 経由で処理されます。クレジットカード番号自体は当社のサーバーには保存されません）</li>
          <li>IP アドレス、Cookie、ブラウザ情報、アクセスログ</li>
          <li>お問合せフォーム等で入力された会社名・電話番号・お問合せ内容</li>
          <li>本サービス上で生成されたバナー画像、入力されたブリーフ情報</li>
        </ul>
      </Article>

      <Article num="2" title="個人情報の利用目的">
        <p className="mb-2">取得した個人情報は、以下の目的で利用します。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サービスの提供および本人確認</li>
          <li>料金の請求およびお支払いの確認</li>
          <li>お問合せへの対応</li>
          <li>本サービスに関する重要なお知らせの送信（メール）</li>
          <li>サービスの改善・新機能開発のための分析</li>
          <li>不正利用の検知および防止</li>
          <li>マーケティング施策の効果測定</li>
        </ul>
      </Article>

      <Article num="3" title="第三者提供">
        <p className="mb-2">当社は、以下の場合を除き、利用者の同意なく個人情報を第三者に提供することはありません。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>法令に基づく場合</li>
          <li>人の生命・身体・財産の保護のために必要な場合であって、本人の同意を得ることが困難なとき</li>
          <li>業務委託先（決済代行：Stripe / ホスティング：Vercel / メール：Google Workspace 等）に対し、利用目的の達成に必要な範囲で情報を提供する場合</li>
        </ul>
      </Article>

      <Article num="4" title="外国にある第三者への個人情報の提供（越境移転）">
        <p className="mb-3">
          本サービスの提供にあたり、当社は以下の事業者に対し、個人情報の取扱いを委託する場合があります。これらの委託先は日本国外（主に米国）に所在し、現地法令に基づき個人情報を取り扱います。利用者は本ポリシーに同意することにより、これらの外国にある第三者への個人情報の提供に同意するものとします。
        </p>
        <table className="w-full text-xs border-collapse mb-3">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 px-2 text-slate-400 font-medium">事業者</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">所在国</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">委託内容</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Vercel, Inc.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">ホスティング・ファイル保存</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Stripe, Inc.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">決済処理</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Google LLC</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">認証・分析・タグ管理</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Microsoft Corporation</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">UX 分析（Clarity）</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Meta Platforms, Inc.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">広告効果測定</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">OpenAI, L.L.C.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">画像生成 AI 処理</td></tr>
            <tr className="border-b border-slate-800/50"><td className="py-2 px-2">Replicate, Inc.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">画像生成 AI 処理</td></tr>
            <tr><td className="py-2 px-2">Neon Inc.</td><td className="py-2 px-2">米国</td><td className="py-2 px-2">データベースホスティング</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-400">
          各国の個人情報保護に関する制度については、個人情報保護委員会のウェブサイト（
          <a href="https://www.ppc.go.jp/personalinfo/legal/kaiseihogohou/" className="text-emerald-300 hover:text-emerald-200 underline" target="_blank" rel="noreferrer">
            https://www.ppc.go.jp/
          </a>
          ）をご参照ください。各事業者は SCC（標準契約条項）または当該国における同等の保護措置を講じています。
        </p>
      </Article>

      <Article num="5" title="外部サービスの利用">
        <p className="mb-3">
          本サービスでは、利用状況の分析、広告効果測定、決済処理等のため、以下の外部サービスを利用しています。これらのサービスでは Cookie や類似技術を使用してデータが収集される場合があります。
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>
            <strong>Google Analytics 4</strong>：利用状況の集計・分析（Google LLC）
          </li>
          <li>
            <strong>Microsoft Clarity</strong>：ヒートマップ・セッション再生（Microsoft Corporation）
          </li>
          <li>
            <strong>Google Tag Manager</strong>：上記タグの一元管理（Google LLC）
          </li>
          <li>
            <strong>Meta Pixel</strong>：広告効果測定（Meta Platforms, Inc.）
          </li>
          <li>
            <strong>Stripe</strong>：決済処理（Stripe, Inc.）
          </li>
          <li>
            <strong>Vercel / Vercel Blob</strong>：ホスティングおよびファイル保存（Vercel, Inc.）
          </li>
          <li>
            <strong>OpenAI / Google AI / Replicate</strong>：画像生成 AI の処理（各社）
          </li>
        </ul>
        <p className="text-xs text-slate-400">
          各サービスのプライバシーポリシーは、それぞれの提供事業者のサイトにてご確認ください。
        </p>
      </Article>

      <Article num="6" title="Cookie の利用">
        <p>
          本サービスは、利便性向上および利用状況分析のため Cookie を使用します。Cookie の受け入れを拒否したい場合は、ブラウザの設定で無効化することができますが、その場合一部機能が利用できなくなる可能性があります。
        </p>
      </Article>

      <Article num="7" title="個人情報の開示・訂正・削除">
        <p>
          利用者は、当社が保有する自己の個人情報について、開示・訂正・追加・削除・利用停止を請求することができます。請求にあたっては、お問合せフォーム（
          <a href="/contact" className="text-emerald-300 hover:text-emerald-200 underline">
            https://autobanner.jp/contact
          </a>
          ）よりご連絡ください。当社は、ご本人確認を行ったうえで、合理的な範囲で速やかに対応いたします。
        </p>
      </Article>

      <Article num="8" title="個人情報の保管期間">
        <p>
          個人情報は、利用目的の達成に必要な期間、または法令で定められた期間保管した後、適切に削除いたします。サービス解約後の保管期間については、契約終了後5年間を目安としますが、法令上の保存義務がある情報についてはその期間に従います。
        </p>
      </Article>

      <Article num="9" title="プライバシーポリシーの変更">
        <p>
          当社は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは autobanner.jp 上に掲示した時点から効力を生じるものとします。重要な変更については、利用者に対し相当な方法で通知します。
        </p>
      </Article>

      <Article num="10" title="お問合せ窓口">
        <p className="mb-3">本ポリシーに関するお問合せは、以下の窓口までお願いいたします。</p>
        <table className="w-full text-sm border-collapse">
          <tbody>
            <Row label="事業者名" value="株式会社4th Avenue Lab" />
            <Row label="所在地" value={<>〒154-0003 東京都世田谷区野沢4-2-6</>} />
            <Row label="代表者" value="代表取締役 小池 慧" />
            <Row
              label="お問合せフォーム"
              value={
                <a href="/contact" className="text-emerald-300 hover:text-emerald-200 underline">
                  https://autobanner.jp/contact
                </a>
              }
            />
            <Row label="対応時間" value="祝祭日を除く平日 10:00〜17:00" />
          </tbody>
        </table>
      </Article>

      <p className="text-xs text-slate-500 mt-12 pt-6 border-t border-slate-800">以上</p>
    </>
  );
}

function Article({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-100 mb-3">
        第{num}条（{title}）
      </h2>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-800/50">
      <th className="text-left py-2 px-3 text-slate-400 font-medium w-32 align-top">{label}</th>
      <td className="py-2 px-3 text-slate-200 leading-relaxed">{value}</td>
    </tr>
  );
}
