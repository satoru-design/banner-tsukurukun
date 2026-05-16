#!/usr/bin/env node
/**
 * D11 Task 15: Stripe Live mode に LP メータード課金用リソースを作成する。
 *
 * 作成リソース:
 *   1. Meter: lp_generation_overage
 *   2. Pro Metered LP Price: ¥980/本 graduated metered (最初の 20 本 ¥0, 21 本目以降 ¥980)
 *   3. Coupon + Promotion Code: LPMAKER_EARLY (50% OFF, 60 日, 50 名)
 *
 * 既存リソースがあればそれを尊重して再利用する（idempotent）。
 *
 * 出力: scripts/stripe-live-ids-lp.json
 */
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.claude/secrets/stripe-live-token'
);
const apiKey = fs.readFileSync(tokenPath, 'utf-8').trim();
const stripe = new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' });

const existingIds = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'stripe-live-ids.json'), 'utf-8')
);
// 既存 JSON のキーは PRODUCT_PRO（PRO_PRODUCT_ID ではない）
const proProductId = existingIds.PRODUCT_PRO || existingIds.PRO_PRODUCT_ID;
if (!proProductId) {
  console.error('Pro Product ID が stripe-live-ids.json に見つかりません');
  console.error('Existing keys:', Object.keys(existingIds));
  process.exit(1);
}

console.log('=== LP 用 Stripe リソース作成開始 ===');
console.log('Pro Product:', proProductId);

// 1. Meter
const existingMeters = await stripe.billing.meters.list({ limit: 100 });
const existingLpMeter = existingMeters.data.find(
  (m) => m.event_name === 'lp_generation_overage'
);
let meter;
if (existingLpMeter) {
  console.log('Meter already exists:', existingLpMeter.id);
  meter = existingLpMeter;
} else {
  meter = await stripe.billing.meters.create({
    display_name: 'LP Generation Overage',
    event_name: 'lp_generation_overage',
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  console.log('Meter created:', meter.id);
}

// 2. Pro Metered LP Price (idempotent: 既存の "Pro LP Metered" nickname price を再利用)
const existingPrices = await stripe.prices.list({
  product: proProductId,
  active: true,
  limit: 100,
});
let priceLpMetered = existingPrices.data.find(
  (p) =>
    p.nickname === 'Pro LP Metered' &&
    p.recurring?.meter === meter.id &&
    p.recurring?.usage_type === 'metered'
);
if (priceLpMetered) {
  console.log('Pro Metered LP Price already exists:', priceLpMetered.id);
} else {
  priceLpMetered = await stripe.prices.create({
    product: proProductId,
    currency: 'jpy',
    recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: [
      { up_to: 20, unit_amount: 0 },
      { up_to: 'inf', unit_amount: 980 },
    ],
    nickname: 'Pro LP Metered',
  });
  console.log('Pro Metered LP Price created:', priceLpMetered.id);
}

// 3. Coupon + Promo
const existingPromos = await stripe.promotionCodes.list({ code: 'LPMAKER_EARLY' });
let promo;
if (existingPromos.data.length > 0) {
  console.log('LPMAKER_EARLY promo already exists:', existingPromos.data[0].id);
  promo = existingPromos.data[0];
} else {
  // 既存の LPMAKER_EARLY 名義 coupon があれば再利用（過去ランの残骸対策）
  const couponList = await stripe.coupons.list({ limit: 100 });
  let coupon = couponList.data.find(
    (c) =>
      c.name === 'LPMAKER_EARLY 50% OFF' &&
      c.percent_off === 50 &&
      c.duration === 'once' &&
      c.times_redeemed === 0
  );
  if (coupon) {
    console.log('Coupon reused:', coupon.id);
  } else {
    coupon = await stripe.coupons.create({
      duration: 'once',
      percent_off: 50,
      max_redemptions: 50,
      name: 'LPMAKER_EARLY 50% OFF',
      redeem_by: Math.floor(Date.now() / 1000) + 60 * 86400,
    });
    console.log('Coupon created:', coupon.id);
  }

  // 2026-04-22.dahlia API: coupon は promotion.coupon にネスト
  promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: 'LPMAKER_EARLY',
    max_redemptions: 50,
  });
  console.log('Promo:', promo.id);
}

const outIds = {
  LP_METER_ID: meter.id,
  LP_METER_EVENT_NAME: 'lp_generation_overage',
  STRIPE_PRICE_PRO_LP_METERED: priceLpMetered.id,
  STRIPE_PROMO_LPMAKER_EARLY: promo.id,
};
fs.writeFileSync(
  path.join(__dirname, 'stripe-live-ids-lp.json'),
  JSON.stringify(outIds, null, 2)
);
console.log('=== 完了 ===');
console.log(outIds);
