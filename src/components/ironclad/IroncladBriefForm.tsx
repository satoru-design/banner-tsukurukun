'use client';

import React, { useState } from 'react';
import { Link2, Loader2, Wand2, AlertTriangle, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  IRONCLAD_PATTERNS,
  IroncladBrief,
  IroncladPattern,
  IroncladSize,
  IRONCLAD_SIZE_CATEGORIES,
  SIZE_TO_API_IRONCLAD,
  CUSTOM_SIZE_MAX,
  getIroncladSizeMeta,
  parseCustomSize,
  type VideoCogenAspectRatio,
} from '@/lib/prompts/ironclad-banner';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { CheckoutButton } from '@/components/billing/CheckoutButton';
import { AssetLibrary, Asset } from './AssetLibrary';
import { WinningBannerLibrary } from './WinningBannerLibrary';

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE ?? '';

type Props = {
  brief: IroncladBrief;
  onChangeBrief: (b: IroncladBrief) => void;
  productAsset: Asset | null;
  onChangeProductAsset: (a: Asset | null) => void;
  badge1Asset: Asset | null;
  onChangeBadge1Asset: (a: Asset | null) => void;
  badge2Asset: Asset | null;
  onChangeBadge2Asset: (a: Asset | null) => void;
  /** Phase A.8: 勝ちバナー参照を有効化するか */
  useWinningRef: boolean;
  onChangeUseWinningRef: (v: boolean) => void;
  onNext: () => void;
};


export function IroncladBriefForm({
  brief,
  onChangeBrief,
  productAsset,
  onChangeProductAsset,
  badge1Asset,
  onChangeBadge1Asset,
  badge2Asset,
  onChangeBadge2Asset,
  useWinningRef,
  onChangeUseWinningRef,
  onNext,
}: Props) {
  const canProceed = Boolean(
    brief.pattern &&
      brief.product.trim() &&
      brief.target.trim() &&
      brief.purpose.trim() &&
      brief.sizes.length > 0,
  );

  // Phase A.16: パターン選択 UI（Free=単一 / Pro=最大3個まで複数選択）
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);
  const isPaid = user.plan === 'pro' || user.plan === 'starter' || user.plan === 'admin';
  const [proLockOpen, setProLockOpen] = useState(false);

  const additionalPatterns = brief.additionalPatterns ?? [];
  // 全選択中パターン（代表 + 追加）。UI ではこの配列の有無で表示状態を判定する。
  const allSelectedPatterns: IroncladPattern[] = [brief.pattern, ...additionalPatterns];
  // Phase A.16.1: 全 6 pattern まで選択可能に拡張（小池さん判断、2026-05-03）。
  // メータード課金が Pro 上限に当たる場面は上位プランで吸収する方針（別 Phase で対応）。
  const MAX_TOTAL_PATTERNS = IRONCLAD_PATTERNS.length;

  /**
   * Phase A.16: パターンボタンクリック時の挙動。
   * - Free: 単一選択（クリック=代表 pattern 切替、追加は常に空）
   * - Pro: 複数選択トグル（最大 3 個。代表を外そうとしたら additionalPatterns[0] に格上げ）
   */
  const handlePatternClick = (p: IroncladPattern) => {
    const isSelected = allSelectedPatterns.includes(p);

    // Free: 単一選択モード（複数選択を試みたら Pro 訴求モーダル）
    if (!isPaid) {
      if (p !== brief.pattern) {
        // 「2 つ目を選ぼうとした」シグナルとして Pro 訴求モーダルを起動。
        // 同時に代表 pattern も切替えておく（モーダル「あとで」でも操作が無駄にならないように）。
        onChangeBrief({ ...brief, pattern: p, additionalPatterns: [] });
        setProLockOpen(true);
      }
      return;
    }

    // Pro/Starter/admin: 複数選択モード
    if (isSelected) {
      // 解除
      if (p === brief.pattern) {
        // 代表を外す → additionalPatterns の先頭を代表に格上げ。空なら最低 1 個必須なので何もしない。
        if (additionalPatterns.length === 0) return;
        const [newPrimary, ...rest] = additionalPatterns;
        onChangeBrief({ ...brief, pattern: newPrimary, additionalPatterns: rest });
      } else {
        onChangeBrief({
          ...brief,
          additionalPatterns: additionalPatterns.filter((x) => x !== p),
        });
      }
    } else {
      // 追加。最大 3 個まで。
      if (allSelectedPatterns.length >= MAX_TOTAL_PATTERNS) return;
      onChangeBrief({
        ...brief,
        additionalPatterns: [...additionalPatterns, p],
      });
    }
  };

  const handleProLockClick = () => setProLockOpen(true);

  const toggleSize = (s: IroncladSize) => {
    const has = brief.sizes.includes(s);
    const nextSizes = has ? brief.sizes.filter((x) => x !== s) : [...brief.sizes, s];
    onChangeBrief({ ...brief, sizes: nextSizes });
  };

  const [lpUrl, setLpUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Phase A.15: カスタムサイズ入力 state
  const [customWidth, setCustomWidth] = useState<string>('');
  const [customHeight, setCustomHeight] = useState<string>('');
  const [customError, setCustomError] = useState<string | null>(null);

  const addCustomSize = () => {
    setCustomError(null);
    const w = parseInt(customWidth, 10);
    const h = parseInt(customHeight, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
      setCustomError('幅と高さに 1 以上の整数を入力してください');
      return;
    }
    if (w > CUSTOM_SIZE_MAX || h > CUSTOM_SIZE_MAX) {
      setCustomError(`生成できるサイズは最大 ${CUSTOM_SIZE_MAX}px × ${CUSTOM_SIZE_MAX}px です`);
      return;
    }
    const sizeKey: IroncladSize = `カスタム ${w}x${h}` as IroncladSize;
    if (brief.sizes.includes(sizeKey)) {
      setCustomError('同じサイズが既に追加されています');
      return;
    }
    onChangeBrief({ ...brief, sizes: [...brief.sizes, sizeKey] });
    setCustomWidth('');
    setCustomHeight('');
  };

  // brief.sizes 内のカスタムサイズだけ取り出して表示用に
  const selectedCustomSizes = brief.sizes.filter((s) => parseCustomSize(s) !== null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyzeLp = async () => {
    const url = lpUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) {
      setAnalyzeError('http:// または https:// で始まる URL を入力してください');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const insights = json.insights ?? {};
      const product = insights.inferred_product_name ?? '';
      const target = insights.inferred_target_demographic ?? '';
      const purposeParts = [
        insights.main_appeal,
        insights.worldview ? `（世界観: ${insights.worldview}）` : '',
        insights.insight ? `インサイト: ${insights.insight}` : '',
      ].filter(Boolean);
      onChangeBrief({
        ...brief,
        product: product || brief.product,
        target: target || brief.target,
        purpose: purposeParts.join(' / ') || brief.purpose,
      });
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">STEP 1. お題</h2>
        <p className="text-sm text-slate-400 mt-1">
          パターンと商材情報を入力してください。次の画面で AI が コピー・デザイン要件の候補を自動生成します。
        </p>
      </div>

      <div className="border border-sky-700/50 rounded-lg p-4 bg-sky-950/20 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-sky-300">LP URL から自動抽出（任意）</h3>
        </div>
        <p className="text-xs text-slate-400">
          商材 LP の URL を貼ると AI が読み込んで「商材 / ターゲット / 目的」を自動入力します（既存の入力は上書き）。
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/products/xxx"
            value={lpUrl}
            onChange={(e) => setLpUrl(e.target.value)}
            disabled={analyzing}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAnalyzeLp}
            disabled={analyzing || !lpUrl.trim()}
            className="flex items-center gap-1 px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                解析中…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                解析して自動入力
              </>
            )}
          </button>
        </div>
        {analyzeError && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            {analyzeError}
          </div>
        )}
      </div>

      {/* Phase A.8: 勝ちバナー参照セクション */}
      <WinningBannerLibrary
        useWinningRef={useWinningRef}
        onChangeUseWinningRef={onChangeUseWinningRef}
      />

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2 flex items-center gap-2 flex-wrap">
          <span>パターン *</span>
          {isPaid ? (
            <span className="text-[11px] font-normal text-teal-300 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              最大{MAX_TOTAL_PATTERNS}個まで複数選択可（同じコピー・素材で別スタイル一括生成）
            </span>
          ) : (
            <button
              type="button"
              onClick={handleProLockClick}
              className="text-[11px] font-normal text-amber-300 hover:text-amber-200 underline decoration-dotted inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Pro なら最大{MAX_TOTAL_PATTERNS}個まで同時に複数選択可
            </button>
          )}
        </label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {IRONCLAD_PATTERNS.map((p) => {
            const selected = allSelectedPatterns.includes(p);
            const disabledByMax =
              isPaid && !selected && allSelectedPatterns.length >= MAX_TOTAL_PATTERNS;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePatternClick(p)}
                disabled={disabledByMax}
                className={`px-2 py-2 rounded text-xs transition ${
                  selected
                    ? 'bg-teal-500 text-white shadow'
                    : disabledByMax
                      ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {selected && isPaid && allSelectedPatterns.length > 1 ? '✓ ' : ''}
                {p}
              </button>
            );
          })}
        </div>
        {isPaid && allSelectedPatterns.length > 1 && (
          <p className="text-[11px] text-amber-300 mt-2">
            ⚠️ {allSelectedPatterns.length} スタイル × {brief.sizes.length} サイズ ={' '}
            {allSelectedPatterns.length * brief.sizes.length} 回消費します
          </p>
        )}
      </div>

      {/* Phase A.16: Pro 機能ロックモーダル */}
      <ProFeatureLockModal
        open={proLockOpen}
        onClose={() => setProLockOpen(false)}
        plan={user.plan}
        maxPatterns={MAX_TOTAL_PATTERNS}
      />

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">
          商材 *<span className="text-[11px] font-normal text-slate-400 ml-2">
            テキスト入力 or LP URL 貼り付け（どちらでも可）
          </span>
        </label>
        <input
          type="text"
          placeholder="例: 5 POINT DETOX / または LP URL"
          value={brief.product}
          onChange={(e) => onChangeBrief({ ...brief, product: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">ターゲット *</label>
        <input
          type="text"
          placeholder="例: 40代女性、体重が落ちにくくなってきた、忙しくて運動する時間がない"
          value={brief.target}
          onChange={(e) => onChangeBrief({ ...brief, target: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">目的・コンセプト *</label>
        <textarea
          placeholder="例: 16日間の短期集中デトックスで体重2kg減を訴求。朝1杯の手軽さと累計実績による信頼感を両立"
          value={brief.purpose}
          onChange={(e) => onChangeBrief({ ...brief, purpose: e.target.value })}
          className="w-full h-20 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white resize-none"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-bold text-slate-200">
          サイズ *（複数選択可・カテゴリ別。統一感のある複数バリエーションを一括生成）
        </label>

        {IRONCLAD_SIZE_CATEGORIES.map((cat) => {
          const anyCropInCat = cat.sizes.some((s) => SIZE_TO_API_IRONCLAD[s].needsCrop);
          return (
            <div
              key={cat.key}
              className="border border-slate-700 rounded-lg p-3 bg-slate-900/40 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-300">
                  {cat.emoji} {cat.label}
                </div>
                {anyCropInCat && (
                  <span className="text-[10px] text-amber-400 bg-amber-950/40 rounded px-2 py-0.5 border border-amber-800">
                    ⚠ 3:1超を含む（自動クロップ推奨）
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {cat.sizes.map((s) => {
                  const meta = SIZE_TO_API_IRONCLAD[s];
                  const active = brief.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={`px-2 py-2 rounded text-[11px] transition border text-left ${
                        active
                          ? 'bg-teal-500 text-white shadow border-teal-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                      }`}
                      title={meta.layoutHint}
                    >
                      <span className="mr-1">{active ? '✓' : '☐'}</span>
                      {s}
                      {meta.needsCrop && (
                        <span className="ml-1 text-amber-300" title="3:1を超えるため自動クロップが必要">
                          ✂
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Phase A.15: カスタムサイズ入力 */}
        <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-300">📐 カスタムサイズ（任意）</div>
            <span className="text-[10px] text-slate-500">最大 {CUSTOM_SIZE_MAX} × {CUSTOM_SIZE_MAX} px</span>
          </div>
          <p className="text-[11px] text-slate-400">
            既存フォーマットにないサイズを使いたい場合、ここに 幅 × 高さ を入力して「追加」を押してください。
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              max={CUSTOM_SIZE_MAX}
              value={customWidth}
              onChange={(e) => {
                setCustomError(null);
                setCustomWidth(e.target.value);
              }}
              placeholder="幅"
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
            />
            <span className="text-slate-400 text-sm">×</span>
            <input
              type="number"
              min={1}
              max={CUSTOM_SIZE_MAX}
              value={customHeight}
              onChange={(e) => {
                setCustomError(null);
                setCustomHeight(e.target.value);
              }}
              placeholder="高さ"
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
            />
            <span className="text-slate-400 text-sm">px</span>
            <button
              type="button"
              onClick={addCustomSize}
              disabled={!customWidth || !customHeight}
              className="px-3 py-1.5 rounded text-xs bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white transition"
            >
              追加
            </button>
          </div>
          {customError && (
            <p className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1 border border-red-900">
              ⚠ {customError}
            </p>
          )}
          {selectedCustomSizes.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {selectedCustomSizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className="px-2 py-2 rounded text-[11px] bg-teal-500 text-white shadow border border-teal-400 text-left flex items-center justify-between"
                >
                  <span>
                    <span className="mr-1">✓</span>
                    {s}
                  </span>
                  <span className="text-[10px] text-teal-100/80 hover:text-white" title="削除">
                    ✕
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {brief.sizes.length === 0 && (
          <p className="text-xs text-amber-400">少なくとも1つ選択してください</p>
        )}
        {brief.sizes.some((s) => getIroncladSizeMeta(s).needsCrop) && (
          <p className="text-xs text-amber-300 bg-amber-950/30 rounded px-2 py-1 border border-amber-900">
            ✂ マーク付きサイズはアスペクト比制限により 3:1 で生成されます。
            最終サイズに合わせた手動クロップが必要です。
          </p>
        )}
      </div>

      {/* Phase B.5: admin 限定の動画 co-gen 設定 (アスペクト比選択) */}
      {user.plan === 'admin' && (
        <VideoCogenSection
          selected={brief.videoAspectRatios ?? []}
          onChange={(ars) => onChangeBrief({ ...brief, videoAspectRatios: ars })}
          patternCount={allSelectedPatterns.length}
          sizeCount={brief.sizes.length}
          narrationEnabled={brief.videoNarrationEnabled ?? false}
          onChangeNarrationEnabled={(v) =>
            onChangeBrief({ ...brief, videoNarrationEnabled: v })
          }
          narrationScript={brief.videoNarrationScript ?? ''}
          onChangeNarrationScript={(v) =>
            onChangeBrief({ ...brief, videoNarrationScript: v })
          }
        />
      )}

      <AssetLibrary
        assetType="product"
        selectedId={productAsset?.id ?? null}
        onSelect={onChangeProductAsset}
        label="🧴 商品画像（任意）"
      />

      <AssetLibrary
        assetType="badge"
        selectedId={badge1Asset?.id ?? null}
        onSelect={onChangeBadge1Asset}
        label="🏅 認証・権威バッジ 1（任意）"
      />

      <AssetLibrary
        assetType="badge"
        selectedId={badge2Asset?.id ?? null}
        onSelect={onChangeBadge2Asset}
        label="🏆 認証・権威バッジ 2（任意）"
      />

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="px-8 py-3 rounded-xl text-white font-bold shadow-lg transition bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ（AIサジェスト生成）→
        </button>
      </div>
    </div>
  );
}

/**
 * Phase B.5: admin 限定の動画 co-gen 設定セクション。
 * 静止画と同じ Pattern × Size の組合せに対し、選んだ AR ごとに 1 本ずつ動画生成。
 * 1:1 は Veo 3.1 が現状サポートしていないため UI に出さない。
 */
function VideoCogenSection({
  selected,
  onChange,
  patternCount,
  sizeCount,
  narrationEnabled,
  onChangeNarrationEnabled,
  narrationScript,
  onChangeNarrationScript,
}: {
  selected: VideoCogenAspectRatio[];
  onChange: (next: VideoCogenAspectRatio[]) => void;
  patternCount: number;
  sizeCount: number;
  narrationEnabled: boolean;
  onChangeNarrationEnabled: (v: boolean) => void;
  narrationScript: string;
  onChangeNarrationScript: (v: string) => void;
}) {
  const ALL_ARS: { value: VideoCogenAspectRatio; label: string; hint: string }[] = [
    { value: '9:16', label: '9:16 (縦)', hint: 'Reels / TikTok / Shorts' },
    { value: '16:9', label: '16:9 (横)', hint: 'YouTube / 横動画広告' },
  ];

  const toggle = (ar: VideoCogenAspectRatio) => {
    if (selected.includes(ar)) {
      onChange(selected.filter((x) => x !== ar));
    } else {
      onChange([...selected, ar]);
    }
  };

  const totalVideos = patternCount * sizeCount * selected.length;

  return (
    <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.04] space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-amber-200">
          🎬 動画も生成する <span className="text-xs text-amber-400/70">(admin β)</span>
        </h3>
        {selected.length > 0 && (
          <span className="text-[11px] text-amber-200/80 tabular-nums">
            動画 {totalVideos} 本
          </span>
        )}
      </div>
      <p className="text-[11px] text-amber-300/70 leading-relaxed">
        静止画と同じ Pattern × Size の組合せに対し、選んだアスペクト比ごとに動画を 1 本ずつ生成します。
        OFF なら動画は作りません。
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_ARS.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                active
                  ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                  : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-amber-600'
              }`}
            >
              {active ? '✓ ' : ''}
              {opt.label}
              <span className="ml-1 text-[10px] opacity-70">{opt.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-amber-400/50">
        Veo 3.1 Fast / 8 秒 / 1080p。1:1 は現在 Veo 非対応のため除外しています。
      </p>

      {/* Phase B.6: 人物に日本語を話させる (Veo 3.1 Lite で音声+リップシンク同時生成) */}
      {selected.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-400/20 space-y-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={narrationEnabled}
              onChange={(e) => onChangeNarrationEnabled(e.target.checked)}
              className="w-4 h-4 accent-amber-400"
            />
            <span className="text-xs font-bold text-amber-200">
              人物に日本語を話させる
              <span className="ml-1 text-[10px] text-amber-400/70">
                (音声+リップシンク / Veo 3.1 Lite)
              </span>
            </span>
          </label>
          {narrationEnabled && (
            <div className="space-y-1 pl-6">
              <label className="block text-[11px] text-amber-300/80">
                セリフ (任意 / 空欄なら自動生成)
              </label>
              <textarea
                value={narrationScript}
                onChange={(e) => onChangeNarrationScript(e.target.value)}
                placeholder="例: 16日で-2kg、40代の新習慣、試してみて"
                maxLength={60}
                rows={2}
                className="w-full px-2 py-1.5 rounded bg-slate-900/60 border border-amber-700/40 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-amber-400/50">
                8 秒以内で話せる 15〜40 文字程度を目安に。空欄なら静止画コピーから AI が自動生成します。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Phase A.16: 「複数スタイル生成」を Free がクリックしたときの Pro 訴求モーダル。
 * UsageLimitModal は使用回数前提で文言が合わないため、本機能専用に inline 定義。
 */
function ProFeatureLockModal({
  open,
  onClose,
  plan,
  maxPatterns,
}: {
  open: boolean;
  onClose: () => void;
  plan: string;
  maxPatterns: number;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,480px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-300" />
          複数スタイル生成は Pro 限定
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          同じコピー・素材で「王道」「ラグジュアリー」など複数のスタイルを並列生成し、
          ベストな1枚を見つける機能です。Pro プランでは最大 {maxPatterns} スタイル × 17 サイズまでまとめて生成できます。
        </p>
        <ul className="text-xs text-slate-300 space-y-1 mb-5 pl-4 list-disc">
          <li>1 ブリーフから最大 {maxPatterns} スタイル並列生成</li>
          <li>スタイル別にまとめて表示・ダウンロード</li>
          <li>月 100 回まで定額、超過分は ¥80/回</li>
        </ul>
        <div className="flex flex-col gap-2">
          {PRO_PRICE_ID && plan !== 'pro' && plan !== 'admin' ? (
            <CheckoutButton
              basePriceId={PRO_PRICE_ID}
              label="Pro にアップグレード（¥14,800/月）"
              className="w-full px-4 py-3 rounded bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white font-bold transition"
            />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-xs text-slate-400 hover:text-white"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}
