#!/usr/bin/env node
/**
 * Vercel Production + Preview env を Stripe live mode 値で一括更新
 *
 * 読み込み:
 *   - ~/.claude/secrets/stripe-live-token (sk_live_...)
 *   - ~/.claude/secrets/vercel-token (Vercel PAT)
 *   - scripts/stripe-live-ids.json (live IDs)
 *
 * Targets: production, preview のみ（development は触らない）
 * Type: 全て sensitive（既存パターン踏襲）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERCEL_API = 'https://api.vercel.com';
const TARGETS = ['production', 'preview'];

const homeSecret = (n) => fs.readFileSync(path.join(os.homedir(), '.claude', 'secrets', n), 'utf8').trim();
const stripeKey = homeSecret('stripe-live-token');
const vercelToken = homeSecret('vercel-token');
const ids = JSON.parse(fs.readFileSync('scripts/stripe-live-ids.json', 'utf8'));

const project = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
const { projectId, orgId: teamId } = project;

const headers = {
  Authorization: `Bearer ${vercelToken}`,
  'Content-Type': 'application/json',
};

// 投入する env マッピング
const envs = {
  STRIPE_SECRET_KEY: stripeKey,
  STRIPE_WEBHOOK_SECRET: ids.WEBHOOK_SECRET,
  STRIPE_PRICE_STARTER: ids.PRICE_STARTER,
  STRIPE_PRICE_PRO_BASE: ids.PRICE_PRO_BASE,
  STRIPE_PRICE_PRO_METERED: ids.PRICE_PRO_METERED,
  STRIPE_PROMO_FRIENDS: ids.PROMO_FRIENDS,
  NEXT_PUBLIC_STRIPE_PRICE_STARTER: ids.PRICE_STARTER,
  NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE: ids.PRICE_PRO_BASE,
  STRIPE_ENABLED: 'true',
};

// 既存 env 一覧取得
const listRes = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`, { headers });
const listJson = await listRes.json();
const existingMap = new Map(listJson.envs.map((e) => [e.key, e]));

let success = 0,
  failure = 0;

for (const [key, value] of Object.entries(envs)) {
  const existing = existingMap.get(key);
  const body = { value, target: TARGETS, type: 'sensitive' };
  let res;
  if (existing) {
    res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/env/${existing.id}?teamId=${teamId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  } else {
    res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env?teamId=${teamId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, key }),
    });
  }
  if (res.ok) {
    console.log('✅', existing ? 'PATCH' : 'POST ', key.padEnd(38), '=', value.length > 20 ? value.substring(0, 12) + '...' : value);
    success++;
  } else {
    const t = await res.text();
    console.error('❌', key, res.status, t);
    failure++;
  }
}

console.log('');
console.log(`Done: ${success} success, ${failure} failure`);
console.log(`Targets: ${TARGETS.join(', ')}`);
console.log('');
console.log('Note: 反映するには Vercel rebuild が必要（次のステップ）');
