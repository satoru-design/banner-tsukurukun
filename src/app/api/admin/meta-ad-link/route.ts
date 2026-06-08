import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyBatchGenerateAuth } from '@/lib/batch-generate/auth';
import { recordMetaAd } from '@/lib/feedback-loop/meta-ad-link';

export const runtime = 'nodejs';

const schema = z.object({
  adId: z.string().min(1),
  accountId: z.string().min(1),
  generationImageId: z.string().min(1).nullable().optional(),
  adSetId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  adName: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  // zod v4 に datetime() バリデーターなし → z.string() で受けて new Date() 変換時に弾く
  publishedAt: z.string().nullable().optional(),
});

/** C1: meta-ads-autopilot が入稿直後に ad_id ↔ generationImageId を登録する */
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const ad = await recordMetaAd(parsed.data);
    return NextResponse.json({ ok: true, id: ad.id, adId: ad.adId });
  } catch (e) {
    console.error('[meta-ad-link] error:', e);
    const msg = String(e);
    if (msg.includes('AdAccount not found')) {
      return NextResponse.json({ error: 'AdAccount not found', message: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
  }
}
