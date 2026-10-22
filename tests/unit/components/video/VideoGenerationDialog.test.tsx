// @vitest-environment jsdom
/**
 * 特性テスト: 動画生成ダイアログの尺と音声の現状の振る舞いを固定する。
 *
 * ここが壊れると金に影響する。送信する durationSeconds がそのまま
 * 動画生成 API の課金対象の尺になるので、プロバイダを切り替えた時の
 * 補正が崩れると、意図しない長さで課金される。
 * 音声も同様で、非対応プロバイダに音声付きで投げると無駄な失敗を生む。
 *
 * fetch は必ずスタブするので、鍵もネットワークも不要。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VideoGenerationDialog } from '@/components/video/VideoGenerationDialog';

const FAST = 'Veo 3.1 Fast';
const LITE = 'veo-3.1-lite';
const KLING = 'kling-2.1-standard';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ videoId: 'vid_test_0001', status: 'pending' }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

function open() {
  return render(
    <VideoGenerationDialog
      isOpen
      onClose={() => {}}
      generationId="gen_test_0001"
      inputImageUrl="https://example.invalid/not-a-real-image.png"
    />,
  );
}

/** 選択中の尺ボタン（紫でハイライトされている方）の秒数。 */
function selectedDuration(): number {
  const picked = screen
    .getAllByRole('button')
    .filter((b) => /^\d+秒$/.test(b.textContent ?? ''))
    .find((b) => b.className.includes('border-purple-500'));
  return Number((picked?.textContent ?? '').replace('秒', ''));
}

function chooseProvider(id: string) {
  fireEvent.change(screen.getByDisplayValue(FAST), { target: { value: id } });
}

/**
 * モデルの select。フォーム内の select はモデルとアスペクト比の2つで、
 * モデルが先に描画されるので先頭を取る。
 */
function providerSelect(): HTMLSelectElement {
  return screen.getAllByRole('combobox')[0] as HTMLSelectElement;
}

describe('尺の既定値と選択', () => {
  it('既定は Veo 3.1 Fast の 8 秒', () => {
    // 壊れたら落ちる: 既定の尺が変わり、課金される長さが変わる。
    open();
    expect(selectedDuration()).toBe(8);
  });

  it('許可されている尺を選べる', () => {
    // 壊れたら落ちる: 尺を選べなくなる。
    open();
    fireEvent.click(screen.getByText('4秒'));
    expect(selectedDuration()).toBe(4);
  });

  it('プロバイダが扱える尺だけをボタンに出す', () => {
    // 壊れたら落ちる: 非対応の尺を選べてしまい、API 側で失敗する。
    open();
    expect(screen.getByText('4秒')).toBeTruthy();
    expect(screen.queryByText('10秒')).toBeNull();

    chooseProvider(KLING);
    expect(screen.getByText('5秒')).toBeTruthy();
    expect(screen.getByText('10秒')).toBeTruthy();
    expect(screen.queryByText('4秒')).toBeNull();
  });
});

describe('プロバイダ切り替え時の尺補正', () => {
  it('現在の尺が非対応なら、そのプロバイダの最長へ寄せる', () => {
    // 壊れたら落ちる: 非対応の尺のまま送信され、API 側で失敗するか
    // 意図しない尺で課金される。veo の 8 秒は kling では非対応。
    // 注: 補正先が最長であることは2系統で担保されている。落ちるのは
    // 両方が壊れた時。
    open();
    expect(selectedDuration()).toBe(8);

    chooseProvider(KLING);
    expect(selectedDuration()).toBe(10);
  });

  it('前のプロバイダで選んだ尺は保持されず、最長へ寄る', () => {
    // 壊れたら落ちる: 往復時の尺が変わる。
    // 現状: kling で 5 秒 → veo へ移ると 8 秒へ補正され、
    // kling へ戻ると 8 秒は非対応なので最長の 10 秒になる。
    open();
    chooseProvider(KLING);
    fireEvent.click(screen.getByText('5秒'));
    expect(selectedDuration()).toBe(5);

    fireEvent.change(providerSelect(), { target: { value: 'veo-3.1-fast' } });
    expect(selectedDuration()).toBe(8);

    fireEvent.change(providerSelect(), { target: { value: KLING } });
    expect(selectedDuration()).toBe(10);
  });
});

describe('音声オプション', () => {
  it('音声対応プロバイダだけにチェックボックスを出す', () => {
    // 壊れたら落ちる: 非対応プロバイダで音声を選べてしまう。
    open();
    expect(screen.queryByRole('checkbox')).toBeNull();

    chooseProvider(LITE);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('非対応プロバイダへ移ると音声の選択は解除される', () => {
    // 壊れたら落ちる: 音声の選択が残り続け、往復すると意図せず
    // 音声付きで送信される。
    open();
    chooseProvider(LITE);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);

    fireEvent.change(providerSelect(), { target: { value: 'veo-3.1-fast' } });
    fireEvent.change(providerSelect(), { target: { value: LITE } });

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});

describe('送信する内容', () => {
  async function submitWith(setup: () => void) {
    open();
    setup();
    fireEvent.change(screen.getByPlaceholderText(/カメラがゆっくりズームアウト/), {
      target: { value: 'テスト用のプロンプト' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('動画を生成'));
    });
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/generate-video');
    return JSON.parse(call![1].body as string);
  }

  it('補正後の尺を送る', async () => {
    // 壊れたら落ちる: 画面の表示と送信値がずれ、見えている尺と違う
    // 長さで課金される。
    // 注: 現状この値は「render 中の validDuration」と「プロバイダ変更時の
    // 補正」の2系統で担保されている。片方だけ壊しても値は変わらないので、
    // このテストが落ちるのは両方が壊れた時。
    const body = await submitWith(() => chooseProvider(KLING));
    expect(body.durationSeconds).toBe(10);
    expect(body.format).toBe('9:16 10s');
  });

  it('非対応プロバイダには音声を付けない', async () => {
    // 壊れたら落ちる: 非対応プロバイダへ音声付きで投げ、無駄な失敗と
    // 再試行のコストが出る。
    // 注: 尺と同じく、送信時のガードとプロバイダ変更時の解除の2系統で
    // 担保されている。落ちるのは両方が壊れた時。
    const body = await submitWith(() => {});
    expect(body.generateAudio).toBe(false);
  });

  it('対応プロバイダで選んだ音声は送る', async () => {
    // 壊れたら落ちる: 音声を選んだのに反映されない。
    const body = await submitWith(() => {
      chooseProvider(LITE);
      fireEvent.click(screen.getByRole('checkbox'));
    });
    expect(body.generateAudio).toBe(true);
  });
});
