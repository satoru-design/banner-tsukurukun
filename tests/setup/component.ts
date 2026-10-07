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

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
