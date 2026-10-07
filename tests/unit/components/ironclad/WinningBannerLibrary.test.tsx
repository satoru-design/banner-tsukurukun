// @vitest-environment jsdom
/**
 * 特性テスト: 勝ちバナーライブラリの現状の振る舞いを固定する。
 *
 * 「参考中」が付いたバナーだけが次回のサジェスト生成プロンプトへ渡る。
 * 対象の件数が増えると画像生成 API に渡す情報量とコストが増えるため、
 * 直近3件に絞る挙動を厳密に押さえる。
 * fetch は必ずスタブするので、鍵もネットワークも不要。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';
import { WinningBannerLibrary } from '@/components/ironclad/WinningBannerLibrary';

vi.mock('./WinningBannerAddModal', () => ({ WinningBannerAddModal: () => null }));

function banner(n: number): WinningBannerDTO {
  return {
    id: `wb_test_${n}`,
    name: `勝ちバナー${n}`,
    blobUrl: `https://example.invalid/not-a-real-image-${n}.png`,
    mimeType: 'image/png',
    analysisAbstract: null,
    analysisVersion: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const noop = () => {};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ banners: [] })));
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});

async function renderWith(banners: WinningBannerDTO[], useWinningRef = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ banners })));
  await act(async () => {
    render(
      <WinningBannerLibrary useWinningRef={useWinningRef} onChangeUseWinningRef={noop} />,
    );
  });
}

describe('読み込み', () => {
  it('マウント時に1度だけ取得する', async () => {
    // 壊れたら落ちる: 取得が二重に走り、無駄なリクエストが出る。
    await renderWith([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/winning-banners');
  });

  it('解決前は読み込み中を出す', () => {
    // 壊れたら落ちる: 読み込み中の表示が出ず、空状態と区別できなくなる。
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<WinningBannerLibrary useWinningRef onChangeUseWinningRef={noop} />);
    expect(screen.getByText('読み込み中…')).toBeTruthy();
  });

  it('0件なら空状態の案内を出す', async () => {
    // 壊れたら落ちる: 未登録の利用者に次の行動が示されない。
    await renderWith([]);
    expect(screen.getByText(/まだ勝ちバナーがありません/)).toBeTruthy();
  });

  it('取得したバナーを並べる', async () => {
    // 壊れたら落ちる: 登録済みのバナーが表示されない。
    await renderWith([banner(1), banner(2)]);
    expect(screen.getByText('勝ちバナー1')).toBeTruthy();
    expect(screen.getByText('勝ちバナー2')).toBeTruthy();
  });

  it('HTTP エラーを表示する', async () => {
    // 壊れたら落ちる: 失敗が黙って無視され、空一覧と区別できなくなる。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await act(async () => {
      render(<WinningBannerLibrary useWinningRef onChangeUseWinningRef={noop} />);
    });
    expect(screen.getByText('HTTP 500')).toBeTruthy();
  });
});

describe('参考中の対象（画像生成プロンプトへ渡る件数）', () => {
  it('直近3件にだけ参考中を付ける', async () => {
    // 壊れたら落ちる: 4件以上がプロンプトへ渡り、API へ渡す情報量と
    // コストが増える。逆に減ると勝ちパターンの反映が弱まる。
    await renderWith([banner(1), banner(2), banner(3), banner(4), banner(5)]);
    expect(screen.getAllByText('参考中')).toHaveLength(3);
  });

  it('参考するチェックが外れていれば1件も参考中にしない', async () => {
    // 壊れたら落ちる: 参照しない設定なのにプロンプトへ渡り、意図しない
    // 生成結果と課金が発生する。
    await renderWith([banner(1), banner(2), banner(3)], false);
    expect(screen.queryByText('参考中')).toBeNull();
  });

  it('3件未満ならある分だけ参考中にする', async () => {
    // 壊れたら落ちる: 件数の数え方が崩れる。
    await renderWith([banner(1), banner(2)]);
    expect(screen.getAllByText('参考中')).toHaveLength(2);
  });
});

describe('件数の警告', () => {
  it('30件までは警告を出さない', async () => {
    // 壊れたら落ちる: 境界がずれて早すぎる警告が出る。
    await renderWith(Array.from({ length: 30 }, (_, i) => banner(i)));
    expect(screen.queryByText(/枚を超えています/)).toBeNull();
  });

  it('31件で警告を出す', async () => {
    // 壊れたら落ちる: 件数が膨らんでも警告が出ず、解析コストが増え続ける。
    await renderWith(Array.from({ length: 31 }, (_, i) => banner(i)));
    expect(screen.getByText(/30枚を超えています/)).toBeTruthy();
  });
});

describe('削除', () => {
  it('確認に OK したら DELETE し一覧から外す', async () => {
    // 壊れたら落ちる: 削除がサーバーに届かない、または画面に反映されない。
    await renderWith([banner(1), banner(2)]);
    const deleteMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', deleteMock);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle('削除')[0]);
    });

    expect(deleteMock).toHaveBeenCalledWith('/api/winning-banners/wb_test_1', {
      method: 'DELETE',
    });
    expect(screen.queryByText('勝ちバナー1')).toBeNull();
    expect(screen.getByText('勝ちバナー2')).toBeTruthy();
  });

  it('確認をキャンセルしたら何もしない', async () => {
    // 壊れたら落ちる: 確認を無視して消える。取り返しがつかない操作。
    await renderWith([banner(1)]);
    const deleteMock = vi.fn();
    vi.stubGlobal('fetch', deleteMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    await act(async () => {
      fireEvent.click(screen.getAllByTitle('削除')[0]);
    });

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText('勝ちバナー1')).toBeTruthy();
  });

  it('削除が失敗したらエラーを出し一覧を残す', async () => {
    // 壊れたら落ちる: 失敗したのに画面から消え、実際には残っている状態と
    // 食い違う。
    await renderWith([banner(1)]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));

    await act(async () => {
      fireEvent.click(screen.getAllByTitle('削除')[0]);
    });

    expect(screen.getByText('HTTP 409')).toBeTruthy();
    expect(screen.getByText('勝ちバナー1')).toBeTruthy();
  });
});
