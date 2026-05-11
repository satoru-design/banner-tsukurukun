/**
 * Phase 2: batch-generate 用の admin user 取得ヘルパー。
 *
 * 環境変数 ADMIN_EMAILS の先頭 email を「admin user」とみなし、
 * Generation/GenerationImage 履歴をその user 名義で保存する。
 * meta-ads-autopilot のドッグフーディング由来の生成物を1ユーザーに集約する目的。
 */
import { getPrisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export async function getBatchGenerateAdminUser(): Promise<User> {
  // ADMIN_EMAILS is "最低1件は必須" per .env.example (admin user list, distinct from
  // ALLOWED_EMAILS which can be empty in production-public mode since 2026-05-01).
  const adminList = process.env.ADMIN_EMAILS;
  if (!adminList) {
    throw new Error('ADMIN_EMAILS env is not set');
  }
  const adminEmail = adminList.split(',')[0].trim().toLowerCase();
  if (!adminEmail) {
    throw new Error('ADMIN_EMAILS first entry is empty');
  }
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: adminEmail },
  });
  if (!user) {
    throw new Error(`Admin user not found in DB: ${adminEmail}. Sign in via web app at least once.`);
  }
  return user;
}
