import { NextResponse } from 'next/server';
import { verifyBatchGenerateAuth } from '@/lib/batch-generate/auth';
import { saveBatchReject } from '@/lib/batch-generate/rejects';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  if (!verifyBatchGenerateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be object' }, { status: 400 });
  }
  const { reason, materials, generationId, adId } = body as {
    reason?: string;
    materials?: unknown;
    generationId?: string;
    adId?: string;
  };
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason is required (non-empty string)' }, { status: 400 });
  }
  if (!materials) {
    return NextResponse.json({ error: 'materials is required' }, { status: 400 });
  }
  try {
    const saved = await saveBatchReject({
      reason: reason.trim(),
      materials,
      generationId,
      adId,
    });
    return NextResponse.json({ success: true, id: saved.id });
  } catch (e) {
    console.error('[batch-reject] save failed:', e);
    return NextResponse.json(
      { error: 'Internal error', details: (e as Error).message },
      { status: 500 },
    );
  }
}
