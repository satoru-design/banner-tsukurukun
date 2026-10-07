import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // 未スタブの外部通信を落とし、資格情報系の環境変数を消す。
    // これで「鍵なし・ネットワーク断」でも結果が変わらない。
    setupFiles: ['tests/setup/no-network.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
