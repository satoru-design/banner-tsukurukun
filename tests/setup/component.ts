/**
 * コンポーネントテスト用の共通セットアップ。
 *
 * jsdom 環境のテストだけ、各テストの後に render した DOM を片付ける。
 * 片付けないと前のテストが描いた要素が次のテストの getBy* に引っかかり、
 * 「1本で実行すると通るのに全体で実行すると落ちる」種類の不安定さが出る。
 *
 * node 環境のテストでは document が無いので何もしない。
 * setupFiles は全テストファイルに適用されるため、この分岐が必要。
 */
import { afterEach } from 'vitest';

/**
 * 動く localStorage / sessionStorage を保証する。
 *
 * Node 25 は Web Storage のグローバルを自前で持つが、起動オプション次第で
 * getItem / clear を備えない個体になる。それが jsdom 側の実装を覆うため、
 * jsdom 環境のはずの `localStorage.clear()` が "is not a function" で落ちる。
 * CI (Node 20/22) では再現しないので、CI だけ緑になって手元が赤くなる。
 *
 * 既に clear が生えている時は触らない。欠けている時だけ素朴な実装を入れる。
 */
function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const target = globalThis as unknown as Record<string, unknown>;
  const current = target[name] as { clear?: unknown } | undefined;
  if (current && typeof current.clear === 'function') return;

  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string) {
      return store.has(String(key)) ? (store.get(String(key)) as string) : null;
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(target, name, {
    value: storage,
    configurable: true,
    writable: true,
  });

  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (win && win !== target) {
    Object.defineProperty(win, name, { value: storage, configurable: true, writable: true });
  }
}

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);

  ensureStorage('localStorage');
  ensureStorage('sessionStorage');
}
