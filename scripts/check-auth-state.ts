import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  const sessions = await prisma.session.findMany();
  const accounts = await prisma.account.findMany();

  console.log('=== Users ===');
  console.log(JSON.stringify(users, null, 2));
  console.log('=== Sessions count ===', sessions.length);
  console.log('=== Accounts count ===', accounts.length);
  if (sessions.length > 0) console.log('Latest session:', sessions[sessions.length - 1]);
  if (accounts.length > 0) console.log('Latest account provider:', accounts[accounts.length - 1].provider);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
