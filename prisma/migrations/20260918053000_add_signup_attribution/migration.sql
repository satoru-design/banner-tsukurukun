-- 流入計測 (first touch attribution)
-- middleware が焼いた cookie `ab_attr` を、初回サインイン時に User 行へ保存する。
-- どちらも NULL 許容の追加列なので既存行・既存コードへの影響はない。

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupChannel" TEXT,
ADD COLUMN     "signupAttribution" JSONB;

-- CreateIndex
CREATE INDEX "User_signupChannel_idx" ON "User"("signupChannel");
