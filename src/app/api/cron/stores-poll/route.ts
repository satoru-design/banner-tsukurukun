import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { reconcileInvoice } from "@/lib/billing/stores/reconcile";
import { verifyCronSecret } from "@/lib/auth/verify-bearer-secret";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prisma = getPrisma();
  const pending = await prisma.invoice.findMany({
    where: { status: "issued", storesPaymentId: { not: null } },
    select: { id: true },
    take: 200,
  });
  let reconciled = 0;
  for (const inv of pending) {
    try {
      await reconcileInvoice(inv.id);
      reconciled++;
    } catch (e) {
      console.error(`stores-poll reconcile failed for ${inv.id}`, e);
    }
  }
  return NextResponse.json({ ok: true, checked: pending.length, reconciled });
}
