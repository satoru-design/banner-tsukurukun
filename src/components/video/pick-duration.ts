/**
 * 動画の尺の補正ルール。
 *
 * プロバイダごとに選べる尺が違うため、プロバイダを切り替えると現在の
 * 選択が非対応になることがある。その時にどの尺へ寄せるかを決める。
 *
 * 従来は「そのプロバイダの最長」へ寄せていた。これだと利用者の意図から
 * 離れるだけでなく、往復すると勝手に伸びる。veo の 4/6/8 秒と
 * kling の 5/10 秒で、kling の 5 秒を選んでから veo へ移り kling へ
 * 戻ると、5 秒 → 8 秒 → 10 秒になっていた。送信する尺はそのまま
 * 動画生成 API の課金対象なので、選んだ 5 秒の倍の長さで課金される。
 *
 * そこで「最も近い尺」へ寄せる。同じ距離なら短い方を選ぶので、
 * 補正で課金対象の尺が不必要に伸びることはない。
 */

/**
 * `current` に最も近い、`allowed` の中の尺を返す。
 *
 * - `current` がそのまま選べるならそれを返す
 * - 距離が同じ候補が複数あるときは短い方を選ぶ
 * - `allowed` が空なら補正できないので `current` を返す
 */
export function nearestAllowedDuration(
  allowed: readonly number[],
  current: number,
): number {
  if (allowed.length === 0) return current;
  // 選べる尺ならそのまま返す。距離 0 が最小なので下のループでも同じ結果に
  // なる、意図を読みやすくするための近道。挙動には影響しない。
  if (allowed.includes(current)) return current;

  let best = allowed[0];
  let bestDistance = Math.abs(best - current);

  for (const candidate of allowed.slice(1)) {
    const distance = Math.abs(candidate - current);
    // 同距離なら短い方を採る。補正で勝手に長い尺へ寄せないため。
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
