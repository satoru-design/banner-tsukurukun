/**
 * Phase A.11.5: /account の「履歴」セクション。
 * Server Component で直近 1 件 + 件数 + ロック数を取得して表示。
 */
import Link from 'next/link';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

interface HistorySectionProps {
  userId: string;
  plan: string;
}

export async function HistorySection({ userId, plan }: HistorySectionProps) {
  const prisma = getPrisma();
  const sessions = await prisma.generation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { images: { select: { isFavorite: true } } },
  });

  const accessLimit = getHistoryAccessLimit(plan);
  const lockedCount = sessions.filter((s, idx) => {
    const hasFavorite = s.images.some((img) => img.isFavorite);
    return computeLocked({ index: idx, accessLimit, hasFavorite });
  }).length;

  const total = sessions.length;
  const latest = sessions[0];

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        履歴
      </h2>
      <div className="space-y-3">
        {total === 0 ? (
          <div className="text-sm text-slate-400">
            まだ履歴がありません。バナーを生成してみましょう。
          </div>
        ) : (
          <>
            {latest && (
              <div className="text-sm text-slate-300">
                最新の生成:{' '}
                <span className="text-slate-100">
                  {new Date(latest.createdAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {' / '}
                <span className="text-slate-400">
                  {(latest.briefSnapshot as unknown as BriefSnapshot).product}
                </span>
              </div>
            )}
            <div className="text-sm text-slate-300">
              履歴件数: <span className="font-semibold">{total}</span> 件
              {lockedCount > 0 && (
                <span className="text-amber-400 ml-2">
                  （うち ロック中 {lockedCount} 件）
                </span>
              )}
            </div>
          </>
        )}
        <Link
          href="/history"
          className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
        >
          すべての履歴を見る →
        </Link>
      </div>
    </section>
  );
}
