/**
 * 特性テスト: generateWithFallback の「画像生成 API を何回叩くか」を固定する。
 *
 * ここが壊れると直接金が出る経路。1 回の生成要求に対して何回プロバイダを
 * 呼ぶかがコストそのものなので、呼び出し回数を常に厳密に数える。
 *
 * 実プロバイダは全てモックするので、API キーもネットワークも不要。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GenerateParams, GenerateResult } from '@/lib/image-providers/types';

const { imagen4Generate, fluxGenerate, gptImageGenerate } = vi.hoisted(() => ({
  imagen4Generate: vi.fn(),
  fluxGenerate: vi.fn(),
  gptImageGenerate: vi.fn(),
}));

vi.mock('@/lib/image-providers/imagen4', () => ({
  imagen4Provider: { id: 'imagen4', displayName: 'Imagen 4', generate: imagen4Generate },
}));
vi.mock('@/lib/image-providers/flux', () => ({
  fluxProvider: { id: 'flux', displayName: 'FLUX', generate: fluxGenerate },
}));
vi.mock('@/lib/image-providers/openai', () => ({
  gptImageProvider: { id: 'gpt-image', displayName: 'GPT Image', generate: gptImageGenerate },
}));

import { generateWithFallback } from '@/lib/image-providers';
import { ImageProviderError } from '@/lib/image-providers/types';

const params: GenerateParams = { prompt: 'テスト用バナー', aspectRatio: '1:1' };

const ok = (providerId: GenerateResult['providerId']): GenerateResult => ({
  base64: 'data:image/png;base64,FAKE_TEST_IMAGE_NOT_REAL',
  providerId,
  providerMetadata: {},
});

/** 全プロバイダの合計呼び出し回数 = 1 回の生成要求で発生した課金回数。 */
const totalCalls = () =>
  imagen4Generate.mock.calls.length +
  fluxGenerate.mock.calls.length +
  gptImageGenerate.mock.calls.length;

beforeEach(() => vi.clearAllMocks());

describe('generateWithFallback: API 呼び出し回数', () => {
  it('成功時は 1 回だけ課金される', async () => {
    // 壊れたら落ちる: 成功したのに2つ目のプロバイダも呼んでしまう（二重課金）。
    imagen4Generate.mockResolvedValue(ok('imagen4'));

    const r = await generateWithFallback('imagen4', params);

    expect(r.providerId).toBe('imagen4');
    expect(imagen4Generate).toHaveBeenCalledTimes(1);
    expect(fluxGenerate).not.toHaveBeenCalled();
    expect(totalCalls()).toBe(1);
  });

  it('恒久エラーではフォールバックせず 1 回で止まる', async () => {
    // 壊れたら落ちる: 認証エラーやセーフティ違反でも次のプロバイダを呼び、
    // 確実に失敗する2回目に無駄課金する（isTransientError の判定崩れ）。
    imagen4Generate.mockRejectedValue(
      new ImageProviderError('imagen4', 'safety filter blocked this prompt'),
    );

    await expect(generateWithFallback('imagen4', params)).rejects.toThrow(/safety filter/);

    expect(imagen4Generate).toHaveBeenCalledTimes(1);
    expect(fluxGenerate).not.toHaveBeenCalled();
    expect(totalCalls()).toBe(1);
  });

  it('一時エラーでは 1 回だけフォールバックし、合計 2 回で打ち止めになる', async () => {
    // 壊れたら落ちる: フォールバックが無くなる（可用性低下）か、
    // 3回以上リトライしてコストが膨らむ。
    imagen4Generate.mockRejectedValue(new ImageProviderError('imagen4', 'request timeout'));
    fluxGenerate.mockResolvedValue(ok('flux'));

    const r = await generateWithFallback('imagen4', params);

    expect(r.providerId).toBe('flux');
    expect(r.providerMetadata).toMatchObject({ fallback: true, preferredProvider: 'imagen4' });
    expect(imagen4Generate).toHaveBeenCalledTimes(1);
    expect(fluxGenerate).toHaveBeenCalledTimes(1);
    expect(totalCalls()).toBe(2);
  });

  it('両方一時エラーでも合計 2 回を超えない', async () => {
    // 壊れたら落ちる: 全滅時に無限リトライ・追加プロバイダ呼び出しが入る。
    imagen4Generate.mockRejectedValue(new ImageProviderError('imagen4', 'rate limit exceeded'));
    fluxGenerate.mockRejectedValue(new ImageProviderError('flux', 'upstream 503'));

    await expect(generateWithFallback('imagen4', params)).rejects.toThrow(/503/);

    expect(totalCalls()).toBe(2);
    expect(gptImageGenerate).not.toHaveBeenCalled();
  });

  it('gpt-image は高コストなので一時エラーでもフォールバックしない', async () => {
    // 壊れたら落ちる: 最も高い gpt-image の失敗後に別プロバイダも呼ばれ、
    // 1 要求で 2 プロバイダ分課金される。
    gptImageGenerate.mockRejectedValue(new ImageProviderError('gpt-image', 'request timeout'));

    await expect(generateWithFallback('gpt-image', params)).rejects.toThrow(/timeout/);

    expect(gptImageGenerate).toHaveBeenCalledTimes(1);
    expect(imagen4Generate).not.toHaveBeenCalled();
    expect(fluxGenerate).not.toHaveBeenCalled();
    expect(totalCalls()).toBe(1);
  });

  it('preferred=flux のフォールバック順は flux → imagen4（gpt-image を巻き込まない）', async () => {
    // 壊れたら落ちる: 順序が崩れて、安いプロバイダの代わりに
    // 高い gpt-image がフォールバック先になる。
    fluxGenerate.mockRejectedValue(new ImageProviderError('flux', 'ECONNRESET'));
    imagen4Generate.mockResolvedValue(ok('imagen4'));

    const r = await generateWithFallback('flux', params);

    expect(r.providerId).toBe('imagen4');
    expect(gptImageGenerate).not.toHaveBeenCalled();
    expect(totalCalls()).toBe(2);
  });
});
