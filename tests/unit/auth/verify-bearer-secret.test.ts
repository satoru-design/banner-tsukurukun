import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  verifyBearerSecret,
  verifyCronSecret,
  verifySharedSecret,
} from '@/lib/auth/verify-bearer-secret';

const ENV = 'TEST_SHARED_SECRET';
const SECRET = 'a-sufficiently-long-secret-value';

function reqWithAuth(value?: string): Request {
  return new Request('https://example.test/api/cron/x', {
    headers: value ? new Headers({ authorization: value }) : new Headers(),
  });
}

beforeEach(() => {
  // console への警告/エラー出力でテスト出力が汚れるのを抑える
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env[ENV];
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe('verifyBearerSecret', () => {
  it('accepts the exact Bearer value', () => {
    process.env[ENV] = SECRET;
    expect(verifyBearerSecret(reqWithAuth(`Bearer ${SECRET}`), ENV)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    process.env[ENV] = SECRET;
    expect(verifyBearerSecret(reqWithAuth('Bearer nope'), ENV)).toBe(false);
  });

  it('rejects a missing Authorization header', () => {
    process.env[ENV] = SECRET;
    expect(verifyBearerSecret(reqWithAuth(), ENV)).toBe(false);
  });

  it('rejects the value without the Bearer prefix', () => {
    process.env[ENV] = SECRET;
    expect(verifyBearerSecret(reqWithAuth(SECRET), ENV)).toBe(false);
  });

  // 本体の回帰テスト: 以前の `authHeader !== \`Bearer ${process.env.X}\`` は
  // env 未設定時に "Bearer undefined" と一致してしまい誰でも通過できた。
  it('rejects "Bearer undefined" when the env var is unset', () => {
    expect(verifyBearerSecret(reqWithAuth('Bearer undefined'), ENV)).toBe(false);
  });

  it('rejects every request when the env var is unset', () => {
    expect(verifyBearerSecret(reqWithAuth('Bearer anything'), ENV)).toBe(false);
    expect(verifyBearerSecret(reqWithAuth(), ENV)).toBe(false);
  });

  it('rejects every request when the env var is an empty string', () => {
    process.env[ENV] = '';
    expect(verifyBearerSecret(reqWithAuth('Bearer '), ENV)).toBe(false);
    expect(verifyBearerSecret(reqWithAuth('Bearer undefined'), ENV)).toBe(false);
  });

  it('still accepts a short secret but warns about it', () => {
    process.env[ENV] = 'short';
    expect(verifyBearerSecret(reqWithAuth('Bearer short'), ENV)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('verifyCronSecret', () => {
  it('reads CRON_SECRET', () => {
    process.env.CRON_SECRET = SECRET;
    expect(verifyCronSecret(reqWithAuth(`Bearer ${SECRET}`))).toBe(true);
    expect(verifyCronSecret(reqWithAuth('Bearer other'))).toBe(false);
  });

  it('rejects "Bearer undefined" when CRON_SECRET is unset', () => {
    expect(verifyCronSecret(reqWithAuth('Bearer undefined'))).toBe(false);
  });
});

describe('verifySharedSecret', () => {
  it('accepts the matching candidate', () => {
    process.env[ENV] = SECRET;
    expect(verifySharedSecret(SECRET, ENV)).toBe(true);
  });

  it('rejects a wrong, null or empty candidate', () => {
    process.env[ENV] = SECRET;
    expect(verifySharedSecret('wrong', ENV)).toBe(false);
    expect(verifySharedSecret(null, ENV)).toBe(false);
    expect(verifySharedSecret(undefined, ENV)).toBe(false);
    expect(verifySharedSecret('', ENV)).toBe(false);
  });

  it('rejects anything when the env var is unset', () => {
    expect(verifySharedSecret('undefined', ENV)).toBe(false);
    expect(verifySharedSecret('anything', ENV)).toBe(false);
  });
});
