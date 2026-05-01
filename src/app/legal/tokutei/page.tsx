import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: '勝ちバナー作る君（autobanner.jp）の特定商取引法に基づく表記。',
  robots: { index: true, follow: true },
};

export default function TokuteiPage() {
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-50 mb-2">
        特定商取引法に基づく表記
      </h1>
      <p className="text-sm text-slate-400 mb-8">最終更新日：2026年5月1日</p>

      <table className="w-full text-sm border-collapse mb-10">
        <tbody>
          <Row label="事業者名" value="株式会社4th Avenue Lab" />
          <Row label="代表者" value="代表取締役 小池 慧" />
          <Row label="所在地" value={<>〒154-0003<br />東京都世田谷区野沢4-2-6</>} />
          <Row
            label="電話番号"
            value="ご請求があった場合に遅滞なく開示いたします。お問合せフォームよりご連絡ください。"
          />
          <Row label="メールアドレス" value="satoru@4thavenuelab.net" />
          <Row
            label="お問合せ窓口"
            value={
              <a href="/contact" className="text-emerald-300 hover:text-emerald-200 underline">
                https://autobanner.jp/contact
              </a>
            }
          />
          <Row label="サービス名" value="勝ちバナー作る君（autobanner.jp）" />
          <Row label="販売価格" value="下記のとおり（すべて税込）" />
        </tbody>
      </table>

      <h2 className="text-xl font-bold text-slate-100 border-b border-slate-800 pb-2 mb-3 mt-8">
        販売価格
      </h2>
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left py-2 px-3 text-slate-400 font-medium">プラン</th>
            <th className="text-left py-2 px-3 text-slate-400 font-medium">月額（税込）</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-800/50">
            <td className="py-2 px-3 text-slate-200">Free</td>
            <td className="py-2 px-3 text-slate-200">¥0</td>
          </tr>
          <tr className="border-b border-slate-800/50">
            <td className="py-2 px-3 text-slate-200">Starter</td>
            <td className="py-2 px-3 text-slate-200">¥3,980</td>
          </tr>
          <tr>
            <td className="py-2 px-3 text-slate-200">Pro</td>
            <td className="py-2 px-3 text-slate-200">¥14,800（月100セッションまで）</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-slate-300 leading-relaxed mb-6">
        Pro プランは月100セッションを超えた分について、1セッションあたり80円（税込）の従量課金が発生します。
      </p>

      <Section title="商品代金以外に必要な料金">
        <p>
          当サイトの閲覧、サービスの利用にかかるインターネット接続料金、通信料金等は、お客様のご負担となります。
        </p>
      </Section>

      <Section title="お支払方法">
        <p>クレジットカード（Visa / Mastercard / American Express / JCB / Diners Club / Discover）</p>
      </Section>

      <Section title="お支払時期">
        <ul className="list-disc pl-6 space-y-1">
          <li>初回：お申込み時に Stripe Checkout にて決済</li>
          <li>2回目以降：毎月、申込日と同日に自動課金</li>
        </ul>
      </Section>

      <Section title="サービスの提供時期">
        <p>お申込み完了後、即時にご利用いただけます。</p>
      </Section>

      <Section title="解約・返金について">
        <ul className="list-disc pl-6 space-y-1">
          <li>解約はいつでも Customer Portal（マイページ）から行えます。</li>
          <li>解約予約をいただいた場合、当月末までは引き続きご利用いただけます（日割り返金は行いません）。</li>
          <li>デジタルサービスの性質上、お申込み後の返金には原則として応じかねます。</li>
          <li>ただし、当社の責に帰すべき事由（システム障害等）でサービスを提供できなかった場合は、お申し出により対応いたします。</li>
        </ul>
      </Section>

      <Section title="カスタマーサポート対応時間">
        <p>祝祭日を除く平日 10:00〜17:00（2 営業日以内のご返信を目安としています）</p>
      </Section>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-800/50">
      <th className="text-left py-3 px-3 text-slate-400 font-medium w-40 align-top">{label}</th>
      <td className="py-3 px-3 text-slate-200 leading-relaxed">{value}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xl font-bold text-slate-100 border-b border-slate-800 pb-2 mb-3 mt-8">
        {title}
      </h2>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}
