import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { notifyUpgradeRequest } from "@/lib/slack/notify-upgrade-request";

export const dynamic = "force-dynamic";

const PAID = ["starter", "pro", "business"] as const;
type PaidPlan = (typeof PAID)[number];

/**
 * 手動 STORES 請求書フローのアップグレード申請エンドポイント。
 *
 * STORES請求書決済には API が無いため、請求書を自動発行できない。
 * 申請を記録し（Slack 通知）、管理者が STORES で請求書を発行 →
 * 入金確認後に /admin/billing でプランを付与する。
 */
export async function POST(req: Request) {
  const { userId, email } = await getCurrentUser();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (!plan || !PAID.includes(plan as PaidPlan)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  // Slack 通知の失敗は申請受付を 500 にしない（fire-and-forget）。
  try {
    await notifyUpgradeRequest({ email: email ?? "(no email)", plan });
  } catch (e) {
    console.error("[billing/request-upgrade] Slack 通知に失敗:", e);
  }

  return NextResponse.json({
    ok: true,
    message: "ご請求書をお送りします。担当者より連絡いたします。",
  });
}
