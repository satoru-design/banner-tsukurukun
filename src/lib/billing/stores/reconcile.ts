import { getPrisma } from "@/lib/prisma";
import { getPayment, type StoresStatus } from "@/lib/billing/stores/stores-client";

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

// "paid" and "canceled" are both terminal — no further reconciliation needed
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
      // M3: conditional claim — only the first concurrent caller wins
      const claimed = await (tx as typeof prisma).invoice.updateMany({
        where: { id: invoice.id, status: "issued" },
        data: { status: "paid", paidAt },
      });
      if (claimed.count === 0) {
        // Another process already claimed this invoice; do nothing
        return (tx as typeof prisma).invoice.findUnique({ where: { id: invoice.id } });
      }

      // Only the winner extends the plan
      const user = await (tx as typeof prisma).user.findUnique({ where: { id: invoice.userId } });
      const now = new Date();
      const base = user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
      await (tx as typeof prisma).user.update({
        where: { id: invoice.userId },
        data: { plan: invoice.plan, planStartedAt: now, planExpiresAt: addMonths(base, 1) },
      });
      return (tx as typeof prisma).invoice.findUnique({ where: { id: invoice.id } });
    });
  }

  // C3: STORES "cancelled" (customer cancellation) → terminal "canceled"
  //     STORES "expired" (payment timeout) → dunnable "overdue"
  if (s === "cancelled") {
    return prisma.invoice.update({ where: { id: invoice.id }, data: { status: "canceled" } });
  }

  if (s === "expired") {
    return prisma.invoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });
  }

  return invoice; // open / refunded
}
