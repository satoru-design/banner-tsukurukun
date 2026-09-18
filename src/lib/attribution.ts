/**
 * 流入計測 (first touch attribution)
 *
 * 目的: 新規登録が「どこから来たか」を GA4 と独立に、ユーザー単位で保持する。
 * GA4 (GTM-T4ZNBZ7R / G-4WQ14T471C) はセッション単位の集計しか答えないので、
 * 「この登録者はどの経路か」を Slack 通知と DB に残すためにこちらを併設する。
 *
 * 仕組み:
 *   1. middleware が初回リクエストで cookie `ab_attr` を焼く (first touch 固定・上書きしない)
 *   2. auth events.signIn (isNewUser) が cookie を読み、Slack 通知と User 行に載せる
 *
 * cookie は 400 日 (Chrome の上限)。値は JSON を encodeURIComponent したもの。
 */

export const ATTRIBUTION_COOKIE = 'ab_attr';
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 400;

/** cookie 全体をこのサイズに収める (ヘッダ肥大の防止) */
const MAX_COOKIE_LENGTH = 900;
/** 個々のフィールドの最大長 */
const MAX_FIELD_LENGTH = 120;

export type AttributionChannel =
  | 'paid_google'
  | 'paid_meta'
  | 'paid_other'
  | 'organic_search'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct';

export type Attribution = {
  /** first touch の時刻 (ISO) */
  t: string;
  /** 導出したチャネル */
  ch: AttributionChannel;
  /** 最初に着地したパス */
  lp: string;
  /** referer (host + path)。同一ホスト・空なら undefined */
  ref?: string;
  src?: string;
  med?: string;
  cmp?: string;
  trm?: string;
  cnt?: string;
  gclid?: string;
  fbclid?: string;
};

const SEARCH_HOSTS = [
  'google.',
  'bing.',
  'search.yahoo.',
  'yahoo.co.jp',
  'duckduckgo.',
  'ecosia.',
  'baidu.',
  'naver.',
];

const SOCIAL_HOSTS = [
  't.co',
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'threads.net',
  'youtube.com',
  'note.com',
  'hatena.ne.jp',
  'reddit.com',
];

const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'paid_social', 'display', 'banner'];

function clip(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_FIELD_LENGTH);
}

function hostMatches(host: string, needles: string[]): boolean {
  return needles.some((n) => host === n || host.endsWith(n) || host.includes(n));
}

/**
 * チャネル導出。
 * 優先順位: クリック ID > utm_medium > referer ホスト > direct
 */
export function deriveChannel(input: {
  gclid?: string;
  fbclid?: string;
  src?: string;
  med?: string;
  refHost?: string;
}): AttributionChannel {
  if (input.gclid) return 'paid_google';
  if (input.fbclid) return 'paid_meta';

  const med = (input.med ?? '').toLowerCase();
  const src = (input.src ?? '').toLowerCase();

  if (med.includes('email') || med.includes('newsletter')) return 'email';

  if (PAID_MEDIUMS.some((m) => med === m || med.includes(m))) {
    if (src.includes('google')) return 'paid_google';
    if (src.includes('facebook') || src.includes('instagram') || src.includes('meta')) return 'paid_meta';
    return 'paid_other';
  }

  const refHost = (input.refHost ?? '').toLowerCase();
  if (refHost) {
    if (hostMatches(refHost, SEARCH_HOSTS)) return 'organic_search';
    if (hostMatches(refHost, SOCIAL_HOSTS)) return 'social';
    return 'referral';
  }

  // referer が無くても utm が付いていれば何らかの外部施策からの流入
  if (src) return 'referral';

  return 'direct';
}

/**
 * リクエストから first touch の attribution を組み立てる。
 * 同一ホストからの referer は内部遷移なので捨てる。
 */
export function buildAttribution(input: {
  url: URL;
  referer?: string | null;
  host?: string | null;
  now?: Date;
}): Attribution {
  const q = input.url.searchParams;
  const selfHost = (input.host ?? input.url.host ?? '').toLowerCase();

  let refHost: string | undefined;
  let ref: string | undefined;
  if (input.referer) {
    try {
      const refUrl = new URL(input.referer);
      const h = refUrl.host.toLowerCase();
      if (h && h !== selfHost) {
        refHost = h;
        ref = clip(`${h}${refUrl.pathname}`);
      }
    } catch {
      // 壊れた referer は無視する
    }
  }

  const gclid = clip(q.get('gclid'));
  const fbclid = clip(q.get('fbclid'));
  const src = clip(q.get('utm_source'));
  const med = clip(q.get('utm_medium'));

  const attribution: Attribution = {
    t: (input.now ?? new Date()).toISOString(),
    ch: deriveChannel({ gclid, fbclid, src, med, refHost }),
    lp: clip(input.url.pathname) ?? '/',
  };

  if (ref) attribution.ref = ref;
  if (src) attribution.src = src;
  if (med) attribution.med = med;
  const cmp = clip(q.get('utm_campaign'));
  if (cmp) attribution.cmp = cmp;
  const trm = clip(q.get('utm_term'));
  if (trm) attribution.trm = trm;
  const cnt = clip(q.get('utm_content'));
  if (cnt) attribution.cnt = cnt;
  if (gclid) attribution.gclid = gclid;
  if (fbclid) attribution.fbclid = fbclid;

  return attribution;
}

/**
 * cookie 値に変換する。長すぎる場合は必須項目だけに落とす。
 *
 * URL エンコードはしない。Next.js の cookies API が set/get で対称に
 * エンコード・デコードするため、こちらで二重に掛けると読み出しがずれる。
 */
export function serializeAttribution(attribution: Attribution): string {
  const full = JSON.stringify(attribution);
  if (full.length <= MAX_COOKIE_LENGTH) return full;
  const minimal: Attribution = {
    t: attribution.t,
    ch: attribution.ch,
    lp: attribution.lp,
  };
  if (attribution.src) minimal.src = attribution.src;
  if (attribution.med) minimal.med = attribution.med;
  return JSON.stringify(minimal).slice(0, MAX_COOKIE_LENGTH);
}

/**
 * cookie 値を復元する。壊れていれば null。
 * 素の JSON と URL エンコード済みの両方を受ける（読み手側の差を吸収する）。
 */
export function parseAttributionCookie(value: string | null | undefined): Attribution | null {
  if (!value) return null;

  const candidates = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    // 不正なエスケープはそのまま素の値で試す
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;
      const o = parsed as Record<string, unknown>;
      if (typeof o.t !== 'string' || typeof o.ch !== 'string' || typeof o.lp !== 'string') continue;
      return o as unknown as Attribution;
    } catch {
      // 次の候補へ
    }
  }
  return null;
}

const CHANNEL_LABEL: Record<AttributionChannel, string> = {
  paid_google: ':moneybag: Google 広告',
  paid_meta: ':moneybag: Meta 広告',
  paid_other: ':moneybag: 広告 (その他)',
  organic_search: ':mag: 自然検索',
  social: ':bird: SNS',
  email: ':email: メール',
  referral: ':link: 他サイト経由',
  direct: ':door: 直接/不明',
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return ':grey_question: 計測なし';
  return CHANNEL_LABEL[channel as AttributionChannel] ?? `:grey_question: ${channel}`;
}

/** Slack 通知に差し込む行を組み立てる。 */
export function formatAttributionLines(attribution: Attribution | null): string[] {
  if (!attribution) {
    return ['流入: `計測なし` (cookie 取得前の登録 / cookie ブロック)'];
  }

  const lines = [`流入: ${channelLabel(attribution.ch)}`];

  const detail: string[] = [];
  if (attribution.ref) detail.push(`ref=${attribution.ref}`);
  if (attribution.src) detail.push(`utm_source=${attribution.src}`);
  if (attribution.med) detail.push(`utm_medium=${attribution.med}`);
  if (attribution.cmp) detail.push(`utm_campaign=${attribution.cmp}`);
  if (attribution.trm) detail.push(`utm_term=${attribution.trm}`);
  if (attribution.gclid) detail.push('gclid=あり');
  if (attribution.fbclid) detail.push('fbclid=あり');
  if (detail.length > 0) lines.push(`　${detail.join(' / ')}`);

  lines.push(`初回着地: \`${attribution.lp}\` (${attribution.t})`);
  return lines;
}
