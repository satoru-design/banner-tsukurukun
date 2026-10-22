-- テナント分離: StyleProfile と Banner に所有者 (userId) を持たせる。
--
-- 背景
--   この 2 テーブルは userId 列を持たない全ユーザー共有テーブルだった。
--   そのため /api/style-profile の GET は全ユーザーのプロファイルを返し、
--   /api/save-banner の GET は全ユーザーの保存バナー (base64 画像とコピー本文) を
--   返していた。さらに generate-image / generate-copy は body の styleProfileId を
--   所有者チェックなしで読み込むため、他人のプロファイルと参照画像を
--   自分の生成に流用できた。
--
-- この移行の性質
--   すべて加法的で、既存データは消えない。
--   既存行の userId は NULL のままになる (所有者を特定できないため)。
--   NULL 行の扱いはアプリ側で決める:
--     - StyleProfile: 移行前「全員が一覧できる共有ライブラリ」だったので、
--       NULL 行は引き続き全ログインユーザーが参照できる。変更と削除は admin のみ。
--     - Banner: 共有の意味を持たない保存物なので、NULL 行は admin のみ参照できる。
--   既存行を特定ユーザーの所有に移すには scripts/backfill-tenant-ownership.ts を使う
--   (Asset で使った scripts/migrate-assets-to-admin.ts と同じ考え方)。
--
-- StyleProfile.name の一意性
--   グローバル UNIQUE を (userId, name) の複合 UNIQUE に置き換える。
--   グローバルのままだと、他ユーザーが先に使った名前を永久に使えない。
--   既存行はグローバル UNIQUE を満たしていたので、複合化で衝突は起きない。
--
-- onDelete: CASCADE を選んだ理由
--   SET NULL にすると、退会時に本人の private な行が NULL (= 遺構) に変わる。
--   StyleProfile の NULL 行は全員から見えるため、退会が情報公開になってしまう。

-- DropIndex
DROP INDEX "StyleProfile_name_key";

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "StyleProfile" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Banner_userId_idx" ON "Banner"("userId");

-- CreateIndex
CREATE INDEX "StyleProfile_userId_idx" ON "StyleProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StyleProfile_userId_name_key" ON "StyleProfile"("userId", "name");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleProfile" ADD CONSTRAINT "StyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
