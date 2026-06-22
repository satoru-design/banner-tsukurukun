import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { reconcileInvoice } from "@/lib/billing/stores/reconcile";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.STORES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let paymentId: string | undefined;
  try {
    const body = (await req.json()) as { id?: string };
    paymentId = body?.id;
  } catch {
    /* body is untrusted; ignore parse errors */
  }

  if (paymentId) {
    const prisma = getPrisma();
    const invoice = await prisma.invoice.findFirst({ where: { storesPaymentId: paymentId } });
    if (invoice) await reconcileInvoice(invoice.id);
  }

  return NextResponse.json({ ok: true });
}
