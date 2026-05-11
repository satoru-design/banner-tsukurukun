import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifyBatchGenerateAuth } from '@/lib/batch-generate/auth';
import { getBatchGenerateAdminUser } from '@/lib/batch-generate/admin-user';
import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';

export const runtime = 'nodejs';
// 順次生成で最大 20 本 × 各 ~30s = ~10min を想定。Vercel Pro 上限 800s 以内に収める。
export const maxDuration = 800;

const MAX_BATCH_SIZE = 20;

type BatchResult =
  | { index: number; ok: true; imageUrl: string; generationId: string; provider: string }
  | { index: number; ok: false; error: string };

export async function POST(req: Request): Promise<Response> {
  // 1. 認証
  if (!verifyBatchGenerateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. パース
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. バリデーション
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be object' }, { status: 400 });
  }
  const materials = (body as { materials?: unknown }).materials;
  if (!Array.isArray(materials)) {
    return NextResponse.json({ error: 'materials must be an array' }, { status: 400 });
  }
  if (materials.length === 0) {
    return NextResponse.json({ error: 'materials must have at least 1 item' }, { status: 400 });
  }
  if (materials.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `materials exceeds max batch size (${MAX_BATCH_SIZE})` },
      { status: 400 },
    );
  }

  // 4. admin user 解決
  let adminUser;
  try {
    adminUser = await getBatchGenerateAdminUser();
  } catch (e) {
    console.error('[batch-generate] admin user resolve failed:', e);
    return NextResponse.json(
      { error: 'Admin user resolution failed', details: (e as Error).message },
      { status: 500 },
    );
  }

  const requestId = randomUUID();
  const results: BatchResult[] = [];

  // 5. TODO Task 6: 順次生成ループをここに追加
  // 一旦は materials.length 分の placeholder を返して骨組みの動作確認
  for (let i = 0; i < materials.length; i++) {
    results.push({
      index: i,
      ok: false,
      error: 'not_implemented_yet (Task 6 で実装)',
    });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    success: succeeded > 0,
    requestId,
    adminUserId: adminUser.id,  // デバッグ用。Task 6 でレスポンスから削除予定
    results,
    summary: { total: materials.length, succeeded, failed },
  });
}
