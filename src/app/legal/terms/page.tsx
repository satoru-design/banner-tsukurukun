import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約',
  description: '勝ちバナー作る君（autobanner.jp）の利用規約。',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-50 mb-2">利用規約</h1>
      <p className="text-sm text-slate-400 mb-8">最終更新日：2026年5月1日</p>

      <p className="text-sm text-slate-300 leading-relaxed mb-8">
        この利用規約（以下「本規約」といいます）は、株式会社4th Avenue Lab（以下「当社」といいます）が提供するバナー自動生成サービス「勝ちバナー作る君」（autobanner.jp、以下「本サービス」といいます）の利用条件を定めるものです。本サービスをご利用いただくお客様（以下「利用者」といいます）には、本規約に同意のうえご利用いただきます。
      </p>

      <Article num="1" title="適用">
        <p>
          本規約は、利用者と当社との間の本サービスの利用に関わる一切の関係に適用されます。当社が本サービス上で別途掲示する個別規定は、本規約の一部を構成するものとします。
        </p>
      </Article>

      <Article num="2" title="利用登録">
        <ol className="list-decimal pl-6 space-y-2">
          <li>本サービスの利用にあたっては、Google アカウントによる認証を行うものとします。</li>
          <li>当社は、利用希望者が以下のいずれかに該当する場合、利用登録を承認しないことがあります。
            <ul className="list-disc pl-6 mt-1 space-y-1">
              <li>申請内容に虚偽の事項が含まれている場合</li>
              <li>過去に本規約違反等により利用停止となった者である場合</li>
              <li>反社会的勢力に関係する者と当社が判断した場合</li>
              <li>その他、当社が利用登録を相当でないと判断した場合</li>
            </ul>
          </li>
        </ol>
      </Article>

      <Article num="3" title="料金および支払方法">
        <ol className="list-decimal pl-6 space-y-2">
          <li>本サービスの料金は、当社の定める料金プラン（autobanner.jp 等に表示）に従います。</li>
          <li>利用者は、Stripe を通じてクレジットカードで料金を支払うものとします。</li>
          <li>月次サブスクリプションは、申込日と同日に自動更新および課金されます。</li>
          <li>Pro プランの月間上限を超えた分については、1セッションあたり80円（税込）の従量課金が発生します。</li>
        </ol>
      </Article>

      <Article num="4" title="禁止事項">
        <p className="mb-2">利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>当社、他の利用者、または第三者の著作権、肖像権、プライバシー権その他の権利を侵害する行為</li>
          <li>当社のサービスの運営を妨害するおそれのある行為</li>
          <li>不正アクセスをし、またはこれを試みる行為</li>
          <li>反社会的勢力に対して直接または間接に利益を供与する行為</li>
          <li>本サービスを利用して、薬機法・景品表示法・特定商取引法等の関連法規に違反する広告物を制作する行為</li>
          <li>その他、当社が不適切と判断する行為</li>
        </ul>
      </Article>

      <Article num="5" title="生成物の権利と責任">
        <ol className="list-decimal pl-6 space-y-2">
          <li>本サービスにより生成されたバナーの利用権は利用者に帰属します。</li>
          <li>ただし、生成物が第三者の権利を侵害する内容であった場合、その責任は利用者が負うものとします。</li>
          <li>利用者は、生成物を商用利用する前に、薬機法・景品表示法等の関連法規に違反していないかを自ら確認する責任を負います。当社は生成物の法令適合性を保証するものではありません。</li>
        </ol>
      </Article>

      <Article num="6" title="サービスの提供の停止等">
        <p className="mb-2">
          当社は、以下のいずれかの事由があると判断した場合、利用者に事前通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サービスの保守点検または更新を行う場合</li>
          <li>地震、落雷、火災、停電または天災により本サービスの提供が困難となった場合</li>
          <li>外部 AI サービス提供事業者（OpenAI / Google 等）の障害により本サービスの提供が困難となった場合</li>
          <li>その他、当社が本サービスの提供が困難と判断した場合</li>
        </ul>
      </Article>

      <Article num="7" title="解約">
        <ol className="list-decimal pl-6 space-y-2">
          <li>利用者は、Customer Portal（マイページ）からいつでも解約手続きを行うことができます。</li>
          <li>解約手続き後も、当該課金期間の末日までは本サービスを利用できます。</li>
          <li>既にお支払いいただいた料金の返金は、原則として行いません。</li>
        </ol>
      </Article>

      <Article num="8" title="免責事項">
        <ol className="list-decimal pl-6 space-y-2">
          <li>当社は、本サービスに事実上または法律上の瑕疵（安全性、確実性、有用性、特定の目的への適合性等の欠陥を含みます）がないことを明示的にも黙示的にも保証しておりません。</li>
          <li>当社は、本サービスに起因して利用者に生じたあらゆる損害について、当社の故意または重過失による場合を除き、一切の責任を負いません。</li>
          <li>当社の責任が認められる場合であっても、損害賠償の上限額は、当該事象発生時までに当該利用者が当社に支払った直近1ヶ月分の料金を上限とします。</li>
          <li>
            前各項の規定にかかわらず、利用者が消費者契約法上の消費者に該当する場合、消費者契約法その他の強行法規により当社が責任を免除または制限することができないと定められている範囲においては、本条の免責規定は適用されません。この場合、当社は法令の認める範囲で責任を負うものとします。
          </li>
        </ol>
      </Article>

      <Article num="9" title="規約の変更">
        <p>
          当社は、必要と判断した場合には、本規約を変更することができるものとします。変更後の規約は、autobanner.jp 上に掲示した時点から効力を生じます。重要な変更については、利用者に対し相当な方法で通知します。
        </p>
      </Article>

      <Article num="10" title="準拠法・裁判管轄">
        <ol className="list-decimal pl-6 space-y-2">
          <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
          <li>本サービスに関して紛争が生じた場合には、東京地方裁判所を専属的合意管轄裁判所とします。</li>
        </ol>
      </Article>

      <p className="text-xs text-slate-500 mt-12 pt-6 border-t border-slate-800">
        以上
      </p>
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
