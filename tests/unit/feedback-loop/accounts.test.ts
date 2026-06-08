import { describe, it, expect, afterEach, vi } from 'vitest';
import { envKeyBase, getAccountMetaToken, getAccountWebhook, AccountConfigError } from '@/lib/feedback-loop/accounts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('envKeyBase', () => {
  it('slug をENVキーへ変換（- を _ ・大文字）', () => {
    expect(envKeyBase('five-point-detox')).toBe('FIVE_POINT_DETOX');
    expect(envKeyBase('kokoromil')).toBe('KOKOROMIL');
  });
});

describe('getAccountMetaToken', () => {
  it('env から token を返す', () => {
    vi.stubEnv('ACCOUNT_KOKOROMIL_META_TOKEN', 'tok123');
    expect(getAccountMetaToken('kokoromil')).toBe('tok123');
  });
  it('未設定なら AccountConfigError', () => {
    expect(() => getAccountMetaToken('kokoromil')).toThrow(AccountConfigError);
  });
});

describe('getAccountWebhook', () => {
  it('専用 webhook を優先', () => {
    vi.stubEnv('ACCOUNT_KOKOROMIL_SLACK_WEBHOOK', 'https://hooks/abc');
    expect(getAccountWebhook('kokoromil')).toBe('https://hooks/abc');
  });
  it('未設定なら NEW_USER にフォールバック', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL_NEW_USER', 'https://hooks/fallback');
    expect(getAccountWebhook('kokoromil')).toBe('https://hooks/fallback');
  });
});
