/**
 * 尺の補正ルールの単体テスト。
 *
 * ここが壊れると金に影響する。返した尺がそのまま動画生成 API の
 * 課金対象の長さになるので、補正で不必要に伸びないことを厳密に押さえる。
 *
 * 純関数なので API キーもネットワークも不要。
 */
import { describe, it, expect } from 'vitest';
import { nearestAllowedDuration } from '@/components/video/pick-duration';

// 実際のプロバイダが持つ選択肢。
const VEO = [4, 6, 8];
const KLING = [5, 10];

describe('そのまま選べる場合', () => {
  it('対応している尺はそのまま返す', () => {
    // 壊れたら落ちる: 選べる尺なのに別の値へ寄せてしまう。
    for (const d of VEO) expect(nearestAllowedDuration(VEO, d)).toBe(d);
    for (const d of KLING) expect(nearestAllowedDuration(KLING, d)).toBe(d);
  });
});

describe('最も近い尺へ寄せる', () => {
  it('veo から kling へ', () => {
    // 壊れたら落ちる: 4 秒や 6 秒の選択が 10 秒へ飛び、課金が倍以上になる。
    expect(nearestAllowedDuration(KLING, 4)).toBe(5);
    expect(nearestAllowedDuration(KLING, 6)).toBe(5);
    expect(nearestAllowedDuration(KLING, 8)).toBe(10);
  });

  it('kling から veo へ', () => {
    // 壊れたら落ちる: 5 秒の選択が 8 秒へ飛ぶ。
    expect(nearestAllowedDuration(VEO, 5)).toBe(4);
    expect(nearestAllowedDuration(VEO, 10)).toBe(8);
  });
});

describe('同距離の扱い', () => {
  it('距離が同じなら短い方を選ぶ', () => {
    // 壊れたら落ちる: 補正で課金対象の尺が勝手に伸びる。
    // 5 は 4 と 6 のどちらからも距離 1。
    expect(nearestAllowedDuration(VEO, 5)).toBe(4);
    // 候補の並び順に依存しないこと。
    expect(nearestAllowedDuration([8, 6, 4], 5)).toBe(4);
    expect(nearestAllowedDuration([10, 20], 15)).toBe(10);
  });
});

describe('補正で尺が伸びないこと', () => {
  it('どの組み合わせでも、旧ルール（最長へ寄せる）より長くならない', () => {
    // 壊れたら落ちる: 修正の目的そのもの。補正後の尺が旧ルールを
    // 上回ると、今より高く課金される経路が生まれる。
    for (const allowed of [VEO, KLING]) {
      const longest = allowed[allowed.length - 1];
      for (const current of [1, 4, 5, 6, 8, 10, 12, 30]) {
        expect(nearestAllowedDuration(allowed, current)).toBeLessThanOrEqual(longest);
      }
    }
  });

  it('選択より短い候補があるとき、補正後が元の選択を大きく超えない', () => {
    // 壊れたら落ちる: 下に候補があるのに上へ寄せる。
    expect(nearestAllowedDuration(KLING, 6)).toBe(5);
    expect(nearestAllowedDuration([4, 6, 8], 7)).toBe(6);
  });
});

describe('往復の安定性', () => {
  it('veo と kling を往復しても元の尺へ戻る（6 秒以外）', () => {
    // 壊れたら落ちる: 往復するたびに尺が動き、気付かないうちに
    // 課金対象の長さが変わる。報告された不具合そのもの。
    for (const start of [4, 8]) {
      const viaKling = nearestAllowedDuration(KLING, start);
      expect(nearestAllowedDuration(VEO, viaKling)).toBe(start);
    }
    for (const start of [5, 10]) {
      const viaVeo = nearestAllowedDuration(VEO, start);
      expect(nearestAllowedDuration(KLING, viaVeo)).toBe(start);
    }
  });

  it('6 秒だけは往復で 4 秒へ下がる（伸びはしない）', () => {
    // 壊れたら落ちる: 6 秒の往復が伸びる方向へ動く。
    // 6 → kling は 5、5 → veo は同距離で短い 4。短くなるので課金は増えない。
    const viaKling = nearestAllowedDuration(KLING, 6);
    expect(viaKling).toBe(5);
    expect(nearestAllowedDuration(VEO, viaKling)).toBe(4);
  });
});

describe('異常な入力', () => {
  it('選択肢が空なら現在値をそのまま返す', () => {
    // 壊れたら落ちる: undefined が返り、送信値が壊れる。
    expect(nearestAllowedDuration([], 7)).toBe(7);
  });

  it('候補が1つならそれを返す', () => {
    // 壊れたら落ちる: 単一候補のプロバイダで補正できない。
    expect(nearestAllowedDuration([6], 10)).toBe(6);
  });
});
