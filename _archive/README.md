# _archive/

Phase A 着手時（2026-04-21）に、プロトタイプ開発中の AI エディタ作業残骸をここに退避した。

## 退避対象
- `fix-*.js`, `patch-*.js`, `update*.js`, `scratch*.ts/js`, `test-anthropic.js`, `restore.js`, `migrate-frontend.js`
  - いずれもプロトタイプ改造時の一時スクリプト、本番ロジック非依存
- `app-api-analyze-route.ts`（旧 `src/app/api/analyze/route.ts`）
  - `analyze-lp` に完全置換済み、`page.tsx` からの呼び出しなし

## 復元方法
削除せず保持しているので、必要になったら元の場所に戻せば動作するはず。
ただし依存パッケージのバージョンは本体と一致している前提。

## Phase A7 で追加退避予定
- `prisma-sqlite-migrations/` — SQLite 時代のマイグレーションと dev.db
