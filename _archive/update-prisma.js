const fs = require('fs');
let content = fs.readFileSync('src/app/api/save-banner/route.ts', 'utf-8');

// Replace top-level Prisma
content = content.replace(/const prisma = new PrismaClient\(\);\n/g, "");

// Inject inside POST
content = content.replace(/export async function POST\(req: Request\) \{/g, `let prisma;\nexport async function POST(req: Request) {\n  if(!prisma) prisma = new PrismaClient();\n`);

// Inject inside GET
content = content.replace(/export async function GET\(req: Request\) \{/g, `export async function GET(req: Request) {\n  if(!prisma) prisma = new PrismaClient();\n`);

fs.writeFileSync('src/app/api/save-banner/route.ts', content, 'utf-8');
console.log("Prisma singleton fixed");
