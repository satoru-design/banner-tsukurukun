import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAdInsightsForDate, InsightsConfigError } from '@/lib/feedback-loop/insights-client';

// ヘルパー: 最小限の InsightsRow に変換できる raw row を返す
function rawRow(adId: string, date = '2026-06-01') {
  return {
    ad_id: adId,
    date_start: date,
    impressions: '1000',
    clicks: '10',
    spend: '500',
    ctr: '1.0',
    cpm: '500',
    frequency: '1.5',
  };
}

// fetch mock ヘルパー: 1ページのみ返す
function mockFetchOnePage(rows: unknown[]) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: rows, paging: {} }),
    text: async () => '',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchAdInsightsForDate', () => {
  // --- 設定不足テスト ---

  it('META_INSIGHTS_ACCESS_TOKEN が未設定なら InsightsConfigError', async () => {
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', '');
    vi.stubEnv('META_AD_ACCOUNT_ID', '1234567890');
    await expect(fetchAdInsightsForDate('2026-06-01')).rejects.toBeInstanceOf(InsightsConfigError);
  });

  it('META_AD_ACCOUNT_ID が未設定なら InsightsConfigError', async () => {
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', 'some_token');
    vi.stubEnv('META_AD_ACCOUNT_ID', '');
    await expect(fetchAdInsightsForDate('2026-06-01')).rejects.toBeInstanceOf(InsightsConfigError);
  });

  it('両方未設定なら InsightsConfigError', async () => {
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', '');
    vi.stubEnv('META_AD_ACCOUNT_ID', '');
    await expect(fetchAdInsightsForDate('2026-06-01')).rejects.toBeInstanceOf(InsightsConfigError);
  });

  // --- 正常系: 1ページ ---

  it('1ページ返却 → 1件の正規化済み InsightsRow を返す', async () => {
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', 'test_token');
    vi.stubEnv('META_AD_ACCOUNT_ID', '9876543210');

    vi.stubGlobal('fetch', mockFetchOnePage([rawRow('ad_001')]));

    const rows = await fetchAdInsightsForDate('2026-06-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].adId).toBe('ad_001');
  });

  // --- ページネーション ---

  it('paging.next がある場合は 2 回 fetch し 2 件を返す', async () => {
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', 'test_token');
    vi.stubEnv('META_AD_ACCOUNT_ID', '9876543210');

    const mockFetch = vi
      .fn()
      // page 1: paging.next あり（token を含む URL だが fetch() に渡すだけ）
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [rawRow('ad_001')],
          paging: { next: 'https://graph.facebook.com/next?access_token=test_token&after=cursor1' },
        }),
        text: async () => '',
      })
      // page 2: paging なし
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [rawRow('ad_002')],
          paging: {},
        }),
        text: async () => '',
      });

    vi.stubGlobal('fetch', mockFetch);

    const rows = await fetchAdInsightsForDate('2026-06-01');
    expect(rows).toHaveLength(2);
    expect(rows[0].adId).toBe('ad_001');
    expect(rows[1].adId).toBe('ad_002');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // --- セキュリティ: token がエラーメッセージに含まれないこと ---

  it('非 ok レスポンス時のエラーメッセージに token が含まれない', async () => {
    const SENTINEL_TOKEN = 'SECRET_TOKEN_XYZ';
    vi.stubEnv('META_INSIGHTS_ACCESS_TOKEN', SENTINEL_TOKEN);
    vi.stubEnv('META_AD_ACCOUNT_ID', '9876543210');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"Invalid OAuth access token"}}',
        json: async () => ({}),
      }),
    );

    let errorMessage = '';
    try {
      await fetchAdInsightsForDate('2026-06-01');
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    expect(errorMessage).toBeTruthy();
    // token がエラーメッセージに含まれていないことを確認
    expect(errorMessage).not.toContain(SENTINEL_TOKEN);
    // ステータスコードはエラーに含まれること
    expect(errorMessage).toContain('401');
  });
});
