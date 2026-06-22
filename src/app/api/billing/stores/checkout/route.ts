import { NextResponse } from "next/server";
import { issueInvoice } from "@/lib/billing/stores/issue-invoice";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { PaidPlan } from "@/lib/billing/stores/amounts";

export const dynamic = "force-dynamic";

const PAID: PaidPlan[] = ["starter", "pro", "business"];

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function POST(req: Request) {
  // I1: guard against provider split-brain — must be BEFORE auth
  if ((process.env.PAYMENT_PROVIDER ?? "stripe") !== "stores") {
    return NextResponse.json({ error: "provider mismatch" }, { status: 409 });
  }

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = (await req.json()) as { plan?: string };
  if (!plan || !PAID.includes(plan as PaidPlan)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const invoice = await issueInvoice({
    userId,
    plan: plan as PaidPlan,
    periodStart: monthStartUTC(new Date()),
  });

  return NextResponse.json({ invoiceId: invoice.id, paymentUrl: invoice.paymentUrl });
}
