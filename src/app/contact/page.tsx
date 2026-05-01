import { LpHeader } from '@/components/lp/LpHeader';
import { LpFooter } from '@/components/lp/LpFooter';
import { ContactForm } from './ContactForm';

/**
 * Phase A.15: /contact = Plan C 個別商談 問合せページ
 *
 * 月 100 回超 / 代理店契約 / カスタム機能 などの大規模相談を受ける窓口。
 * Formspree (xaqaazaz) 経由で satoru@4thavenuelab.net に転送。
 */
export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpHeader />
      <main className="flex-1">
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
            大規模ご利用 / 代理店契約のご相談
          </h1>
          <p className="text-slate-400 text-center mt-4 leading-relaxed">
            月 100 回を超えるご利用 / 代理店契約・複数名利用 / カスタム機能などのご要望はこちら。<br />
            2 営業日以内（祝祭日を除く平日 10:00〜17:00 受付）を目安に satoru@4thavenuelab.net から返信いたします。
          </p>
          <div className="mt-10 bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8">
            <ContactForm />
          </div>
          <p className="text-xs text-slate-500 text-center mt-6">
            個人プラン（Free / Starter / Pro）への切替は{' '}
            <a href="/lp01#pricing" className="text-emerald-300 hover:text-emerald-200 underline">
              料金ページ
            </a>{' '}
            から
          </p>
        </section>
      </main>
      <LpFooter />
    </div>
  );
}
