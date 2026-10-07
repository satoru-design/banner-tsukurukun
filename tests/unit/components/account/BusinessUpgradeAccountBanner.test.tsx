// @vitest-environment jsdom
/**
 * 特性テスト: Business 推奨バナーの現状の振る舞いを固定する。
 *
 * ここが壊れると金に影響する。抑制期間の判定が崩れると、閉じたばかりの
 * 利用者に繰り返し上位プランを勧めることになる。試算額の計算が崩れると、
 * 実際には高くなるのに「お得」と表示してしまう。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BusinessUpgradeAccountBanner } from '@/components/account/BusinessUpgradeAccountBanner';

const DAY_MS = 24 * 60 * 60 * 1000;

function notice(avgOveragePerMonth: number, invoiceCount = 3) {
  return {
    id: 'notice_test_0001',
    metricSnapshot: { avgOveragePerMonth, invoiceCount },
    createdAt: new Date('2026-07-01T00:00:00Z'),
  };
}

/** N 日前の時刻。 */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

describe('表示条件', () => {
  it('notice が無ければ何も出さない', () => {
    // 壊れたら落ちる: 検知されていない利用者にまで上位プランを勧める。
    render(<BusinessUpgradeAccountBanner notice={null} upgradeNoticeShownAt={null} />);
    expect(screen.queryByText(/Business プラン向き/)).toBeNull();
  });

  it('notice があり未 dismiss なら出す', () => {
    // 壊れたら落ちる: 検知した利用者に案内が届かず、売上機会を落とす。
    render(<BusinessUpgradeAccountBanner notice={notice(60000)} upgradeNoticeShownAt={null} />);
    expect(screen.getByText(/Business プラン向き/)).toBeTruthy();
  });
});

describe('60日の抑制期間', () => {
  it('59日前に閉じた場合は出さない', () => {
    // 壊れたら落ちる: 閉じた直後の利用者に何度も同じ案内が出る。
    render(
      <BusinessUpgradeAccountBanner notice={notice(60000)} upgradeNoticeShownAt={daysAgo(59)} />,
    );
    expect(screen.queryByText(/Business プラン向き/)).toBeNull();
  });

  it('61日前に閉じた場合は再び出す', () => {
    // 壊れたら落ちる: 一度閉じたら二度と出なくなり、案内が機能しない。
    render(
      <BusinessUpgradeAccountBanner notice={notice(60000)} upgradeNoticeShownAt={daysAgo(61)} />,
    );
    expect(screen.getByText(/Business プラン向き/)).toBeTruthy();
  });

  it('ちょうど60日前は境界として出す（60日未満のみ抑制）', () => {
    // 壊れたら落ちる: 境界が1日ずれる。
    render(
      <BusinessUpgradeAccountBanner
        notice={notice(60000)}
        upgradeNoticeShownAt={new Date(Date.now() - 60 * DAY_MS - 1000)}
      />,
    );
    expect(screen.getByText(/Business プラン向き/)).toBeTruthy();
  });
});

describe('試算額', () => {
  it('平均超過 ¥60,000 なら月 ¥5,000 お得と出す', () => {
    // 壊れたら落ちる: 料率や固定費の係数が変わり、誤った金額を提示する。
    // 内訳: 超過枚数 = round(60000/80) = 750、Business 超過 = 750 × ¥40 = ¥30,000
    //       (14800 + 60000) - (39800 + 30000) = ¥5,000
    render(<BusinessUpgradeAccountBanner notice={notice(60000)} upgradeNoticeShownAt={null} />);
    expect(screen.getByText('¥5,000 お得')).toBeTruthy();
  });

  it('平均超過 ¥40,000 なら得にならないので金額を出さない', () => {
    // 壊れたら落ちる: 実際には月 ¥5,000 高くなるのに「お得」と表示する。
    // 内訳: (14800 + 40000) - (39800 + 20000) = -¥5,000
    render(<BusinessUpgradeAccountBanner notice={notice(40000)} upgradeNoticeShownAt={null} />);
    expect(screen.queryByText(/お得/)).toBeNull();
    expect(screen.getByText(/同程度のコストで上限が大幅に拡張されます/)).toBeTruthy();
  });

  it('超過が無い場合も得にならない扱いにする', () => {
    // 壊れたら落ちる: 超過ゼロの利用者に「お得」と誤表示する。
    render(<BusinessUpgradeAccountBanner notice={notice(0, 1)} upgradeNoticeShownAt={null} />);
    expect(screen.queryByText(/お得/)).toBeNull();
  });

  it('請求月数を本文に出す', () => {
    // 壊れたら落ちる: 根拠の月数が消え、試算の説明が成立しなくなる。
    render(<BusinessUpgradeAccountBanner notice={notice(60000, 5)} upgradeNoticeShownAt={null} />);
    expect(screen.getByText(/過去 5 ヶ月/)).toBeTruthy();
  });
});

describe('閉じる', () => {
  it('その場で消え、dismiss API を1度だけ POST する', async () => {
    // 壊れたら落ちる: サーバーに記録されず、次回アクセスでまた出る。
    // 逆に複数回 POST すると無駄なリクエストが出る。
    render(<BusinessUpgradeAccountBanner notice={notice(60000)} upgradeNoticeShownAt={null} />);

    await act(async () => {
      fireEvent.click(screen.getByText('閉じる'));
    });

    expect(screen.queryByText(/Business プラン向き/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/account/dismiss-upgrade-notice', {
      method: 'POST',
    });
  });
});
