// @vitest-environment jsdom
/**
 * 特性テスト: トップページ (STEP ウィザード) の state 遷移を固定する。
 *
 * 固定するのは2点。
 *
 * 1. 訪問済み最大ステップ。ここが崩れると未到達のステップへ飛べてしまい、
 *    素材が揃わないまま生成画面に入る。
 * 2. ブリーフ変更時のサジェスト破棄。商材やターゲットを変えたのに前の
 *    サジェストが残ると、文脈外のコピーで画像生成 API を叩くことになる。
 *
 * 重い子コンポーネントは差し替え、state を動かす口だけを出す。
 * fetch も差し替えるので、鍵もネットワークも不要。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

interface StubBrief {
  product: string;
  target: string;
  purpose: string;
  pattern: string;
}

interface BriefFormProps {
  brief: StubBrief;
  onChangeBrief: (b: StubBrief) => void;
  onNext: () => void;
}

interface SuggestSelectorProps {
  suggestions: unknown;
  onChangeSuggestions: (s: unknown) => void;
  onBack: () => void;
  onNext: (partial: Record<string, unknown>) => void;
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/layout/Header', () => ({
  Header: ({ rightSlot }: { rightSlot?: React.ReactNode }) => <header>{rightSlot}</header>,
}));

vi.mock('@/components/lp/LpFunnelTracker', () => ({ LpFunnelTracker: () => null }));

vi.mock('@/components/ironclad/AssetLibrary', () => ({ AssetLibrary: () => null }));

vi.mock('@/components/ironclad/IroncladBriefForm', () => ({
  IroncladBriefForm: ({ brief, onChangeBrief, onNext }: BriefFormProps) => (
    <div>
      <span data-testid="brief-product">{brief.product}</span>
      <button onClick={() => onChangeBrief({ ...brief, product: '別の商材' })}>
        商材を変える
      </button>
      <button onClick={() => onChangeBrief({ ...brief, pattern: '別のパターン' })}>
        パターンを変える
      </button>
      <button onClick={onNext}>STEP2 へ</button>
    </div>
  ),
}));

vi.mock('@/components/ironclad/IroncladSuggestSelector', () => ({
  IroncladSuggestSelector: ({
    suggestions,
    onChangeSuggestions,
    onBack,
    onNext,
  }: SuggestSelectorProps) => (
    <div>
      <span data-testid="has-suggestions">{suggestions ? 'yes' : 'no'}</span>
      <button onClick={() => onChangeSuggestions({ copies: ['案1'] })}>
        サジェストを入れる
      </button>
      <button onClick={onBack}>STEP1 へ戻る</button>
      <button onClick={() => onNext({})}>STEP3 へ</button>
    </div>
  ),
}));

vi.mock('@/components/ironclad/IroncladGenerateScreen', () => ({
  IroncladGenerateScreen: () => <div data-testid="generate-screen" />,
}));

import IroncladPage from '@/app/page';

/** ステップ表示の aria-label から到達状態を読む。 */
function stepState(step: 1 | 2 | 3): 'current' | 'visited' | 'locked' {
  if (screen.queryByLabelText(new RegExp(`^現在のステップ ${step}:`))) return 'current';
  if (screen.queryByLabelText(new RegExp(`^ステップ ${step} へ戻る:`))) return 'visited';
  return 'locked';
}

beforeEach(() => {
  // page は mount 時に素材の自動選択で fetch する。常に空で返す。
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assets: [] }) }),
  );
});

async function openPage() {
  await act(async () => {
    render(<IroncladPage />);
  });
}

async function click(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

describe('訪問済み最大ステップ', () => {
  it('初期状態は STEP1 のみ到達済みで、2 と 3 は未到達', async () => {
    // 壊れたら落ちる: 初回訪問者が素材を揃える前に生成画面へ飛べる。
    await openPage();
    expect(stepState(1)).toBe('current');
    expect(stepState(2)).toBe('locked');
    expect(stepState(3)).toBe('locked');
  });

  it('未到達ステップのボタンは disabled で押せない', async () => {
    // 壊れたら落ちる: 未到達ステップが押せるようになり、素材が揃わない
    // まま生成画面へ入れる。
    // 注: page 側の `target <= maxVisitedStep` ガードは、この disabled の
    // 背後にある二重の防御で、DOM からは到達できない。実際に移動を
    // 止めているのはこの属性なので、ここを固定する。
    await openPage();
    expect(screen.getByLabelText(/^ステップ 2 は未到達:/)).toHaveProperty('disabled', true);
    expect(screen.getByLabelText(/^ステップ 3 は未到達:/)).toHaveProperty('disabled', true);
    // 現在のステップも自分自身へのジャンプが無意味なので disabled。
    expect(screen.getByLabelText(/^現在のステップ 1:/)).toHaveProperty('disabled', true);
  });

  it('到達済みになったステップのボタンは押せる', async () => {
    // 壊れたら落ちる: 到達済みでも押せず、戻る導線が死ぬ。
    await openPage();
    await click('STEP2 へ');
    expect(screen.getByLabelText(/^ステップ 1 へ戻る:/)).toHaveProperty('disabled', false);
    expect(screen.getByLabelText(/^ステップ 3 は未到達:/)).toHaveProperty('disabled', true);
  });

  it('STEP2 へ進むと 2 が到達済みになる', async () => {
    // 壊れたら落ちる: 進んだのに戻れなくなる。
    await openPage();
    await click('STEP2 へ');
    expect(stepState(2)).toBe('current');
    expect(stepState(1)).toBe('visited');
    expect(stepState(3)).toBe('locked');
  });

  it('戻っても到達済みの記録は下がらない', async () => {
    // 壊れたら落ちる: 一度進んだステップへ戻れなくなり、行き止まりになる。
    await openPage();
    await click('STEP2 へ');
    await click('STEP1 へ戻る');

    expect(stepState(1)).toBe('current');
    expect(stepState(2)).toBe('visited');
    expect(stepState(3)).toBe('locked');
  });

  it('到達済みステップへジャンプできる', async () => {
    // 壊れたら落ちる: ステップ表示のクリックで移動できなくなる。
    await openPage();
    await click('STEP2 へ');
    await click('STEP1 へ戻る');

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/^ステップ 2 へ戻る:/));
    });
    expect(stepState(2)).toBe('current');
  });

  it('STEP3 まで進むと 3 も到達済みになる', async () => {
    // 壊れたら落ちる: 完成画面から戻れなくなる。
    await openPage();
    await click('STEP2 へ');
    await click('STEP3 へ');

    expect(screen.getByTestId('generate-screen')).toBeTruthy();
    expect(stepState(3)).toBe('current');
    expect(stepState(2)).toBe('visited');
  });
});

describe('ブリーフ変更時のサジェスト破棄', () => {
  it('商材を変えるとサジェストを破棄する', async () => {
    // 壊れたら落ちる: 文脈外のコピーが残り、それを元に画像生成 API を
    // 叩いて無駄な課金と作り直しが発生する。
    await openPage();
    await click('STEP2 へ');
    await click('サジェストを入れる');
    expect(screen.getByTestId('has-suggestions').textContent).toBe('yes');

    await click('STEP1 へ戻る');
    await click('商材を変える');
    expect(screen.getByTestId('brief-product').textContent).toBe('別の商材');

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/^ステップ 2 へ戻る:/));
    });
    expect(screen.getByTestId('has-suggestions').textContent).toBe('no');
  });

  it('signature に含まれない項目を変えてもサジェストは残る', async () => {
    // 壊れたら落ちる: pattern を変えるだけでサジェストが消え、作り直しの
    // ために再生成の API 呼び出しが増える。
    await openPage();
    await click('STEP2 へ');
    await click('サジェストを入れる');

    await click('STEP1 へ戻る');
    await click('パターンを変える');

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/^ステップ 2 へ戻る:/));
    });
    expect(screen.getByTestId('has-suggestions').textContent).toBe('yes');
  });

  it('サジェストが無い状態で商材を変えても壊れない', async () => {
    // 壊れたら落ちる: 破棄処理が無条件に走り、余計な再 render が続く。
    await openPage();
    await click('商材を変える');
    expect(screen.getByTestId('brief-product').textContent).toBe('別の商材');
    expect(stepState(1)).toBe('current');
  });
});
