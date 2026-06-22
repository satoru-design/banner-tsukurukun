// READ-ONLY migration report: list paid users for Stores invoice payment migration
// Usage: DATABASE_URL=<connection_string> node scripts/stores-migration-report.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const users = await prisma.user.findMany({
  where: { plan: { in: ["starter", "pro", "business"] } },
  select: {
    id: true,
    email: true,
    plan: true,
    planExpiresAt: true,
    stripeSubscriptionId: true,
  },
  orderBy: { planExpiresAt: "asc" },
});

console.log(`paid users: ${users.length}`);
for (const u of users) {
  console.log(
    [
      u.email,
      u.plan,
      u.planExpiresAt?.toISOString() ?? "-",
      u.stripeSubscriptionId ?? "-",
    ].join("\t")
  );
}

await prisma.$disconnect();
