// @vitest-environment jsdom
/**
 * 特性テスト: 同意ゲート付き解析タグインジェクターの現状の振る舞いを固定する。
 *
 * ここが壊れると個人情報に影響する。同意が無い状態でタグが1本でも
 * 発火すると、GDPR と改正電気通信事業法16条の3に触れる。
 * ID のサニタイズが壊れると、インライン JS への注入経路になる。
 *
 * next/script は実際のスクリプト読み込みを避けるため差し替える。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

interface MockScriptProps {
  id?: string;
  src?: string;
  dangerouslySetInnerHTML?: { __html: string };
}

vi.mock('next/script', () => ({
  default: (props: MockScriptProps) => (
    <script
      data-testid={props.id ?? 'script-external'}
      data-src={props.src ?? ''}
      dangerouslySetInnerHTML={props.dangerouslySetInnerHTML}
    />
  ),
}));

import { AnalyticsInjector } from '@/components/lp-maker/AnalyticsInjector';
import { resetConsentStoreForTest } from '@/components/lp-maker/consent-store';

const STORAGE_KEY = 'lpmaker-cookie-consent-v1';

// 明らかに偽物と分かる固定のタグ ID。実在の計測 ID は使わない。
const CONFIG = {
  gtmId: 'GTM-FAKETEST',
  ga4Id: 'G-FAKETEST',
  clarityId: 'faketestclarity',
  pixelId: '000000000000000',
};

/** 発火したタグの数。0 なら1本も出ていない。 */
function firedTagCount(): number {
  return document.querySelectorAll('script[data-testid]').length;
}

function dispatchConsent(detail: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('lpmaker-consent-changed', { detail }));
  });
}

beforeEach(() => {
  localStorage.clear();
  // accepted イベントは一度受けると戻らない仕様なので、テスト間で持ち越さない。
  resetConsentStoreForTest();
});
afterEach(() => localStorage.clear());

describe('同意が無い状態', () => {
  it('localStorage が空ならタグを1本も出さない', () => {
    // 壊れたら落ちる: 同意前に解析タグが発火し、無断でデータが送信される。
    render(<AnalyticsInjector config={CONFIG} />);
    expect(firedTagCount()).toBe(0);
  });

  it('declined ならタグを1本も出さない', () => {
    // 壊れたら落ちる: 明示的に拒否した利用者のデータが送信される。
    localStorage.setItem(STORAGE_KEY, 'declined');
    render(<AnalyticsInjector config={CONFIG} />);
    expect(firedTagCount()).toBe(0);
  });

  it('accepted 以外の任意の値ではタグを出さない', () => {
    // 壊れたら落ちる: 判定が緩み、壊れた保存値で勝手にタグが動く。
    for (const v of ['yes', 'true', '1', 'ACCEPTED', ' accepted']) {
      localStorage.setItem(STORAGE_KEY, v);
      const { unmount } = render(<AnalyticsInjector config={CONFIG} />);
      expect(firedTagCount()).toBe(0);
      unmount();
    }
  });

  it('declined イベントが来てもタグを出さない', () => {
    // 壊れたら落ちる: detail を見ずに同意成立と判断してしまう。
    render(<AnalyticsInjector config={CONFIG} />);
    dispatchConsent('declined');
    expect(firedTagCount()).toBe(0);
  });
});

describe('同意がある状態', () => {
  it('accepted が保存済みなら4種のタグを出す', async () => {
    // 壊れたら落ちる: 同意済みなのに計測が止まる。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<AnalyticsInjector config={CONFIG} />);

    expect(await screen.findByTestId('gtm-injector')).toBeTruthy();
    expect(screen.getByTestId('ga4-injector')).toBeTruthy();
    expect(screen.getByTestId('clarity-injector')).toBeTruthy();
    expect(screen.getByTestId('pixel-injector')).toBeTruthy();
  });

  it('accepted イベントで即時にタグを出す（保存値が無くても）', async () => {
    // 壊れたら落ちる: 同意ボタンを押しても再読み込みまでタグが動かない。
    render(<AnalyticsInjector config={CONFIG} />);
    expect(firedTagCount()).toBe(0);

    dispatchConsent('accepted');

    expect(await screen.findByTestId('gtm-injector')).toBeTruthy();
  });

  it('設定されていない ID のタグは出さない', async () => {
    // 壊れたら落ちる: 空 ID で不正なタグが挿入される。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<AnalyticsInjector config={{ gtmId: 'GTM-FAKETEST' }} />);

    expect(await screen.findByTestId('gtm-injector')).toBeTruthy();
    expect(screen.queryByTestId('ga4-injector')).toBeNull();
    expect(screen.queryByTestId('clarity-injector')).toBeNull();
    expect(screen.queryByTestId('pixel-injector')).toBeNull();
  });
});

describe('ID のサニタイズ', () => {
  it('英数とハイフンとアンダースコア以外を除去する', async () => {
    // 壊れたら落ちる: インライン JS への注入経路が開く。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<AnalyticsInjector config={{ gtmId: "GTM-X'};alert(1);//" }} />);

    const el = await screen.findByTestId('gtm-injector');
    const html = el.innerHTML;
    // GTM スニペット自体が引用符や // を含むので、埋め込まれた ID と
    // 注入ペイロードの不在をピンポイントで見る。
    expect(html).toContain("'GTM-Xalert1'");
    expect(html).not.toContain("'};");
    expect(html).not.toContain('alert(1)');
  });

  it('65文字以上の ID は不正とみなして出さない', () => {
    // 壊れたら落ちる: 長大な文字列がそのまま埋め込まれる。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<AnalyticsInjector config={{ gtmId: 'A'.repeat(65) }} />);
    expect(screen.queryByTestId('gtm-injector')).toBeNull();
  });

  it('サニタイズ後に空になる ID は出さない', () => {
    // 壊れたら落ちる: 空 ID のタグが挿入される。
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<AnalyticsInjector config={{ gtmId: '!!!@@@###' }} />);
    expect(screen.queryByTestId('gtm-injector')).toBeNull();
  });
});

describe('後片付け', () => {
  it('unmount するとイベント購読を解除する', () => {
    // 壊れたら落ちる: unmount 済みコンポーネントへの setState でリークする。
    const { unmount } = render(<AnalyticsInjector config={CONFIG} />);
    unmount();
    // 解除されていれば、この dispatch は何も起こさず警告も出ない。
    dispatchConsent('accepted');
    expect(firedTagCount()).toBe(0);
  });
});
