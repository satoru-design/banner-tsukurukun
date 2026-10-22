import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // .tsx はコンポーネントテスト。各ファイル先頭の
    // `// @vitest-environment jsdom` で個別に jsdom へ切り替える。
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    // 未スタブの外部通信を落とし、資格情報系の環境変数を消す。
    // これで「鍵なし・ネットワーク断」でも結果が変わらない。
    // component.ts は .tsx のコンポーネントテスト用（jsdom 側の後始末）。
    setupFiles: ['tests/setup/no-network.ts', 'tests/setup/component.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
