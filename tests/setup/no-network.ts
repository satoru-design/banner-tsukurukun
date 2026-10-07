/**
 * テスト全体の共通セットアップ。CI で「鍵なし・ネットワーク断」でも結果が変わらないことを保証する。
 *
 * やっていることは2つだけ。
 *
 * 1. 未スタブの `fetch` を即座に失敗させる。
 *    外部 API を本当に叩くテストがあれば、無言で課金されたりネットワーク状況で
 *    結果が揺れたりする代わりに、原因が分かるメッセージで落ちる。
 *    各テストは従来どおり `vi.stubGlobal('fetch', ...)` や
 *    `vi.spyOn(global, 'fetch')` で上書きすればよい。
 *
 * 2. 外部サービスの資格情報らしい環境変数を削除する。
 *    開発機の shell に本物の鍵が export されていても、CI（鍵なし）と同じ結果になる。
 *    テストが必要とするダミー値は各テストが beforeEach で明示的に設定している。
 *
 * setupFiles はテストファイル本体の評価より先に走るので、モジュールスコープで
 * process.env を読むプロバイダ（例: image-providers/imagen4.ts）にも効く。
 */

/** 値が資格情報らしい環境変数名のパターン。実際の値は一切ここに書かない。 */
const CREDENTIAL_PATTERNS = [
  /_API_KEY$/,
  /_API_TOKEN$/,
  /_SECRET$/,
  /_SECRET_KEY$/,
  /^.*WEBHOOK_URL.*$/,
  /^DATABASE_URL$/,
  /^BLOB_READ_WRITE_TOKEN$/,
  /^REPLICATE_API_TOKEN$/,
  /^GEMINI_API_KEY$/,
  /^FAL_KEY$/,
  /^AUTH_GOOGLE_ID$/,
];

for (const name of Object.keys(process.env)) {
  if (CREDENTIAL_PATTERNS.some((re) => re.test(name))) {
    delete process.env[name];
  }
}

/**
 * 未スタブの通信を落とす。メッセージに URL を含めて、どのテストが
 * どこへ出ようとしたかすぐ分かるようにする。
 */
const blockedFetch = ((input: unknown) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : String(input);

  throw new Error(
    `[no-network] Unstubbed network call to ${url}. ` +
      'Unit tests must not reach the network. ' +
      "Stub it in the test with vi.stubGlobal('fetch', ...) or vi.spyOn(global, 'fetch'), " +
      'or mock the client module with vi.mock().',
  );
}) as unknown as typeof fetch;

globalThis.fetch = blockedFetch;
