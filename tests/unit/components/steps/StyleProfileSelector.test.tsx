// @vitest-environment jsdom
/**
 * 特性テスト: スタイルプロファイル選択の現状の振る舞いを固定する。
 *
 * 選んだプロファイルは参考画像として画像生成 API へ渡るので、
 * 読み込みや選択が壊れると生成結果とコストに影響する。
 * fetch は必ずスタブするので、鍵もネットワークも不要。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StyleProfileSelector } from '@/components/steps/StyleProfileSelector';

const PROFILES = [
  { id: 'sp_test_1', name: 'テスト用A', referenceImageUrls: ['u1', 'u2'] },
  { id: 'sp_test_2', name: 'テスト用B', referenceImageUrls: [] },
];

let fetchMock: ReturnType<typeof vi.fn>;

/** 解決を手動で制御できる fetch。読み込み中の状態を観測するために使う。 */
function deferredFetch() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  const mock = vi.fn().mockReturnValue(promise);
  return { mock, resolve };
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okJson({ profiles: PROFILES }));
  vi.stubGlobal('fetch', fetchMock);
});

const noop = () => {};

describe('読み込み', () => {
  it('解決前は読み込み中を出す', async () => {
    // 壊れたら落ちる: 読み込み中の表示が消え、無言で固まったように見える。
    const { mock, resolve } = deferredFetch();
    vi.stubGlobal('fetch', mock);

    render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    expect(screen.getByText('読み込み中...')).toBeTruthy();

    await act(async () => resolve(okJson({ profiles: [] })));
    expect(screen.queryByText('読み込み中...')).toBeNull();
  });

  it('マウント時に1度だけ取得する', async () => {
    // 壊れたら落ちる: 取得が二重に走り、無駄なリクエストが出る。
    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/style-profile');
  });

  it('取得したプロファイルを枚数付きで並べる', async () => {
    // 壊れたら落ちる: 選択肢が出ず、プロファイルを使えなくなる。
    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });

    expect(screen.getByText('テスト用A')).toBeTruthy();
    expect(screen.getByText('2 枚')).toBeTruthy();
    expect(screen.getByText('0 枚')).toBeTruthy();
  });

  it('更新ボタンで再取得する', async () => {
    // 壊れたら落ちる: 新規作成直後に一覧へ反映されなくなる。
    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText('更新'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('エラー処理', () => {
  it('API のエラー文を表示する', async () => {
    // 壊れたら落ちる: 失敗が黙って無視され、空一覧と区別できなくなる。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: '権限がありません' }) }),
    );

    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(screen.getByText(/権限がありません/)).toBeTruthy();
  });

  it('エラー文が無ければ status を出す', async () => {
    // 壊れたら落ちる: 原因不明の失敗で何も出なくなる。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(screen.getByText(/status 500/)).toBeTruthy();
  });

  it('通信自体が失敗しても落ちずにエラーを出す', async () => {
    // 壊れたら落ちる: 例外が外へ漏れて画面全体が壊れる。
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(screen.getByText(/offline/)).toBeTruthy();
    expect(screen.queryByText('読み込み中...')).toBeNull();
  });

  it('再取得が成功したら前のエラーを消す', async () => {
    // 壊れたら落ちる: 復旧後もエラーが残り続ける。
    const failing = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(okJson({ profiles: PROFILES }));
    vi.stubGlobal('fetch', failing);

    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={noop} />);
    });
    expect(screen.getByText(/offline/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('更新'));
    });
    expect(screen.queryByText(/offline/)).toBeNull();
    expect(screen.getByText('テスト用A')).toBeTruthy();
  });
});

describe('選択', () => {
  it('プロファイルを選ぶと id を通知する', async () => {
    // 壊れたら落ちる: 選択が親に伝わらず、生成に反映されない。
    const onSelect = vi.fn();
    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={onSelect} onCreateNew={noop} />);
    });

    fireEvent.click(screen.getByTestId('profile-sp_test_1'));
    expect(onSelect).toHaveBeenCalledWith('sp_test_1');
  });

  it('プロファイル無しを選ぶと null を通知する', async () => {
    // 壊れたら落ちる: 解除できず、意図せず参考画像が付き続ける。
    const onSelect = vi.fn();
    await act(async () => {
      render(<StyleProfileSelector selectedId="sp_test_1" onSelect={onSelect} onCreateNew={noop} />);
    });

    fireEvent.click(screen.getByTestId('profile-none'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('selectedId に対応するラジオだけが checked になる', async () => {
    // 壊れたら落ちる: 選択状態の表示が実際の値とずれる。
    await act(async () => {
      render(<StyleProfileSelector selectedId="sp_test_2" onSelect={noop} onCreateNew={noop} />);
    });

    expect((screen.getByTestId('profile-sp_test_2') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('profile-sp_test_1') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('profile-none') as HTMLInputElement).checked).toBe(false);
  });

  it('新規作成ボタンで親に通知する', async () => {
    // 壊れたら落ちる: 新規作成の導線が切れる。
    const onCreateNew = vi.fn();
    await act(async () => {
      render(<StyleProfileSelector selectedId={null} onSelect={noop} onCreateNew={onCreateNew} />);
    });

    fireEvent.click(screen.getByTestId('create-new-profile'));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });
});
