// @vitest-environment jsdom
/**
 * 特性テスト: Cookie 同意バナーの現状の振る舞いを固定する。
 *
 * ここが壊れると個人情報に影響する。同意が取れていないのにバナーを
 * 出さなくなると、AnalyticsInjector を起動する唯一の導線が消える。
 * 逆に decline を accepted として保存すると、拒否した利用者の
 * アクセス解析タグが発火する。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LpCookieConsent } from '@/components/lp-maker/LpCookieConsent';

const STORAGE_KEY = 'lpmaker-cookie-consent-v1';

/** dispatch された同意イベントの detail を順に記録する。 */
function recordConsentEvents(): string[] {
  const seen: string[] = [];
  const handler = (e: Event) => seen.push(String((e as CustomEvent).detail));
  window.addEventListener('lpmaker-consent-changed', handler);
  listeners.push(() => window.removeEventListener('lpmaker-consent-changed', handler));
  return seen;
}
const listeners: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  while (listeners.length) listeners.pop()!();
  localStorage.clear();
});

describe('バナーの表示判定', () => {
  it('同意記録が無ければバナーを出す', async () => {
    // 壊れたら落ちる: 初訪問者にバナーが出なくなり、同意を取る導線が消える。
    render(<LpCookieConsent />);
    expect(await screen.findByText('同意する')).toBeTruthy();
    expect(screen.getByText('拒否')).toBeTruthy();
  });

  it('accepted が保存済みならバナーを出さない', () => {
    // 壊れたら落ちる: 同意済みの利用者に毎回バナーが出る。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<LpCookieConsent />);
    expect(screen.queryByText('同意する')).toBeNull();
  });

  it('declined が保存済みでもバナーを出さない（再勧誘しない）', () => {
    // 壊れたら落ちる: 拒否した利用者に繰り返し同意を求めることになる。
    localStorage.setItem(STORAGE_KEY, 'declined');
    render(<LpCookieConsent />);
    expect(screen.queryByText('同意する')).toBeNull();
  });
});

describe('同意する', () => {
  it('accepted を保存し、バナーを閉じ、accepted イベントを1度だけ流す', async () => {
    // 壊れたら落ちる: 保存値が違うと次回もバナーが出る。イベントが流れないと
    // AnalyticsInjector がその場で起動せず、同意が即時反映されない。
    const seen = recordConsentEvents();
    render(<LpCookieConsent />);

    fireEvent.click(await screen.findByText('同意する'));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
    expect(screen.queryByText('同意する')).toBeNull();
    expect(seen).toEqual(['accepted']);
  });
});

describe('拒否', () => {
  it('declined を保存し、バナーを閉じ、イベントは流さない', async () => {
    // 壊れたら落ちる: 拒否で accepted イベントが流れると、拒否した利用者の
    // 解析タグが発火する。保存値が accepted になるのも同じ事故。
    const seen = recordConsentEvents();
    render(<LpCookieConsent />);

    fireEvent.click(await screen.findByText('拒否'));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('declined');
    expect(screen.queryByText('拒否')).toBeNull();
    expect(seen).toEqual([]);
  });
});
