import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase A.17.0 マーケ: KPI ダッシュボード用 集計 API
 *
 * GAS から日次で叩かれる。前日 (JST) 1 日分のメトリクスを返す。
 *
 * Auth: Authorization: Bearer ${ADMIN_KPI_SECRET}
 *
 * Query:
 *   ?date=YYYY-MM-DD  (省略時は前日 JST)
 *
 * Response (JSON):
 *   {
 *     date: "2026-05-04",
 *     users: { newSignups, totalActive, byPlan: {...} },
 *     generations: { totalYesterday, byPlan: {...} },
 *     subscriptions: { activeByPlan: {...}, newPaidYesterday, cancelledYesterday }
 *   }
 */

function getJstDateRange(dateStr: string | null) {
  // 指定日 (YYYY-MM-DD) の JST 0:00:00 〜 23:59:59 を UTC で返す
  // 省略時は「前日 JST」
  const targetJstDate = dateStr ? new Date(dateStr + 'T00:00:00+09:00') : null;
  let start: Date;
  if (targetJstDate && !isNaN(targetJstDate.getTime())) {
    start = targetJstDate;
  } else {
    // 前日 JST 0:00
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    nowJst.setUTCHours(0, 0, 0, 0);
    nowJst.setUTCDate(nowJst.getUTCDate() - 1);
    start = new Date(nowJst.getTime() - 9 * 60 * 60 * 1000);
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateLabel: start.toISOString().substring(0, 10) };
}

export const GET = async (req: Request): Promise<Response> => {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.ADMIN_KPI_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const { start, end, dateLabel } = getJstDateRange(url.searchParams.get('date'));
    const prisma = getPrisma();

    // 並列クエリ
    const [
      newSignups,
      totalActive,
      byPlanRaw,
      generationsYesterdayRaw,
      newPaidYesterday,
      cancelledYesterday,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.user.count(),
      prisma.user.groupBy({ by: ['plan'], _count: { plan: true } }),
      prisma.generation.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: start, lt: end } },
        _count: { id: true },
      }),
      prisma.user.count({
        where: {
          planStartedAt: { gte: start, lt: end },
          plan: { in: ['starter', 'pro', 'business'] },
        },
      }),
      prisma.user.count({
        where: {
          planExpiresAt: { gte: start, lt: end },
        },
      }),
    ]);

    const byPlan: Record<string, number> = {};
    for (const r of byPlanRaw) byPlan[r.plan] = r._count.plan;

    const totalGenerationsYesterday = generationsYesterdayRaw.reduce(
      (sum, r) => sum + r._count.id,
      0,
    );

    // generation の plan 別集計（user join 必要）
    const generationsByPlanRaw = await prisma.generation.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { user: { select: { plan: true } } },
    });
    const generationsByPlan: Record<string, number> = {};
    for (const g of generationsByPlanRaw) {
      const p = g.user?.plan ?? 'unknown';
      generationsByPlan[p] = (generationsByPlan[p] ?? 0) + 1;
    }

    return NextResponse.json({
      date: dateLabel,
      generatedAt: new Date().toISOString(),
      users: {
        newSignupsYesterday: newSignups,
        totalActive,
        byPlan,
      },
      generations: {
        totalYesterday: totalGenerationsYesterday,
        byPlan: generationsByPlan,
      },
      subscriptions: {
        newPaidYesterday,
        cancelledYesterday,
        activeByPlan: {
          starter: byPlan.starter ?? 0,
          pro: byPlan.pro ?? 0,
          business: byPlan.business ?? 0,
        },
      },
    });
  } catch (e) {
    console.error('[admin/kpi] error:', e);
    return NextResponse.json(
      { error: 'Internal error', message: String(e) },
      { status: 500 },
    );
  }
};
