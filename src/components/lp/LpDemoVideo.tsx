/**
 * Phase A.15: LP ファーストビュー直下のデモ動画セクション
 *
 * 動画 URL は env 駆動で graceful。未設定なら何も表示しない。
 * - NEXT_PUBLIC_DEMO_VIDEO_URL: 動画ファイル URL（Vercel Blob 推奨、.mp4）
 * - NEXT_PUBLIC_DEMO_VIDEO_POSTER: ポスター画像 URL（任意、再生前のサムネ）
 *
 * autoplay/muted/loop/playsinline で LP の没入感を担保。
 * controls も付与してユーザー操作を許可。
 */
const VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '';
const POSTER_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_POSTER ?? '';

export const LpDemoVideo = () => {
  if (!VIDEO_URL) return null;
  return (
    <section className="bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-bold text-emerald-300 tracking-[0.2em] uppercase">
            Live Demo
          </span>
          <p className="text-slate-300 text-lg sm:text-xl mt-2">
            実際の生成フローをご覧ください
          </p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-emerald-500/10 bg-slate-900">
          <video
            src={VIDEO_URL}
            poster={POSTER_URL || undefined}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="w-full h-auto block"
          />
        </div>
      </div>
    </section>
  );
};
