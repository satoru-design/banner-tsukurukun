// @vitest-environment jsdom
/**
 * 特性テスト: Pro 上限到達時の Business 案内バナーの現状の振る舞いを固定する。
 *
 * ここが壊れると金に影響する。表示条件が緩むと Pro 以外にまで上位プランを
 * 勧めることになる。試算額の計算が崩れると、実際には高くなるのに
 * 「お得」と表示してしまう。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeToBusinessBanner } from '@/components/ironclad/UpgradeToBusinessBanner';

const DISMISS_KEY = 'businessUpgradeBannerDismissedAt';

/** バナー本体が出ているか。 */
function isShown(): boolean {
  return screen.queryByText(/Pro 100 枚を使い切りました/) !== null;
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('表示条件', () => {
  it('Pro かつ上限到達なら出す', () => {
    // 壊れたら落ちる: 上限に当たった Pro 利用者に案内が届かない。
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);
    expect(isShown()).toBe(true);
  });

  it('Pro でなければ出さない', () => {
    // 壊れたら落ちる: free や starter にまで Business を勧める。
    render(
      <UpgradeToBusinessBanner isPro={false} proLimitReachedInSession totalUsageCount={800} />,
    );
    expect(isShown()).toBe(false);
  });

  it('上限に到達していなければ出さない', () => {
    // 壊れたら落ちる: まだ枠が残っている利用者に上位プランを勧める。
    render(
      <UpgradeToBusinessBanner isPro proLimitReachedInSession={false} totalUsageCount={50} />,
    );
    expect(isShown()).toBe(false);
  });
});

describe('同月内の再表示抑制', () => {
  it('同じ月に閉じた記録があれば出さない', () => {
    // 壊れたら落ちる: 「今月は表示しない」が効かず毎回出る。
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);
    expect(isShown()).toBe(false);
  });

  it('前月に閉じた記録なら出し、古い記録を掃除する', () => {
    // 壊れたら落ちる: 月が替わっても出なくなる。記録が残り続けると
    // 判定が古い値に引きずられる。
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 2);
    localStorage.setItem(DISMISS_KEY, lastMonth.toISOString());

    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);

    expect(isShown()).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it('前年の同じ月に閉じた記録なら出す', () => {
    // 壊れたら落ちる: 月だけ見て年を見ず、1年前の記録で抑制してしまう。
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    localStorage.setItem(DISMISS_KEY, lastYear.toISOString());

    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);
    expect(isShown()).toBe(true);
  });
});

describe('試算額', () => {
  it('累計 800 枚なら月 ¥3,000 お得と出す', () => {
    // 壊れたら落ちる: 料率や固定費の係数が変わり、誤った金額を提示する。
    // 内訳: 超過 = 800 - 100 = 700 枚
    //       Pro 超過 = 700 × ¥80 = ¥56,000、Business 超過 = 700 × ¥40 = ¥28,000
    //       (14800 + 56000) - (39800 + 28000) = ¥3,000
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);
    expect(screen.getByText('¥3,000 お得')).toBeTruthy();
  });

  it('累計 600 枚では得にならないので金額を出さない', () => {
    // 壊れたら落ちる: 実際には月 ¥5,000 高くなるのに「お得」と表示する。
    // 内訳: (14800 + 40000) - (39800 + 20000) = -¥5,000
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={600} />);
    expect(screen.queryByText(/お得/)).toBeNull();
    expect(screen.getByText(/1,000 枚まで上限が大幅に拡張されます/)).toBeTruthy();
  });

  it('超過 625 枚はまだ得にならない（境界の下側）', () => {
    // 壊れたら落ちる: 「お得」の境界がずれる。
    // 差額 = -25000 + 40 × 超過枚数 なので 625 枚でちょうど ±0 になり、
    // monthlyDiff > 0 を満たさないため金額は出ない。
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={725} />);
    expect(screen.queryByText(/お得/)).toBeNull();
  });

  it('超過 626 枚で得になる（境界の上側）', () => {
    // 壊れたら落ちる: 境界が1枚でもずれると、損益が逆の案内を出す。
    // 差額 = -25000 + 40 × 626 = ¥40
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={726} />);
    expect(screen.getByText('¥40 お得')).toBeTruthy();
  });
});

describe('今月は表示しない', () => {
  it('その場で消え、閉じた時刻を保存する', () => {
    // 壊れたら落ちる: 保存されず、再読み込みでまた出る。
    render(<UpgradeToBusinessBanner isPro proLimitReachedInSession totalUsageCount={800} />);

    fireEvent.click(screen.getByText('今月は表示しない'));

    expect(isShown()).toBe(false);
    const saved = localStorage.getItem(DISMISS_KEY);
    expect(saved).not.toBeNull();
    // ISO 8601 形式で保存されていること（同月判定が Date で解釈できる前提）。
    expect(Number.isNaN(new Date(saved!).getTime())).toBe(false);
  });
});
