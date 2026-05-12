/**
 * 参照画像URLの生存確認ヘルパ。
 *
 * Asset 削除や Blob 障害で past Generation の briefSnapshot に
 * 404 URL が残っているケースがある。gpt-image-2 は images.edit / Responses API
 * いずれでも参照URLの404を即エラー (400 / "Upstream status code: 404") にする。
 *
 * このヘルパは並列 HEAD でURLの生存を確認し、生きているものだけ返す。
 * 死んだURLは silently ドロップして console.warn する。
 */

const HEAD_TIMEOUT_MS = 4000;

async function isAvailable(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function filterAvailableUrls(
  urls: ReadonlyArray<string | null | undefined>,
): Promise<{ available: string[]; dropped: string[] }> {
  const cleaned = urls.filter((u): u is string => Boolean(u && u.trim()));
  if (cleaned.length === 0) return { available: [], dropped: [] };

  const checks = await Promise.all(cleaned.map((u) => isAvailable(u).then((ok) => ({ url: u, ok }))));
  const available = checks.filter((c) => c.ok).map((c) => c.url);
  const dropped = checks.filter((c) => !c.ok).map((c) => c.url);

  if (dropped.length > 0) {
    console.warn(
      `[url-availability] dropped ${dropped.length} dead reference URL(s):`,
      dropped.map((u) => u.slice(-80)).join(', '),
    );
  }
  return { available, dropped };
}
