/**
 * Phase A.15: LP Hero 右側に配置するバナーショーケース
 *
 * 5 サイズを native aspect ratio のまま表示（クロップなし）。
 * Bento 風レイアウト:
 * - 左大: Instagram 1:1（LCP 候補、fetchPriority high）
 * - 右側スタック（垂直中央寄せ）: YDA 1.5:1 / Display 336x280 1.185:1
 * - 全幅ストリップ: PC 728x90 (3:1) / SP 320x100 (3:1)
 *
 * 各画像は w-full h-auto で natural fit するので「端の見切れ」は発生しない。
 */
const BANNER_BASE = '/lp/banners';

export const LpBannerShowcase = () => {
  return (
    <div className="space-y-3 max-w-md mx-auto">
      {/* Top row: Featured Instagram + 2 stacked side */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 aspect-square rounded-xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-emerald-500/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BANNER_BASE}/instagram-1080.png`}
            alt="Instagram 1080×1080 サンプルバナー"
            className="w-full h-full object-cover"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="col-span-1 flex flex-col gap-3 justify-center">
          <div className="rounded-xl overflow-hidden border border-slate-700/60 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BANNER_BASE}/yda-600x314.png`}
              alt="YDA サンプルバナー"
              className="w-full h-auto block"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/60 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BANNER_BASE}/display-336x280.png`}
              alt="Display 336×280 サンプルバナー"
              className="w-full h-auto block"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
      {/* PC wide strip */}
      <div className="rounded-lg overflow-hidden border border-slate-700/60 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BANNER_BASE}/display-pc-728x90.png`}
          alt="Display PC 728×90 サンプルバナー"
          className="w-full h-auto block"
          loading="lazy"
          decoding="async"
        />
      </div>
      {/* SP wide strip */}
      <div className="rounded-lg overflow-hidden border border-slate-700/60 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BANNER_BASE}/display-sp-320x100.png`}
          alt="Display SP 320×100 サンプルバナー"
          className="w-full h-auto block"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
};
