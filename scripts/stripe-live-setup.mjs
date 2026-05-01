#!/usr/bin/env node
/**
 * Stripe Live Mode Setup Script
 *
 * Creates Products / Prices / Meter / Promo / Webhook / Portal Config
 * mirroring test mode structure exactly.
 *
 * Usage: node scripts/stripe-live-setup.mjs
 *
 * Reads ~/.claude/secrets/stripe-live-token for live secret key.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_PATH = path.join(os.homedir(), '.claude', 'secrets', 'stripe-live-token');
const sk = fs.readFileSync(TOKEN_PATH, 'utf8').trim();

if (!sk.startsWith('sk_live_')) {
  console.error('ERROR: token at', TOKEN_PATH, 'is not a live key');
  process.exit(1);
}

const auth = { Authorization: 'Bearer ' + sk };

// form-encode helper for Stripe API
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

const post = async (path, body) => {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: enc(body),
  });
  const data = await res.json();
  if (data.error) {
    console.error(`POST /${path} FAILED:`, data.error);
    throw new Error(data.error.message);
  }
  return data;
};

const get = async (path) => {
  const res = await fetch('https://api.stripe.com/v1/' + path, { headers: auth });
  return await res.json();
};

const result = {};

// ───────────────────────────────────────────────
// 1. Meter: banner_generation_overage
// ───────────────────────────────────────────────
console.log('[1/7] Creating Meter banner_generation_overage...');
// Idempotency: check if exists
const existingMeters = await get('billing/meters?limit=100');
let meter = existingMeters.data?.find((m) => m.event_name === 'banner_generation_overage');
if (meter) {
  console.log('   ⏩ already exists:', meter.id);
} else {
  meter = await post('billing/meters', {
    display_name: 'バナー生成超過回数',
    event_name: 'banner_generation_overage',
    default_aggregation: { formula: 'count' },
    customer_mapping: { event_payload_key: 'stripe_customer_id', type: 'by_id' },
  });
  console.log('   ✅ created:', meter.id);
}
result.METER_ID = meter.id;

// ───────────────────────────────────────────────
// 2. Products
// ───────────────────────────────────────────────
console.log('[2/7] Creating Products...');
const starterProduct = await post('products', {
  name: '勝ちバナー作る君 Starter',
  description: '30回/月・5サイズ・お気に入り5枚保持',
});
console.log('   ✅ Starter Product:', starterProduct.id);
result.PRODUCT_STARTER = starterProduct.id;

const proProduct = await post('products', {
  name: '勝ちバナー作る君 Pro',
  description: '100回/月・全17サイズ・勝ちバナー無制限・プロンプト閲覧・履歴無制限・ZIP DL',
});
console.log('   ✅ Pro Product:', proProduct.id);
result.PRODUCT_PRO = proProduct.id;

// ───────────────────────────────────────────────
// 3. Prices
// ───────────────────────────────────────────────
console.log('[3/7] Creating Prices...');
const starterPrice = await post('prices', {
  product: starterProduct.id,
  unit_amount: 3980,
  currency: 'jpy',
  recurring: { interval: 'month', usage_type: 'licensed' },
  nickname: 'Starter Monthly',
});
console.log('   ✅ Starter Price:', starterPrice.id);
result.PRICE_STARTER = starterPrice.id;

const proBasePrice = await post('prices', {
  product: proProduct.id,
  unit_amount: 14800,
  currency: 'jpy',
  recurring: { interval: 'month', usage_type: 'licensed' },
  nickname: 'Pro Monthly Base',
});
console.log('   ✅ Pro Base Price:', proBasePrice.id);
result.PRICE_PRO_BASE = proBasePrice.id;

const proMeteredPrice = await post('prices', {
  product: proProduct.id,
  unit_amount: 80,
  currency: 'jpy',
  recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
  nickname: 'Pro Overage per Generation',
});
console.log('   ✅ Pro Metered Price:', proMeteredPrice.id);
result.PRICE_PRO_METERED = proMeteredPrice.id;

// ───────────────────────────────────────────────
// 4. Coupon + Promotion Code FRIENDS
// ───────────────────────────────────────────────
console.log('[4/7] Creating Coupon + Promo Code FRIENDS...');
const coupon = await post('coupons', {
  name: 'Pro Friend Beta',
  percent_off: 100,
  duration: 'once',
});
console.log('   ✅ Coupon:', coupon.id);
result.COUPON_FRIENDS = coupon.id;

// expires_at: 2026-07-31 23:59 JST = 1785509940 (mirrored from test mode)
const promoCode = await post('promotion_codes', {
  coupon: coupon.id,
  code: 'FRIENDS',
  max_redemptions: 100,
  expires_at: 1785509940,
  restrictions: { first_time_transaction: true },
});
console.log('   ✅ Promo Code:', promoCode.id, '(code:', promoCode.code + ')');
result.PROMO_FRIENDS = promoCode.id;

// ───────────────────────────────────────────────
// 5. Webhook Endpoint
// ───────────────────────────────────────────────
console.log('[5/7] Creating Webhook Endpoint...');
// Idempotency: check existing
const existingWebhooks = await get('webhook_endpoints?limit=10');
let webhook = existingWebhooks.data?.find((w) => w.url === 'https://autobanner.jp/api/billing/webhook');
if (webhook) {
  console.log('   ⏩ already exists:', webhook.id);
  console.log('   ⚠️  Webhook signing secret cannot be retrieved for existing endpoints.');
  console.log('   ⚠️  If you do not have STRIPE_WEBHOOK_SECRET stored, delete this endpoint in Dashboard and re-run.');
} else {
  webhook = await post('webhook_endpoints', {
    url: 'https://autobanner.jp/api/billing/webhook',
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ],
    description: 'banner-tsukurukun production webhook',
  });
  console.log('   ✅ Webhook:', webhook.id);
}
result.WEBHOOK_ID = webhook.id;
if (webhook.secret) {
  result.WEBHOOK_SECRET = webhook.secret;
  console.log('   🔑 Webhook signing secret captured (will be saved to file)');
}

// ───────────────────────────────────────────────
// 6. Customer Portal Configuration
// ───────────────────────────────────────────────
console.log('[6/7] Creating Customer Portal Configuration...');
const portalConfig = await post('billing_portal/configurations', {
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ['name', 'email', 'address', 'shipping', 'phone', 'tax_id'],
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      proration_behavior: 'none',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'switched_service', 'unused', 'other'],
      },
    },
    subscription_pause: { enabled: false },
    subscription_update: { enabled: false },
  },
  default_return_url: 'https://autobanner.jp/account',
});
console.log('   ✅ Portal Config:', portalConfig.id, '(active:', portalConfig.active + ')');
result.PORTAL_CONFIG_ID = portalConfig.id;

// ───────────────────────────────────────────────
// 7. Save results
// ───────────────────────────────────────────────
const outputPath = path.resolve('scripts/stripe-live-ids.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('[7/7] Saved IDs to:', outputPath);
console.log('');
console.log('=== Summary ===');
for (const [k, v] of Object.entries(result)) {
  console.log(k.padEnd(22) + ' = ' + v);
}
