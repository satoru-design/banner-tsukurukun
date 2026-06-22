import { getPrisma } from "@/lib/prisma";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

// M4: validate numeric env var, fall back to default on invalid value
function intEnv(name: string, dflt: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= 0 ? n : dflt;
}

export async function sweepOverdue(now: Date) {
  const prisma = getPrisma();
  const grace = intEnv("STORES_GRACE_DAYS", 3);
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["issued", "overdue"] } },
    select: { id: true, userId: true, dueDate: true, status: true },
  });

  const downgraded: string[] = [];
  for (const inv of candidates) {
    const deadline = addDays(new Date(inv.dueDate), grace);
    if (now > deadline) {
      // C1: skip downgrade if user still has valid entitlement
      const user = await prisma.user.findUnique({
        where: { id: inv.userId },
        select: { planExpiresAt: true },
      });
      if (user?.planExpiresAt && user.planExpiresAt > now) {
        continue; // still entitled — do not downgrade
      }

      await prisma.user.update({ where: { id: inv.userId }, data: { plan: "free" } });
      if (inv.status !== "overdue") {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
      }
      downgraded.push(inv.userId);
    }
  }
  return { downgraded };
}
