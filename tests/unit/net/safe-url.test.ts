import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const lookup = vi.fn();
vi.mock('node:dns/promises', () => ({
  lookup: (host: string, opts: unknown) => lookup(host, opts),
}));

import { isPublicIp, assertPublicHttpUrl, UnsafeUrlError } from '@/lib/net/safe-url';

/** 名前解決が常にこのアドレスを返すようにする。 */
function resolvesTo(address: string, family = 4) {
  lookup.mockResolvedValue([{ address, family }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  resolvesTo('93.184.216.34'); // example.com、グローバル
});

afterEach(() => vi.restoreAllMocks());

describe('isPublicIp (IPv4)', () => {
  const blocked = [
    ['0.0.0.0', 'this network'],
    ['10.0.0.5', 'private'],
    ['100.64.0.1', 'CGNAT'],
    ['127.0.0.1', 'loopback'],
    ['169.254.169.254', 'cloud metadata'],
    ['172.16.0.1', 'private'],
    ['172.31.255.254', 'private (upper bound)'],
    ['192.168.1.1', 'private'],
    ['192.0.2.1', 'TEST-NET-1'],
    ['198.18.0.1', 'benchmarking'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
  ] as const;

  for (const [addr, why] of blocked) {
    it(`rejects ${addr} (${why})`, () => {
      expect(isPublicIp(addr, 4)).toBe(false);
    });
  }

  const allowed = ['8.8.8.8', '93.184.216.34', '1.1.1.1', '172.32.0.1', '11.0.0.1'];
  for (const addr of allowed) {
    it(`allows ${addr}`, () => {
      expect(isPublicIp(addr, 4)).toBe(true);
    });
  }

  it('rejects a malformed address', () => {
    expect(isPublicIp('999.1.1.1', 4)).toBe(false);
    expect(isPublicIp('not-an-ip', 4)).toBe(false);
  });
});

describe('isPublicIp (IPv6)', () => {
  const blocked = [
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fc00::1', 'unique-local'],
    ['fd12:3456::1', 'unique-local'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentation'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['64:ff9b::7f00:1', 'NAT64'],
  ] as const;

  for (const [addr, why] of blocked) {
    it(`rejects ${addr} (${why})`, () => {
      expect(isPublicIp(addr, 6)).toBe(false);
    });
  }

  it('allows a global address', () => {
    expect(isPublicIp('2606:2800:220:1:248:1893:25c8:1946', 6)).toBe(true);
  });

  it('strips a zone id before judging', () => {
    expect(isPublicIp('fe80::1%eth0', 6)).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  it('accepts an ordinary https URL', async () => {
    await expect(assertPublicHttpUrl('https://example.com/a.png')).resolves.toBeInstanceOf(URL);
  });

  it('rejects a non-http scheme', async () => {
    for (const u of ['file:///etc/passwd', 'gopher://x/', 'ftp://x/a', 'data:text/html,x']) {
      await expect(assertPublicHttpUrl(u)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });

  it('rejects a malformed URL', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  // 本体の回帰テスト: 以前は `^https?://` だけの検証だった。
  it('rejects a host that resolves to cloud metadata', async () => {
    resolvesTo('169.254.169.254');
    await expect(assertPublicHttpUrl('http://metadata.evil.test/latest/meta-data/')).rejects.toThrow(
      /内部ネットワーク/,
    );
  });

  it('rejects loopback by name and by literal', async () => {
    resolvesTo('127.0.0.1');
    await expect(assertPublicHttpUrl('http://localhost:3000/api/x')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    await expect(assertPublicHttpUrl('http://127.0.0.1:3000/api/x')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it('rejects a private address', async () => {
    resolvesTo('10.0.0.5');
    await expect(assertPublicHttpUrl('http://internal.test:8080/')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  // DNS が複数レコードを返し、片方だけ内部のケース。
  it('rejects when any resolved record is internal', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(assertPublicHttpUrl('http://split.test/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('rejects credentials embedded in the URL', async () => {
    await expect(assertPublicHttpUrl('https://user:pw@example.com/a')).rejects.toThrow(/認証情報/);
  });

  it('rejects a host that cannot be resolved', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicHttpUrl('https://nope.invalid/a')).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it('rejects an empty resolution result', async () => {
    lookup.mockResolvedValue([]);
    await expect(assertPublicHttpUrl('https://empty.test/a')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('resolves the hostname, not the full URL', async () => {
    await assertPublicHttpUrl('https://example.com:8443/deep/path?q=1');
    expect(lookup).toHaveBeenCalledWith('example.com', { all: true });
  });
});
