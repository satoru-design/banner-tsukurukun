#!/usr/bin/env node
/**
 * Continuation of stripe-live-setup.mjs
 *
 * Uses already-created IDs from prior run.
 * Creates: Promotion Code, Webhook Endpoint, Customer Portal Config
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_PATH = path.join(os.homedir(), '.claude', 'secrets', 'stripe-live-token');
const sk = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
const auth = { Authorization: 'Bearer ' + sk };

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

// IDs from prior partial run
const result = {
  METER_ID: 'mtr_61UbXyUSbAAjCUdlj41JzGLyLbYy61Q8',
  PRODUCT_STARTER: 'prod_UR25B4lGKiDKYH',
  PRODUCT_PRO: 'prod_UR254aPzmvkUMW',
  PRICE_STARTER: 'price_1TSA19JzGLyLbYy68imAC6PE',
  PRICE_PRO_BASE: 'price_1TSA19JzGLyLbYy6Y24G5GPE',
  PRICE_PRO_METERED: 'price_1TSA19JzGLyLbYy69To1Y8bL',
  COUPON_FRIENDS: 'mghep4D1',
};

// ── Promotion Code FRIENDS (new API: promotion.type/coupon nested) ──
console.log('[4b/7] Creating Promo Code FRIENDS (with nested promotion)...');

// Idempotency: check if FRIENDS already exists
const existingPromos = await get('promotion_codes?code=FRIENDS&limit=10');
let promo = existingPromos.data?.find((p) => p.code === 'FRIENDS' && p.livemode === true);
if (promo) {
  console.log('   ⏩ already exists:', promo.id);
} else {
  promo = await post('promotion_codes', {
    promotion: { type: 'coupon', coupon: result.COUPON_FRIENDS },
    code: 'FRIENDS',
    max_redemptions: 100,
    expires_at: 1785509940,
    restrictions: { first_time_transaction: true },
  });
  console.log('   ✅ Promo Code:', promo.id, '(code:', promo.code + ')');
}
result.PROMO_FRIENDS = promo.id;

// ── Webhook Endpoint ──
console.log('[5/7] Creating Webhook Endpoint...');
const existingWebhooks = await get('webhook_endpoints?limit=10');
let webhook = existingWebhooks.data?.find((w) => w.url === 'https://autobanner.jp/api/billing/webhook');
if (webhook) {
  console.log('   ⏩ already exists:', webhook.id);
  console.log('   ⚠️  Existing webhook signing secret CANNOT be retrieved.');
  console.log('   ⚠️  Delete in Dashboard and re-run if STRIPE_WEBHOOK_SECRET is unknown.');
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
  if (webhook.secret) {
    console.log('   🔑 Webhook signing secret captured');
  }
}
result.WEBHOOK_ID = webhook.id;
if (webhook.secret) result.WEBHOOK_SECRET = webhook.secret;

// ── Customer Portal Configuration ──
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

// ── Save ──
const outputPath = path.resolve('scripts/stripe-live-ids.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('[7/7] Saved IDs to:', outputPath);
console.log('');
console.log('=== Summary ===');
for (const [k, v] of Object.entries(result)) {
  console.log(k.padEnd(22) + ' = ' + v);
}
