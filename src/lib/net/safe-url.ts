/**
 * ユーザー指定 URL をサーバーから fetch する前の検証（SSRF 対策）。
 *
 * このアプリは「競合バナーの URL を貼る」「参照画像の URL を渡す」という
 * 機能を持つため、送信先ホストを allowlist で固定できない。
 * そこで名前解決した IP がグローバルアドレスであることを確認する。
 *
 * 守る対象の例:
 *   http://169.254.169.254/...      クラウドのメタデータ endpoint
 *   http://127.0.0.1:3000/api/...   自分自身の内部 API
 *   http://10.0.0.5:8080/...        同一 VPC の内部サービス
 *
 * 注意: 名前解決の後に DNS が差し替わる rebinding は、この方式では
 * 完全には防げない。IP を直接 fetch すると TLS の SNI と証明書検証が
 * 壊れるため、ここでは「解決した全アドレスの検証 + リダイレクト追従の停止」
 * という現実的な線を採る。
 */
import { lookup } from 'node:dns/promises';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export class UnsafeUrlError extends Error {
  /**
   * 一時的な失敗か。名前解決の失敗は一時的なことがあるので true。
   * 「内部アドレス宛」「スキーム違反」は恒久エラーなので false。
   *
   * 呼び出し側の再試行・フォールバック判定に使う。これが無いと
   * 一時的な DNS 障害を恒久エラーとして扱い、画像生成の
   * プロバイダ間フォールバックが働かなくなる。
   */
  readonly transient: boolean;

  constructor(message: string, opts: { transient?: boolean } = {}) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.transient = opts.transient === true;
  }
}

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(addrInt: number, base: string, prefixLen: number): boolean {
  const baseParts = base.split('.').map(Number);
  const baseInt = ipv4ToInt(baseParts);
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (addrInt & mask) === (baseInt & mask);
}

/** グローバルに到達可能でない IPv4 レンジ。 */
const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local（クラウドのメタデータ）
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved（255.255.255.255 を含む）
];

function isPublicIpv4(addr: string): boolean {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const asInt = ipv4ToInt(parts);
  return !BLOCKED_V4.some(([base, len]) => inCidr(asInt, base, len));
}

function isPublicIpv6(addr: string): boolean {
  const lower = addr.toLowerCase().split('%')[0]; // zone id を落とす

  // IPv4-mapped / IPv4-compatible (::ffff:a.b.c.d, ::a.b.c.d) は v4 として判定
  const v4Embedded = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Embedded) return isPublicIpv4(v4Embedded[1]);

  if (lower === '::' || lower === '::1') return false; // unspecified / loopback

  const head = lower.split(':')[0];
  const headNum = parseInt(head || '0', 16);

  // fc00::/7 unique-local
  if ((headNum & 0xfe00) === 0xfc00) return false;
  // fe80::/10 link-local
  if ((headNum & 0xffc0) === 0xfe80) return false;
  // ff00::/8 multicast
  if ((headNum & 0xff00) === 0xff00) return false;
  // 2001:db8::/32 documentation
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return false;
  // 64:ff9b::/96 NAT64（末尾に v4 が埋まるが上の分岐で拾えない表記もある）
  if (lower.startsWith('64:ff9b:')) return false;

  return true;
}

export function isPublicIp(addr: string, family: number): boolean {
  return family === 4 ? isPublicIpv4(addr) : isPublicIpv6(addr);
}

/**
 * 外部へ fetch してよい URL かを検証する。
 *
 * @throws UnsafeUrlError 形式不正、許可外スキーム、非グローバル IP のとき
 * @returns 解析済みの URL
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL の形式が不正です');
  }

  if (!ALLOWED_PROTOCOLS.includes(u.protocol)) {
    throw new UnsafeUrlError('http または https の URL のみ指定できます');
  }

  // 資格情報付き URL は拒否する（プロキシや上流への意図しない認証を防ぐ）
  if (u.username || u.password) {
    throw new UnsafeUrlError('URL に認証情報を含めることはできません');
  }

  let records: { address: string; family: number }[];
  try {
    records = await lookup(u.hostname, { all: true });
  } catch {
    throw new UnsafeUrlError('ホスト名を解決できませんでした', { transient: true });
  }

  if (records.length === 0) {
    throw new UnsafeUrlError('ホスト名を解決できませんでした', { transient: true });
  }

  // 1 つでも内部アドレスに解決するなら拒否する。
  for (const r of records) {
    if (!isPublicIp(r.address, r.family)) {
      throw new UnsafeUrlError('内部ネットワーク宛の URL は指定できません');
    }
  }

  return u;
}

/**
 * 検証済みの URL を取得する。リダイレクトは追わない
 * （302 で内部アドレスへ飛ばす迂回を防ぐ）。
 *
 * @param maxBytes 受け取る最大バイト数。超えたら UnsafeUrlError。
 */
export async function safeFetch(
  raw: string,
  opts: { maxBytes: number; timeoutMs?: number; method?: 'GET' | 'HEAD' },
): Promise<{ bytes: ArrayBuffer; contentType: string | null; status: number }> {
  const url = await assertPublicHttpUrl(raw);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
    });

    // Content-Length で判る分は読む前に弾く。
    const declared = Number(res.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      throw new UnsafeUrlError('取得したファイルが大きすぎます');
    }

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > opts.maxBytes) {
      throw new UnsafeUrlError('取得したファイルが大きすぎます');
    }

    return {
      bytes,
      contentType: res.headers.get('content-type'),
      status: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}
