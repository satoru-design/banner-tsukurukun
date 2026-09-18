import { describe, it, expect } from 'vitest';
import {
  buildAttribution,
  deriveChannel,
  serializeAttribution,
  parseAttributionCookie,
  formatAttributionLines,
} from '@/lib/attribution';

function build(url: string, referer?: string | null) {
  return buildAttribution({
    url: new URL(url),
    referer,
    host: 'autobanner.jp',
    now: new Date('2026-09-18T01:54:00.000Z'),
  });
}

describe('deriveChannel', () => {
  it('gclid は Google 広告', () => {
    expect(deriveChannel({ gclid: 'abc' })).toBe('paid_google');
  });

  it('fbclid は Meta 広告', () => {
    expect(deriveChannel({ fbclid: 'abc' })).toBe('paid_meta');
  });

  it('utm_medium=cpc + source=google は Google 広告', () => {
    expect(deriveChannel({ med: 'cpc', src: 'google' })).toBe('paid_google');
  });

  it('utm_medium=paid_social + source=instagram は Meta 広告', () => {
    expect(deriveChannel({ med: 'paid_social', src: 'instagram' })).toBe('paid_meta');
  });

  it('検索エンジンの referer は自然検索', () => {
    expect(deriveChannel({ refHost: 'www.google.com' })).toBe('organic_search');
    expect(deriveChannel({ refHost: 'search.yahoo.co.jp' })).toBe('organic_search');
  });

  it('SNS の referer は social', () => {
    expect(deriveChannel({ refHost: 't.co' })).toBe('social');
    expect(deriveChannel({ refHost: 'www.instagram.com' })).toBe('social');
  });

  it('その他の referer は referral', () => {
    expect(deriveChannel({ refHost: 'example.co.jp' })).toBe('referral');
  });

  it('何も無ければ direct', () => {
    expect(deriveChannel({})).toBe('direct');
  });
});

describe('buildAttribution', () => {
  it('自然検索の着地を記録する', () => {
    const a = build('https://autobanner.jp/lp01', 'https://www.google.com/');
    expect(a.ch).toBe('organic_search');
    expect(a.lp).toBe('/lp01');
    expect(a.ref).toBe('www.google.com/');
    expect(a.t).toBe('2026-09-18T01:54:00.000Z');
  });

  it('utm 付き広告流入を記録する', () => {
    const a = build('https://autobanner.jp/lp02?utm_source=google&utm_medium=cpc&utm_campaign=brand&gclid=xyz');
    expect(a.ch).toBe('paid_google');
    expect(a.src).toBe('google');
    expect(a.med).toBe('cpc');
    expect(a.cmp).toBe('brand');
    expect(a.gclid).toBe('xyz');
  });

  it('同一ホストの referer は内部遷移として捨てる', () => {
    const a = build('https://autobanner.jp/price', 'https://autobanner.jp/lp01');
    expect(a.ref).toBeUndefined();
    expect(a.ch).toBe('direct');
  });

  it('壊れた referer で落ちない', () => {
    const a = build('https://autobanner.jp/', 'not-a-url');
    expect(a.ch).toBe('direct');
  });
});

describe('cookie の往復', () => {
  it('serialize したものを parse で戻せる', () => {
    const a = build('https://autobanner.jp/lp01?utm_source=note&utm_medium=post', 'https://note.com/foo');
    const restored = parseAttributionCookie(serializeAttribution(a));
    expect(restored).toEqual(a);
  });

  it('cookie が長すぎる場合は必須項目に落として上限内に収める', () => {
    const long = 'x'.repeat(200);
    const a = build(
      `https://autobanner.jp/lp01?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}&utm_term=${long}&utm_content=${long}&gclid=${long}&fbclid=${long}`,
    );
    const cookie = serializeAttribution(a);
    expect(cookie.length).toBeLessThanOrEqual(900);
    expect(parseAttributionCookie(cookie)?.ch).toBe('paid_google');
  });

  it('壊れた cookie は null', () => {
    expect(parseAttributionCookie('%%%broken%%%')).toBeNull();
    expect(parseAttributionCookie(undefined)).toBeNull();
    expect(parseAttributionCookie(encodeURIComponent('{"foo":1}'))).toBeNull();
  });
});

describe('formatAttributionLines', () => {
  it('計測なしでも 1 行返す', () => {
    const lines = formatAttributionLines(null);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('計測なし');
  });

  it('チャネルと詳細と着地を返す', () => {
    const a = build('https://autobanner.jp/lp01?utm_source=google&utm_medium=cpc');
    const text = formatAttributionLines(a).join('\n');
    expect(text).toContain('Google 広告');
    expect(text).toContain('utm_source=google');
    expect(text).toContain('/lp01');
  });
});
