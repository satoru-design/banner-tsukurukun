#!/usr/bin/env node
/**
 * Fix FRIENDS coupon: use amount_off (¥14,800) + duration=once
 * so that ONLY base subscription cost is discounted on first month,
 * NOT the metered overage charges.
 *
 * Old behavior (percent_off=100): metered usage in first month also free → loss
 * New behavior (amount_off=14800): max ¥14,800 discount on first invoice
 *
 * Idempotent: if any FRIENDS-coded promotion code is already amount_off based,
 * skips. Otherwise:
 *   1. Deactivates the existing FRIENDS promotion code
 *   2. Creates a new coupon with amount_off=14800
 *   3. Creates a new promotion code with code="FRIENDS" pointing to the new coupon
 *
 * Usage:
 *   node scripts/stripe-friends-coupon-fix.mjs --mode=live
 *   node scripts/stripe-friends-coupon-fix.mjs --mode=test
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

console.log(`[friends-coupon-fix] mode=${mode} key=${sk.slice(0, 12)}...`);
// Stripe-Version pinned: newer API (default) removed `coupon` param from promotion_codes.
// 2025-03-31.basil still accepts it.
const STRIPE_API_VERSION = '2025-03-31.basil';
const auth = { Authorization: 'Bearer ' + sk, 'Stripe-Version': STRIPE_API_VERSION };

const enc = (obj, prefix = '') => {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') out.push(enc(item, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(key + '[' + i + ']')}=${encodeURIComponent(item)}`);
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

// 1. Find all promotion codes with code "FRIENDS" (active or not)
console.log('[1/4] Looking for existing FRIENDS promotion codes...');
const promosRes = await get('promotion_codes?code=FRIENDS&limit=10');
const allFriends = promosRes.data || [];
console.log(`   found ${allFriends.length} FRIENDS code(s)`);
for (const p of allFriends) {
  console.log(`     - ${p.id} active=${p.active} times_redeemed=${p.times_redeemed} coupon=${p.coupon?.id || p.coupon}`);
}

// 2. Check if there is already an active amount_off-based FRIENDS
const activeFriends = allFriends.filter((p) => p.active);
let needRebuild = true;
for (const p of activeFriends) {
  const couponId = typeof p.coupon === 'string' ? p.coupon : p.coupon?.id;
  if (!couponId) continue;
  const c = await get(`coupons/${couponId}`);
  if (c.amount_off === 14800 && c.currency === 'jpy' && c.duration === 'once') {
    console.log(`   ✅ active FRIENDS already amount_off=14800 (coupon ${couponId}); nothing to do`);
    needRebuild = false;
    break;
  }
}

if (!needRebuild) {
  console.log('Done.');
  process.exit(0);
}

// 3. Deactivate any existing active FRIENDS promotion codes
console.log('[2/4] Deactivating existing active FRIENDS codes...');
for (const p of activeFriends) {
  if (p.times_redeemed > 0) {
    console.log(`   ⚠️  promotion code ${p.id} has ${p.times_redeemed} redemptions; deactivating but coupon kept for history`);
  }
  await post(`promotion_codes/${p.id}`, { active: false });
  console.log(`   ✅ deactivated ${p.id}`);
}

// 4. Create new coupon: amount_off=14800 JPY, duration=once
console.log('[3/4] Creating new coupon (amount_off=14800)...');
const newCoupon = await post('coupons', {
  name: 'Pro Friend Beta (base only)',
  amount_off: 14800,
  currency: 'jpy',
  duration: 'once',
  metadata: {
    purpose: 'first-month free for Pro base subscription only',
    excludes: 'metered overage charges',
    replaces_coupon: activeFriends[0]?.coupon?.id || activeFriends[0]?.coupon || 'n/a',
    created_for_phase: 'A.17.0',
  },
});
console.log(`   ✅ new coupon: ${newCoupon.id} (¥${newCoupon.amount_off} ${newCoupon.currency} ${newCoupon.duration})`);

// 5. Create new promotion code with code=FRIENDS pointing to new coupon
console.log('[4/4] Creating new promotion code FRIENDS...');
// Reuse expires_at: 2026-07-31 23:59 JST = 1785509940 (mirrors original)
const newPromo = await post('promotion_codes', {
  coupon: newCoupon.id,
  code: 'FRIENDS',
  max_redemptions: 100,
  expires_at: 1785509940,
  restrictions: { first_time_transaction: true },
});
console.log(`   ✅ new promotion code: ${newPromo.id} code=${newPromo.code}`);

console.log('');
console.log(`=== Summary (${mode} mode) ===`);
console.log(`NEW_COUPON   = ${newCoupon.id}`);
console.log(`NEW_PROMO    = ${newPromo.id}`);
console.log('');
console.log('Behavior:');
console.log('  - First month: max ¥14,800 discount (covers Pro base ¥14,800 fully)');
console.log('  - Metered overage in first month: charged normally at ¥80/枠');
console.log('  - 2nd month onwards: no discount, full charge');

if (mode === 'live') {
  // Update stripe-live-ids.json
  const idsPath = path.resolve('scripts/stripe-live-ids.json');
  const existing = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
  existing.COUPON_FRIENDS = newCoupon.id;
  existing.PROMO_FRIENDS = newPromo.id;
  fs.writeFileSync(idsPath, JSON.stringify(existing, null, 2));
  console.log(`\n✅ Updated ${idsPath} with new FRIENDS coupon/promo IDs`);
}
