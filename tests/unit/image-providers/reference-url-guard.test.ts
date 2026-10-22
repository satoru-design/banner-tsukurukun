import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 画像プロバイダが参照画像 URL のガードで投げるメッセージの分類を固定する。
 *
 * generateWithFallback は例外メッセージを正規表現で見て
 * 「一時エラーならもう一方のプロバイダへ回す / 恒久エラーなら即 throw」を
 * 決めている (src/lib/image-providers/index.ts の isTransientError)。
 *
 * 恒久エラーのメッセージに URL を入れると、`http://10.0.0.5:500/` のような
 * ポート番号が `5\d\d` に偶然一致して「一時エラー」に化け、
 * もう一方の有料プロバイダへ無駄な課金が走る。
 */

const repoRoot = process.cwd();

/** index.ts の isTransientError と同じ判定。 */
const TRANSIENT_RE =
  /timeout|abort|5\d\d|rate.?limit|ECONN|ETIMEDOUT|ENOTFOUND|socket hang up/i;

function isTransient(message: string): boolean {
  return TRANSIENT_RE.test(message);
}

const PERMANENT_MESSAGE = 'Blocked reference image URL (not a public address)';
const TRANSIENT_MESSAGE = 'Failed to resolve reference image: ENOTFOUND';

describe('isTransientError classification (mirrored from index.ts)', () => {
  it('treats the blocked-URL message as permanent', () => {
    expect(isTransient(PERMANENT_MESSAGE)).toBe(false);
  });

  it('treats the DNS-failure message as transient', () => {
    expect(isTransient(TRANSIENT_MESSAGE)).toBe(true);
  });

  // ここが本題。URL をメッセージに入れると分類が壊れる。
  it('would misclassify if the blocked URL were interpolated into the message', () => {
    for (const url of ['http://10.0.0.5:500/x.png', 'http://127.0.0.1:5000/a']) {
      expect(
        isTransient(`Blocked reference image URL: ${url}`),
        'a port like :500 matches the 5\\d\\d branch — this is why the URL is kept out',
      ).toBe(true);
    }
  });
});

describe('provider sources keep the URL out of the permanent message', () => {
  const sources = ['src/lib/image-providers/imagen4.ts', 'src/lib/image-providers/openai.ts'];

  for (const rel of sources) {
    it(`${rel} uses the fixed permanent message`, () => {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src).toContain(PERMANENT_MESSAGE);
    });

    it(`${rel} does not interpolate the URL into a "Blocked" message`, () => {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src).not.toMatch(/Blocked reference image URL: \$\{/);
    });

    it(`${rel} guards the reference URL before fetching it`, () => {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src).toContain('assertPublicHttpUrl');
      // リダイレクト追従を切らないと 302 で内部アドレスへ飛ばせる。
      expect(src).toContain("redirect: 'manual'");
    });
  }
});

describe("isTransientError's own regex still behaves as assumed", () => {
  it('matches the transient signals the fallback relies on', () => {
    for (const m of ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'socket hang up', 'rate limit', '503']) {
      expect(isTransient(m), `${m} should stay transient`).toBe(true);
    }
  });

  it('does not match an ordinary permanent failure', () => {
    for (const m of ['Invalid API key', 'safety violation', 'bad request']) {
      expect(isTransient(m), `${m} should stay permanent`).toBe(false);
    }
  });
});
