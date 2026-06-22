import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prisma = getPrisma();
  const now = new Date();
  const lapsed = await prisma.user.findMany({
    where: {
      plan: { in: ["starter", "pro", "business"] },
      planExpiresAt: { not: null, lt: now },
    },
    select: { id: true },
  });
  let downgraded = 0;
  for (const u of lapsed) {
    try {
      await prisma.user.update({ where: { id: u.id }, data: { plan: "free" } });
      downgraded++;
    } catch (e) {
      console.error(`stores-renew downgrade failed for ${u.id}`, e);
    }
  }
  return NextResponse.json({ ok: true, downgraded });
}
