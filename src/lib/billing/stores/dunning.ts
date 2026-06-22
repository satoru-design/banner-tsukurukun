import { getPrisma } from "@/lib/prisma";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function sweepOverdue(now: Date) {
  const prisma = getPrisma();
  const grace = Number(process.env.STORES_GRACE_DAYS ?? "3");
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["issued", "overdue"] } },
    select: { id: true, userId: true, dueDate: true, status: true },
  });

  const downgraded: string[] = [];
  for (const inv of candidates) {
    const deadline = addDays(new Date(inv.dueDate), grace);
    if (now > deadline) {
      await prisma.user.update({ where: { id: inv.userId }, data: { plan: "free" } });
      if (inv.status !== "overdue") {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
      }
      downgraded.push(inv.userId);
    }
  }
  return { downgraded };
}
