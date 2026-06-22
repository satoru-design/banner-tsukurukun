import { getPrisma } from "@/lib/prisma";
import { createPayment } from "@/lib/billing/stores/stores-client";
import { monthlyAmount, type PaidPlan } from "@/lib/billing/stores/amounts";

const PLAN_LABEL: Record<PaidPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export interface IssueInvoiceParams {
  userId: string;
  plan: PaidPlan;
  periodStart: Date; // 当月初 (UTC)
}

export async function issueInvoice({ userId, plan, periodStart }: IssueInvoiceParams) {
  const prisma = getPrisma();

  const existing = await prisma.invoice.findUnique({
    where: { userId_periodStart: { userId, periodStart } },
  });
  if (existing) return existing;

  const amount = monthlyAmount(plan);
  const periodEnd = addMonths(periodStart, 1);
  const dueDays = Number(process.env.STORES_INVOICE_DUE_DAYS ?? "7");
  const now = new Date();
  const dueDate = addDays(now, dueDays);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const invoice = await prisma.invoice.create({
    data: { userId, plan, amount, periodStart, periodEnd, status: "issued", dueDate, issuedAt: now },
  });

  const payment = await createPayment({
    amount,
    subject: `autobanner.jp ${PLAN_LABEL[plan]} 月額`,
    description: `invoice=${invoice.id} period=${periodStart.toISOString().slice(0, 10)}`,
    metadata: { userId, invoiceId: invoice.id },
    redirectUrl: `${appUrl}/account/billing?paid=1`,
    cancelUrl: `${appUrl}/account/billing?canceled=1`,
    webhookUrl: `${appUrl}/api/billing/stores/webhook?token=${process.env.STORES_WEBHOOK_SECRET ?? ""}`,
  });

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { storesPaymentId: payment.id, paymentUrl: payment.links.paymentUrl },
  });
}
