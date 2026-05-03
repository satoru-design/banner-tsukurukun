#!/usr/bin/env node
/**
 * Stripe Business Plan Setup
 *
 * Phase A.17.0: Creates Business Product + Base Price ¥39,800 + Metered Price ¥40
 * for the specified mode (test or live).
 *
 * Reuses the existing 'banner_generation_overage' meter (created in
 * stripe-live-setup.mjs). Different mode = different meter.
 *
 * Usage:
 *   node scripts/stripe-business-setup.mjs --mode=live
 *   node scripts/stripe-business-setup.mjs --mode=test
 *
 * Output: prints IDs to stdout. For live mode, merges into scripts/stripe-live-ids.json.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const mode = args.mode;
if (mode !== 'live' && mode !== 'test') {
  console.error('ERROR: --mode=live or --mode=test required');
  process.exit(1);
}

let sk;
if (mode === 'live') {
  const TOKEN_PATH = path.join(os.homedir(), '.claude', 'secrets', 'stripe-live-token');
  sk = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  if (!sk.startsWith('sk_live_')) {
    console.error('ERROR: token at', TOKEN_PATH, 'is not a live key');
    process.exit(1);
  }
} else {
  const envPath = path.resolve('.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^STRIPE_SECRET_KEY=(sk_test_[A-Za-z0-9]+)/m);
  if (!match) {
    console.error('ERROR: STRIPE_SECRET_KEY (sk_test_*) not found in .env');
    process.exit(1);
  }
  sk = match[1];
}

console.log(`[stripe-business-setup] mode=${mode} key=${sk.slice(0, 12)}...`);

const auth = { Authorization: 'Bearer ' + sk };

const enc = (obj, prefix = '') => {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') {
          out.push(enc(item, `${key}[${i}]`));
        } else {
          out.push(`${encodeURIComponent(key + '[' + i + ']')}=${encodeURIComponent(item)}`);
        }
      });
    } else if (typeof v === 'object') {
      out.push(enc(v, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return out.join('&');
};

const post = async (apipath, body) => {
  const res = await fetch('https://api.stripe.com/v1/' + apipath, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: enc(body),
  });
  const data = await res.json();
  if (data.error) {
    console.error(`POST /${apipath} FAILED:`, data.error);
    throw new Error(data.error.message);
  }
  return data;
};

const get = async (apipath) => {
  const res = await fetch('https://api.stripe.com/v1/' + apipath, { headers: auth });
  return await res.json();
};

const result = {};

// ───────────────────────────────────────────────
// 1. Find existing meter (idempotent)
// ───────────────────────────────────────────────
console.log('[1/4] Locating banner_generation_overage meter...');
const meters = await get('billing/meters?limit=100');
const meter = meters.data?.find((m) => m.event_name === 'banner_generation_overage');
if (!meter) {
  console.error('ERROR: meter banner_generation_overage not found in', mode, 'mode');
  console.error('       Run scripts/stripe-live-setup.mjs first (or test mode equivalent)');
  process.exit(1);
}
console.log('   ✅ found meter:', meter.id);
result.METER_ID = meter.id;

// ───────────────────────────────────────────────
// 2. Business Product (idempotent by name)
// ───────────────────────────────────────────────
console.log('[2/4] Creating Business Product...');
const existingProducts = await get('products?limit=100&active=true');
let businessProduct = existingProducts.data?.find((p) => p.name === '勝ちバナー作る君 Business');
if (businessProduct) {
  console.log('   ⏩ already exists:', businessProduct.id);
} else {
  businessProduct = await post('products', {
    name: '勝ちバナー作る君 Business',
    description: '1,000回/月・全17サイズ・複数スタイル並列・代理店向け（クライアント別フォルダ・拡張Brand Kit・一括ZIP DL は順次提供）',
  });
  console.log('   ✅ Business Product:', businessProduct.id);
}
result.PRODUCT_BUSINESS = businessProduct.id;

// ───────────────────────────────────────────────
// 3. Business Base Price ¥39,800/month
// ───────────────────────────────────────────────
console.log('[3/4] Creating Business Base Price...');
const existingPrices = await get(`prices?product=${businessProduct.id}&limit=100&active=true`);
let businessBasePrice = existingPrices.data?.find(
  (p) => p.unit_amount === 39800 && p.recurring?.usage_type === 'licensed'
);
if (businessBasePrice) {
  console.log('   ⏩ already exists:', businessBasePrice.id);
} else {
  businessBasePrice = await post('prices', {
    product: businessProduct.id,
    unit_amount: 39800,
    currency: 'jpy',
    recurring: { interval: 'month', usage_type: 'licensed' },
    nickname: 'Business Monthly Base',
  });
  console.log('   ✅ Business Base Price:', businessBasePrice.id);
}
result.PRICE_BUSINESS_BASE = businessBasePrice.id;

// ───────────────────────────────────────────────
// 4. Business Metered Price ¥40/枠
// ───────────────────────────────────────────────
console.log('[4/4] Creating Business Metered Price...');
let businessMeteredPrice = existingPrices.data?.find(
  (p) => p.unit_amount === 40 && p.recurring?.usage_type === 'metered'
);
if (businessMeteredPrice) {
  console.log('   ⏩ already exists:', businessMeteredPrice.id);
} else {
  businessMeteredPrice = await post('prices', {
    product: businessProduct.id,
    unit_amount: 40,
    currency: 'jpy',
    recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
    nickname: 'Business Overage per Generation',
  });
  console.log('   ✅ Business Metered Price:', businessMeteredPrice.id);
}
result.PRICE_BUSINESS_METERED = businessMeteredPrice.id;

// ───────────────────────────────────────────────
// 5. Output / persist
// ───────────────────────────────────────────────
console.log('');
console.log(`=== Summary (${mode} mode) ===`);
for (const [k, v] of Object.entries(result)) {
  console.log(k.padEnd(24) + ' = ' + v);
}

if (mode === 'live') {
  const idsPath = path.resolve('scripts/stripe-live-ids.json');
  const existing = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
  const merged = { ...existing, ...result };
  fs.writeFileSync(idsPath, JSON.stringify(merged, null, 2));
  console.log(`\n✅ Merged IDs into: ${idsPath}`);
  console.log('\nNEXT STEPS:');
  console.log('  1. Set Vercel env STRIPE_PRICE_BUSINESS_BASE = ' + result.PRICE_BUSINESS_BASE);
  console.log('  2. Set Vercel env STRIPE_PRICE_BUSINESS_METERED = ' + result.PRICE_BUSINESS_METERED);
  console.log('  3. Set Vercel env NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE = ' + result.PRICE_BUSINESS_BASE);
} else {
  console.log('\nNEXT STEPS:');
  console.log('  Add to .env:');
  console.log(`    STRIPE_PRICE_BUSINESS_BASE=${result.PRICE_BUSINESS_BASE}`);
  console.log(`    STRIPE_PRICE_BUSINESS_METERED=${result.PRICE_BUSINESS_METERED}`);
  console.log(`    NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE=${result.PRICE_BUSINESS_BASE}`);
}
