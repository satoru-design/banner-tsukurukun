import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { issueInvoice } from "@/lib/billing/stores/issue-invoice";
import { sweepOverdue } from "@/lib/billing/stores/dunning";
import { nextPeriodStart } from "@/lib/billing/stores/period";
import type { PaidPlan } from "@/lib/billing/stores/amounts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prisma = getPrisma();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86400_000);

  const expiring = await prisma.user.findMany({
    where: { plan: { in: ["starter", "pro", "business"] }, planExpiresAt: { lte: soon } },
    select: { id: true, plan: true, planExpiresAt: true },
  });

  let issued = 0;
  for (const u of expiring) {
    try {
      await issueInvoice({
        userId: u.id,
        plan: u.plan as PaidPlan,
        periodStart: nextPeriodStart(u.planExpiresAt, now),
      });
      issued++;
    } catch (e) {
      console.error(`stores-renew issue failed for ${u.id}`, e);
    }
  }

  const sweep = await sweepOverdue(now);
  return NextResponse.json({ ok: true, issued, downgraded: sweep.downgraded.length });
}
