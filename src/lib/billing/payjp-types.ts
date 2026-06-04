import type Payjp from 'payjp';

/**
 * Pay.jp SDK の戻り値から型を導出（移管 P3）
 *
 * payjp の型は `declare namespace Payjp { ... } export = Payjp` 形式のため
 * `import * as I` での参照が不安定。SDK メソッドの Awaited<ReturnType<...>> から
 * 確実に Event / Subscription / Charge 型を取り出す。
 */
type Client = ReturnType<typeof Payjp>;

export type PayjpEvent = Awaited<ReturnType<Client['events']['retrieve']>>;
export type PayjpSubscription = Awaited<ReturnType<Client['subscriptions']['retrieve']>>;
export type PayjpCharge = Awaited<ReturnType<Client['charges']['retrieve']>>;
