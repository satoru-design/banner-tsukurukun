#!/usr/bin/env node
/**
 * Sprint 3 CR C-2: 既存 Pro Subscription に LP Metered Price (lp_generation_overage) を attach する。
 *
 * 経緯:
 *   D11 で LP Metered Price を作成したが、Checkout はそれを line_items に含めていなかった。
 *   結果、既に Pro plan を契約中の subscription は LP metered が無く、超過分を課金できなかった。
 *
 *   本 script は active subscription 全件を走査し、
 *     - Pro plan (= STRIPE_PRICE_PRO_BASE を含む) かつ
 *     - LP metered (STRIPE_PRICE_PRO_LP_METERED) が未 attach
 *   のものに LP metered を追加する（proration_behavior: 'none' で既存課金には影響なし）。
 *
 *   再実行 idempotent（既に attach 済みは skip）。
 *
 * 実行:
 *   node scripts/stripe-attach-lp-metered-to-existing.mjs
 */
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tokenPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.claude/secrets/stripe-live-token'
);
const apiKey = fs.readFileSync(tokenPath, 'utf-8').trim();
const stripe = new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lpIds = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'stripe-live-ids-lp.json'), 'utf-8')
);

const newLpPriceId = lpIds.STRIPE_PRICE_PRO_LP_METERED;
// 実際に Checkout で使われている Pro base price ID を環境変数から拾う（.env / Vercel env）。
// stripe-live-ids.json は初期 setup 時の snapshot で、現行の prod price と乖離している可能性がある。
const proBasePriceId = process.env.STRIPE_PRICE_PRO_BASE;
// Pro Product ID（旧 Pro price で contract 中の subscription も拾うため、最終判定は product 単位で行う）。
const existingIds = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'stripe-live-ids.json'), 'utf-8')
);
const proProductId = existingIds.PRODUCT_PRO;

if (!newLpPriceId) {
  console.error('STRIPE_PRICE_PRO_LP_METERED missing in stripe-live-ids-lp.json');
  process.exit(1);
}
if (!proBasePriceId) {
  console.error('STRIPE_PRICE_PRO_BASE env var missing.');
  console.error('Run with: node --env-file=.env scripts/stripe-attach-lp-metered-to-existing.mjs');
  process.exit(1);
}

console.log('=== Attach LP Metered to existing Pro subscriptions ===');
console.log('LP Metered Price:', newLpPriceId);
console.log('Pro Base Price (env):', proBasePriceId);
console.log('Pro Product ID:', proProductId);
console.log('');

// active subscription を全件走査（auto-pagination）
let attachedCount = 0;
let skippedAlreadyHas = 0;
let skippedNotPro = 0;
let totalScanned = 0;

for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
  totalScanned++;
  const hasLpPrice = sub.items.data.some((i) => i.price.id === newLpPriceId);
  if (hasLpPrice) {
    console.log(`${sub.id}: already has LP metered (skip)`);
    skippedAlreadyHas++;
    continue;
  }
  // Pro 判定: 以下のいずれかを満たす licensed item があれば Pro 扱い。
  //   1. 現行 env の Pro base price ID と一致
  //   2. LP metered と同じ product 配下の licensed price (= 同一 Pro 商品の旧 price)
  //   3. 商品名に 'Pro' を含む licensed price (旧データ救済: 別 product でも Pro 表記なら拾う)
  let hasProBase = false;
  for (const i of sub.items.data) {
    const isLicensed = i.price.recurring?.usage_type === 'licensed';
    if (!isLicensed) continue;
    if (i.price.id === proBasePriceId) {
      hasProBase = true;
      break;
    }
    if (i.price.product === proProductId) {
      hasProBase = true;
      break;
    }
    // product 名を引いて 'Pro' を含むか確認 (Business は除外)
    try {
      const prod = await stripe.products.retrieve(i.price.product);
      if (prod.name.includes('Pro') && !prod.name.includes('Business')) {
        hasProBase = true;
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (!hasProBase) {
    skippedNotPro++;
    continue;
  }
  try {
    await stripe.subscriptions.update(sub.id, {
      items: [
        ...sub.items.data.map((i) => ({ id: i.id })),
        { price: newLpPriceId },
      ],
      proration_behavior: 'none',
    });
    console.log(`${sub.id}: attached LP metered`);
    attachedCount++;
  } catch (e) {
    console.error(`${sub.id}: failed to attach`, e.message);
  }
}

console.log('');
console.log('=== Done ===');
console.log(`Total scanned: ${totalScanned}`);
console.log(`Attached:      ${attachedCount}`);
console.log(`Already had:   ${skippedAlreadyHas}`);
console.log(`Not Pro:       ${skippedNotPro}`);
