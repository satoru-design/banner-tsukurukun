import { Resend } from "resend";

export interface InvoiceEmailParams {
  to: string;
  plan: string;
  paymentUrl: string;
}

export async function sendInvoiceEmail({ to, plan, paymentUrl }: InvoiceEmailParams) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY / MAIL_FROM is not set");
  const resend = new Resend(key);
  return resend.emails.send({
    to,
    from,
    subject: `【autobanner.jp】${plan} のお支払いのご案内`,
    html: `<p>autobanner.jp ${plan} のお支払いをお願いいたします。</p>
<p><a href="${paymentUrl}">こちらからカード決済</a></p>`,
  });
}
