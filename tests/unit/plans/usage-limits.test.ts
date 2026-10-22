/**
 * 特性テスト: プラン別の生成上限とハードキャップを固定する。
 *
 * ここが壊れると金が出る。上限は「どこから課金するか」の境界であり、
 * ハードキャップは「画像生成 API のコスト暴走を止める最後の線」。
 * 特に、未知のプラン名が無制限に落ちないことを重視する。
 *
 * 全て純関数なので API キーもネットワークも不要。
 */
import { describe, it, expect } from 'vitest';
import {
  getUsageLimit,
  getHardcap,
  USAGE_LIMIT_FREE,
  USAGE_LIMIT_PRO,
  USAGE_LIMIT_BUSINESS,
  USAGE_HARDCAP_FREE,
  USAGE_HARDCAP_PRO,
  USAGE_HARDCAP_BUSINESS,
} from '@/lib/plans/limits';
import { effectiveUsageCount, isUsageLimitReached } from '@/lib/plans/usage-check';

describe('プラン別の月次上限', () => {
  it('各プランの上限値が変わっていない', () => {
    // 壊れたら落ちる: 課金境界が動く（例: pro の無料枠が 100 から増えて売上が落ちる）。
    expect(getUsageLimit('free')).toBe(10);
    expect(getUsageLimit('starter')).toBe(30);
    expect(getUsageLimit('pro')).toBe(100);
    expect(getUsageLimit('business')).toBe(1000);
    expect(getUsageLimit('admin')).toBe(Number.POSITIVE_INFINITY);

    // 定数と関数の戻り値が一致していること
    expect(USAGE_LIMIT_FREE).toBe(10);
    expect(USAGE_LIMIT_PRO).toBe(100);
    expect(USAGE_LIMIT_BUSINESS).toBe(1000);
  });

  it('各プランのハードキャップ値が変わっていない', () => {
    // 壊れたら落ちる: コスト暴走を止める絶対線が動く（請求爆弾）。
    expect(getHardcap('free')).toBe(15);
    expect(getHardcap('starter')).toBe(30);
    expect(getHardcap('pro')).toBe(500);
    expect(getHardcap('business')).toBe(3000);
    expect(getHardcap('admin')).toBe(Number.POSITIVE_INFINITY);

    expect(USAGE_HARDCAP_FREE).toBe(15);
    expect(USAGE_HARDCAP_PRO).toBe(500);
    expect(USAGE_HARDCAP_BUSINESS).toBe(3000);
  });

  it('未知のプラン名は free にフォールバックする（無制限にしない）', () => {
    // 壊れたら落ちる: プラン名のタイポや新プラン追加漏れが無制限生成になり、
    // 1 ユーザーで API コストが無限に出る。最も危険な退行。
    for (const unknown of ['', 'Pro', 'PRO', 'enterprise', 'trial-pro', 'undefined']) {
      expect(getUsageLimit(unknown)).toBe(USAGE_LIMIT_FREE);
      expect(getHardcap(unknown)).toBe(USAGE_HARDCAP_FREE);
      expect(Number.isFinite(getUsageLimit(unknown))).toBe(true);
      expect(Number.isFinite(getHardcap(unknown))).toBe(true);
    }
  });

  it('ハードキャップは上限以上（free/pro/business は上限より大きい）', () => {
    // 壊れたら落ちる: キャップが上限を下回り、課金前にブロックされて売上が立たない。
    for (const plan of ['free', 'starter', 'pro', 'business', 'admin']) {
      expect(getHardcap(plan)).toBeGreaterThanOrEqual(getUsageLimit(plan));
    }
  });
});

describe('上限到達判定（lazy reset 込み）', () => {
  const future = new Date('2026-12-01T00:00:00Z');
  const past = new Date('2026-01-01T00:00:00Z');
  const now = new Date('2026-07-01T00:00:00Z');

  it('使用回数が上限と同数なら到達扱い（> ではなく >=）', () => {
    // 壊れたら落ちる: 境界が1つずれて、各ユーザーに毎月1回分を無料で余計に配る。
    expect(isUsageLimitReached({ usageCount: 9, usageLimit: 10, usageResetAt: future }, now)).toBe(false);
    expect(isUsageLimitReached({ usageCount: 10, usageLimit: 10, usageResetAt: future }, now)).toBe(true);
    expect(isUsageLimitReached({ usageCount: 11, usageLimit: 10, usageResetAt: future }, now)).toBe(true);
  });

  it('リセット日時を過ぎていれば 0 回として扱う', () => {
    // 壊れたら落ちる: 月をまたいでも枠が復活せず、課金済みユーザーが生成できない。
    expect(effectiveUsageCount({ usageCount: 99, usageLimit: 10, usageResetAt: past }, now)).toBe(0);
    expect(isUsageLimitReached({ usageCount: 99, usageLimit: 10, usageResetAt: past }, now)).toBe(false);
  });

  it('リセット日時が未来なら使用回数をそのまま使う', () => {
    // 壊れたら落ちる: 期間内なのにカウントが無視され、上限が効かなくなる。
    expect(effectiveUsageCount({ usageCount: 7, usageLimit: 10, usageResetAt: future }, now)).toBe(7);
  });

  it('usageResetAt が null のときは usageCount をそのまま使う（0 扱いにしない）', () => {
    // 壊れたら落ちる: reset 日時が未設定のユーザーの使用回数が毎回 0 と見なされ、
    // 上限が完全に無効化される。
    // 注: limits/usage-check の docstring は「null なら 0」と書いているが、
    // 実装は usageCount を返す。ここでは実装の現状を固定している。
    expect(effectiveUsageCount({ usageCount: 12, usageLimit: 10, usageResetAt: null }, now)).toBe(12);
    expect(isUsageLimitReached({ usageCount: 12, usageLimit: 10, usageResetAt: null }, now)).toBe(true);
  });

  it('admin（上限 Infinity）は何回使っても到達しない', () => {
    // 壊れたら落ちる: 管理者が自分の運用作業で上限に当たって止まる。
    expect(
      isUsageLimitReached(
        { usageCount: 10_000, usageLimit: Number.POSITIVE_INFINITY, usageResetAt: future },
        now,
      ),
    ).toBe(false);
  });
});
