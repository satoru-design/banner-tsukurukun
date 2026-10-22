import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_PATHS, PUBLIC_PATH_PREFIXES, isPublicPath } from '@/lib/auth/public-paths';

const repoRoot = process.cwd();

function vercelCronPaths(): string[] {
  const raw = readFileSync(join(repoRoot, 'vercel.json'), 'utf8');
  const parsed = JSON.parse(raw) as { crons?: { path: string }[] };
  return (parsed.crons ?? []).map((c) => c.path);
}

/** src/app/api/cron 配下の route.ts から URL パスを組み立てる。 */
function cronRoutePaths(): string[] {
  const base = join(repoRoot, 'src/app/api/cron');
  return readdirSync(base)
    .filter((name) => {
      const dir = join(base, name);
      if (!statSync(dir).isDirectory()) return false;
      try {
        return statSync(join(dir, 'route.ts')).isFile();
      } catch {
        return false;
      }
    })
    .map((name) => `/api/cron/${name}`);
}

describe('isPublicPath', () => {
  it('matches the exact-match entries', () => {
    expect(isPublicPath('/signin')).toBe(true);
    expect(isPublicPath('/api/billing/webhook')).toBe(true);
  });

  it('matches by prefix', () => {
    expect(isPublicPath('/api/auth/callback/google')).toBe(true);
    expect(isPublicPath('/site/someone/my-lp')).toBe(true);
  });

  it('does not treat an exact-match entry as a prefix', () => {
    // '/signin' は完全一致のみ。配下を勝手に公開しない。
    expect(isPublicPath('/signin/extra')).toBe(false);
  });

  it('keeps the generation and history endpoints private', () => {
    for (const p of [
      '/api/generate-image',
      '/api/ironclad-generate',
      '/api/generate-video',
      '/api/analyze-lp',
      '/api/analyze-banner',
      '/api/generate-copy',
      '/api/style-profile',
      '/api/style-profile/abc123',
      '/api/history',
      '/api/assets',
      '/api/save-banner',
      '/api/share',
      '/api/admin/grant-plan',
      '/account',
      '/ironclad',
    ]) {
      expect(isPublicPath(p), `${p} should stay behind the session gate`).toBe(false);
    }
  });
});

// 回帰テスト本体。
// Vercel Cron はセッション Cookie を送らないので、middleware を通さない cron は
// 401 で落ちて黙って実行されなくなる。以前 15 本中 12 本がこの状態だった。
describe('Vercel Cron reachability through the middleware', () => {
  it('lets every cron in vercel.json through', () => {
    const blocked = vercelCronPaths().filter((p) => !isPublicPath(p));
    expect(blocked).toEqual([]);
  });

  it('lets every cron route under src/app/api/cron through', () => {
    const blocked = cronRoutePaths().filter((p) => !isPublicPath(p));
    expect(blocked).toEqual([]);
  });

  it('finds at least one cron, so an empty list cannot make this pass silently', () => {
    expect(vercelCronPaths().length).toBeGreaterThan(0);
    expect(cronRoutePaths().length).toBeGreaterThan(0);
  });
});

// 外部プロバイダからの webhook も Cookie を持たないため同じ扱いが必要。
describe('payment webhooks through the middleware', () => {
  it('lets the Stripe, Pay.jp and STORES webhooks through', () => {
    for (const p of [
      '/api/billing/webhook',
      '/api/billing/payjp/webhook',
      '/api/billing/stores/webhook',
    ]) {
      expect(isPublicPath(p), `${p} must reach its route to verify the signature`).toBe(true);
    }
  });
});

describe('public path definitions', () => {
  it('has no duplicate entries', () => {
    expect(new Set(PUBLIC_PATHS).size).toBe(PUBLIC_PATHS.length);
    expect(new Set(PUBLIC_PATH_PREFIXES).size).toBe(PUBLIC_PATH_PREFIXES.length);
  });

  it('lists only absolute paths', () => {
    for (const p of [...PUBLIC_PATHS, ...PUBLIC_PATH_PREFIXES]) {
      expect(p.startsWith('/'), `${p} must start with /`).toBe(true);
    }
  });

  // prefix は配下すべてを公開するため、増やすときは必ず意図的であってほしい。
  it('keeps the prefix list to the reviewed set', () => {
    expect([...PUBLIC_PATH_PREFIXES].sort()).toEqual(
      ['/_next', '/api/auth', '/api/cron', '/legal', '/site'].sort(),
    );
  });
});
