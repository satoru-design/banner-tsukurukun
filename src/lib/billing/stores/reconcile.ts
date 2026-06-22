import { getPrisma } from "@/lib/prisma";
import { getPayment, type StoresStatus } from "@/lib/billing/stores/stores-client";

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

const TERMINAL = new Set(["paid", "canceled"]);

export async function reconcileInvoice(invoiceId: string) {
  const prisma = getPrisma();
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error(`invoice not found: ${invoiceId}`);
  if (TERMINAL.has(invoice.status)) return invoice; // 冪等
  if (!invoice.storesPaymentId) return invoice;

  const payment = await getPayment(invoice.storesPaymentId);
  const s: StoresStatus = payment.status;

  if (s === "paid") {
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    return prisma.$transaction(async (tx) => {
      const user = await (tx as typeof prisma).user.findUnique({ where: { id: invoice.userId } });
      const now = new Date();
      const base = user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
      await (tx as typeof prisma).user.update({
        where: { id: invoice.userId },
        data: { plan: invoice.plan, planStartedAt: now, planExpiresAt: addMonths(base, 1) },
      });
      return (tx as typeof prisma).invoice.update({ where: { id: invoice.id }, data: { status: "paid", paidAt } });
    });
  }

  if (s === "expired" || s === "cancelled") {
    return prisma.invoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });
  }

  return invoice; // open / refunded
}
