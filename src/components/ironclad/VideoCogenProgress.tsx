'use client';

/**
 * Phase B.3: 静止画生成画面 (STEP 3) で動画 co-gen の進捗を視覚化するパネル。
 *
 * 静止画と同じ GenerationProgress を流用して、
 *  pending/processing → 進捗バー (estimatedSeconds=120)
 *  done             → inline <video> + DL ボタン
 *  failed           → エラー表示
 *
 * ポーリング: 8 秒間隔。done/failed になったら停止。
 */
import { useEffect, useState, useCallback } from 'react';
import { Film, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GenerationProgress } from '@/components/ui/GenerationProgress';

interface VideoStatusDto {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | string;
  provider: string;
  aspectRatio: string;
  durationSeconds: number;
  blobUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Props {
  /** ironclad-generate response.videoId をストックした配列 */
  videoIds: string[];
}

export function VideoCogenProgress({ videoIds }: Props) {
  const [statuses, setStatuses] = useState<Record<string, VideoStatusDto>>({});

  const poll = useCallback(async () => {
    const inFlight = videoIds.filter((id) => {
      const s = statuses[id];
      return !s || (s.status !== 'done' && s.status !== 'failed');
    });
    if (inFlight.length === 0) return;
    await Promise.all(
      inFlight.map(async (id) => {
        try {
          const r = await fetch(`/api/generate-video/${id}`);
          if (!r.ok) return;
          const data = (await r.json()) as VideoStatusDto;
          setStatuses((prev) => ({ ...prev, [id]: data }));
        } catch {
          // network blip; 次回再試行
        }
      }),
    );
  }, [videoIds, statuses]);

  // 初回 + 8 秒間隔で poll
  useEffect(() => {
    if (videoIds.length === 0) return;
    void poll();
    const t = setInterval(() => {
      void poll();
    }, 8_000);
    return () => clearInterval(t);
  }, [videoIds, poll]);

  if (videoIds.length === 0) return null;

  const doneCount = videoIds.filter((id) => statuses[id]?.status === 'done').length;
  const failedCount = videoIds.filter((id) => statuses[id]?.status === 'failed').length;

  return (
    <section className="border border-amber-400/30 rounded-xl bg-amber-500/[0.04] p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
          <Film className="w-4 h-4" />
          動画も同時生成中 ({doneCount}/{videoIds.length} 完成
          {failedCount > 0 ? ` / ${failedCount} 失敗` : ''})
        </h3>
        <span className="text-[11px] text-amber-300/70">
          Veo 3.1 Fast / 1〜2 分で完成
        </span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {videoIds.map((id) => {
          const s = statuses[id];
          // 推定: Veo Fast 8s = 概ね 90-150 秒。余裕を持って 130s。
          const ESTIMATED = 130;
          if (!s || s.status === 'pending' || s.status === 'processing') {
            const label =
              !s || s.status === 'pending'
                ? '順番待ち (cron が拾い上げます)'
                : '動画を生成中…';
            return (
              <div
                key={id}
                className="bg-neutral-900/60 border border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="aspect-video flex items-center justify-center bg-slate-950/60">
                  <GenerationProgress
                    estimatedSeconds={ESTIMATED}
                    label={label}
                    compact
                  />
                </div>
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  {s ? `${s.aspectRatio} / ${s.durationSeconds}s / ${s.provider}` : 'Veo 3.1 Fast'}
                </div>
              </div>
            );
          }
          if (s.status === 'failed') {
            return (
              <div
                key={id}
                className="bg-rose-950/40 border border-rose-700/40 rounded-lg overflow-hidden"
              >
                <div className="aspect-video flex flex-col items-center justify-center text-rose-300 p-4 text-center">
                  <AlertTriangle className="w-6 h-6 mb-2" />
                  <p className="text-xs">{s.errorMessage || '生成失敗'}</p>
                </div>
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  {s.aspectRatio} / {s.durationSeconds}s / {s.provider}
                </div>
              </div>
            );
          }
          // done
          return (
            <div
              key={id}
              className="bg-neutral-900/60 border border-emerald-700/40 rounded-lg overflow-hidden"
            >
              {s.blobUrl ? (
                <video
                  src={s.blobUrl}
                  controls
                  className="w-full h-auto bg-black"
                  preload="metadata"
                />
              ) : (
                <div className="aspect-video flex items-center justify-center bg-slate-950/60">
                  <span className="text-slate-500 text-xs">動画 URL 取得中…</span>
                </div>
              )}
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  完成 ({s.aspectRatio} / {s.durationSeconds}s)
                </span>
                {s.blobUrl && (
                  <a
                    href={s.blobUrl}
                    download
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition"
                  >
                    <Download className="w-3 h-3" />
                    MP4
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
