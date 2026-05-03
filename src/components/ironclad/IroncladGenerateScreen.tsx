'use client';

import React, { useState } from 'react';
import { UpgradeToBusinessBanner } from './UpgradeToBusinessBanner';
import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';
import { Download, Sparkles, AlertTriangle, Eye, EyeOff, Archive, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';
import JSZip from 'jszip';
import type {
  IroncladBaseMaterials,
  IroncladMaterials,
  IroncladPattern,
  IroncladSize,
} from '@/lib/prompts/ironclad-banner';
import { GenerationProgress } from '@/components/ui/GenerationProgress';
import { Toast } from '@/components/ui/Toast';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { isUsageLimitReached } from '@/lib/plans/usage-check';
import { UsageLimitModal } from '@/components/layout/UsageLimitModal';
import { PreviewBanner } from '@/components/ironclad/PreviewBanner';

/**
 * Phase A.17: ファイル名生成 helpers。
 * 命名規則:
 *   - 個別: `2026-05-04_10-30-45_王道_1080-1080.png`
 *   - 一括: `2026-05-04_10-30-45_all.zip`
 */
function formatTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/** size 文字列から `Width-Height` 形式を抽出。例: "Instagram (1080x1080)" → "1080-1080" */
function extractSizeWH(size: string): string {
  const m = size.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (m) return `${m[1]}-${m[2]}`;
  // フォールバック: 非英数を _ に
  return size.replace(/[^a-zA-Z0-9]/g, '_');
}

function buildFileName(pattern: string, size: string, ts: string): string {
  return `${ts}_${pattern}_${extractSizeWH(size)}.png`;
}

/** data:image/...;base64, プレフィックスを除去して純粋な base64 を返す */
function stripBase64Prefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
}

type Props = {
  baseMaterials: IroncladBaseMaterials;
  /** Phase A.16: [代表 pattern, ...additionalPatterns] の順 */
  patterns: IroncladPattern[];
  sizes: IroncladSize[];
  onBack: () => void;
};

type PatternSizeResult = {
  pattern: IroncladPattern;
  size: IroncladSize;
  status: 'idle' | 'generating' | 'success' | 'error';
  imageUrl?: string;
  promptPreview?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  // Phase A.14: Free 上限超過で透かし入りの場合 true
  isPreview?: boolean;
  // Phase A.17: 一括 DL のチェック状態（生成成功時に true で初期化）
  selected?: boolean;
};

export function IroncladGenerateScreen({ baseMaterials, patterns, sizes, onBack }: Props) {
  // Phase A.11.3: useSession で current user を取得し、生成前の上限 pre-check と
  // 成功時の usageCount session 反映に使用
  const { data: session, update: updateSession } = useSession();
  const user = sessionToCurrentUser(session);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);
  // Phase A.11.5: 履歴保存通知トースト
  const [toastInfo, setToastInfo] = useState<{ generationId: string } | null>(null);

  // Phase A.16: pattern × size のマトリクス。pattern 順 × size 順で flat に保持。
  const [results, setResults] = useState<PatternSizeResult[]>(() =>
    patterns.flatMap((pattern) =>
      sizes.map((size) => ({ pattern, size, status: 'idle' as const })),
    ),
  );
  const [overallGenerating, setOverallGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Phase A.17.0 Y: Pro 上限到達検知（一度 true になったらセッション内維持）
  const [proLimitReachedInSession, setProLimitReachedInSession] = useState(false);

  const updateResult = (
    pattern: IroncladPattern,
    size: IroncladSize,
    patch: Partial<PatternSizeResult>,
  ) => {
    setResults((prev) =>
      prev.map((r) => (r.pattern === pattern && r.size === size ? { ...r, ...patch } : r)),
    );
  };

  const generateOne = async (pattern: IroncladPattern, size: IroncladSize): Promise<void> => {
    // Phase A.11.3: 生成前 pre-check（API 呼出前に上限到達なら即 Modal）
    // Phase A.14: starter のみ block。free は preview, pro は metered で通す。
    if (
      user.userId &&
      user.plan === 'starter' &&
      isUsageLimitReached({
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        usageResetAt: user.usageResetAt,
      })
    ) {
      setUsageLimitModalOpen(true);
      return;
    }

    updateResult(pattern, size, { status: 'generating', errorMessage: undefined });
    // Phase A.16: ループごとに pattern を差し替えて API に渡す
    const materials: IroncladMaterials = { ...baseMaterials, pattern, size };

    // Phase A.11.2 hotfix: クライアント側タイムアウト 320s（サーバ maxDuration=300s + 余裕 20s）。
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320 * 1000);

    try {
      const res = await fetch('/api/ironclad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials),
        signal: controller.signal,
      });

      // Phase A.11.3: 429 = 上限到達（API gate）→ Modal 表示
      if (res.status === 429) {
        setUsageLimitModalOpen(true);
        updateResult(pattern, size, { status: 'idle' });
        return;
      }

      // 非 2xx は JSON parse 前に分岐（504 等は body が JSON でない可能性あり）
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j?.error || errMsg;
        } catch {
          if (res.status === 504) {
            errMsg = '生成がタイムアウトしました（5分超過）。もう一度お試しください';
          }
        }
        throw new Error(errMsg);
      }

      const json = await res.json();
      updateResult(pattern, size, {
        status: 'success',
        imageUrl: json.imageUrl,
        promptPreview: json.promptPreview,
        metadata: json.metadata,
        isPreview: json.isPreview === true,
        selected: true, // Phase A.17: 生成成功時に一括 DL 対象として ON
      });

      // Phase A.11.3: ヘッダーカウンタ即時反映（client-side session merge）
      if (typeof json.usageCount === 'number') {
        await updateSession({ usageCount: json.usageCount });
        // Phase A.17.0 Y: Pro が上限到達したら inline banner を出す
        if (user.plan === 'pro' && json.usageCount > USAGE_LIMIT_PRO) {
          setProLimitReachedInSession(true);
        }
      }

      // Phase A.11.5: 履歴保存通知トースト
      if (typeof json.generationId === 'string') {
        setToastInfo({ generationId: json.generationId });
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const errorMessage = isAbort
        ? '生成がタイムアウトしました（5分20秒経過）。もう一度お試しください'
        : e instanceof Error
          ? e.message
          : String(e);
      updateResult(pattern, size, {
        status: 'error',
        errorMessage,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const generateAll = async () => {
    setOverallGenerating(true);
    // Phase A.16: 直列 pattern 順 × size 順（API レート制限/コスト管理 + ユーザーが進捗を見やすい順）
    for (const pattern of patterns) {
      for (const size of sizes) {
        await generateOne(pattern, size);
      }
    }
    setOverallGenerating(false);
  };

  const handleDownload = (
    imageUrl: string,
    pattern: IroncladPattern,
    size: IroncladSize,
    isPreview: boolean,
  ) => {
    // Phase A.16: Free は preview 透かし入りを DL ロック
    if (isPreview && user.plan === 'free') {
      setUsageLimitModalOpen(true);
      return;
    }
    // Phase A.17: 命名規則統一 → 2026-05-04_10-30-45_王道_1080-1080.png
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = buildFileName(pattern, size, formatTimestamp());
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Phase A.17: 個別カードのチェックボックス切替
  const toggleSelected = (pattern: IroncladPattern, size: IroncladSize) => {
    setResults((prev) =>
      prev.map((r) =>
        r.pattern === pattern && r.size === size ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  // Phase A.17: 一括 DL（jszip でクライアント側 ZIP 生成）
  const [zippingProgress, setZippingProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const handleBatchDownload = async () => {
    // Free が preview 入り画像を含む場合は DL モーダル
    const targets = results.filter(
      (r) => r.status === 'success' && r.imageUrl && r.selected !== false,
    );
    const previewBlocked = targets.some((r) => r.isPreview && user.plan === 'free');
    if (previewBlocked) {
      setUsageLimitModalOpen(true);
      return;
    }
    if (targets.length === 0) return;

    const ts = formatTimestamp();
    const zip = new JSZip();
    setZippingProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      const fileName = buildFileName(r.pattern, r.size, ts);
      const base64 = stripBase64Prefix(r.imageUrl!);
      zip.file(fileName, base64, { base64: true });
      setZippingProgress({ current: i + 1, total: targets.length });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ts}_all.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setZippingProgress(null);
  };

  const completedCount = results.filter((r) => r.status === 'success').length;
  const totalCount = results.length;
  const anyPromptPreview = results.find((r) => r.promptPreview)?.promptPreview;
  // Phase A.14: いずれかの結果が透かし入りなら訴求バナーを表示
  const anyPreview = results.some((r) => r.isPreview === true);
  // Phase A.17: 一括 DL 候補（生成成功 + selected）
  const selectedDownloadable = results.filter(
    (r) => r.status === 'success' && r.imageUrl && r.selected !== false,
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">STEP 3. 完成</h2>
          <p className="text-sm text-slate-400 mt-1">
            選択した {patterns.length} スタイル × {sizes.length} サイズ = {totalCount} 枚を直列生成します。
          </p>
        </div>
        {anyPromptPreview && (
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded text-xs bg-slate-700 hover:bg-slate-600"
          >
            {showPrompt ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPrompt ? 'プロンプトを隠す' : 'プロンプトを見る'}
          </button>
        )}
      </div>

      {/* Phase A.14: Free プラン 4 回目以降の生成完了時に訴求バナー表示 */}
      {anyPreview && <PreviewBanner plan={user.plan} />}

      {/* Phase A.17.0 Y: Pro が 100 枠到達したら Business 訴求 inline banner */}
      <UpgradeToBusinessBanner
        isPro={user.plan === 'pro'}
        proLimitReachedInSession={proLimitReachedInSession}
        totalUsageCount={user.usageCount}
      />


      <MaterialsSummary baseMaterials={baseMaterials} patterns={patterns} sizes={sizes} />

      {showPrompt && anyPromptPreview && (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-950/50">
          <h3 className="text-xs font-bold text-teal-300 mb-2">鉄板プロンプト（生成済 1 枚目のもの）</h3>
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
            {anyPromptPreview}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={generateAll}
          disabled={overallGenerating}
          className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:opacity-90 disabled:opacity-40 shadow-xl hover:scale-[1.02] transition-transform"
        >
          <Sparkles className={`w-5 h-5 ${overallGenerating ? 'animate-pulse' : ''}`} />
          {overallGenerating
            ? `生成中… ${completedCount + 1}/${totalCount}`
            : completedCount > 0
              ? `すべて再生成（${totalCount}枚）`
              : `バナー生成開始（${totalCount}枚）`}
        </button>

        {/* Phase A.17: 一括 DL ボタン（生成成功画像が 1 枚以上で表示） */}
        {completedCount > 0 && (
          <button
            type="button"
            onClick={handleBatchDownload}
            disabled={selectedDownloadable.length === 0 || zippingProgress !== null}
            className="flex items-center gap-2 px-6 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 shadow-xl transition"
          >
            <Archive className="w-5 h-5" />
            {zippingProgress
              ? `ZIP 作成中… ${zippingProgress.current}/${zippingProgress.total}`
              : `選択中 ${selectedDownloadable.length}/${completedCount} 枚を一括DL`}
          </button>
        )}
      </div>

      {/* Phase A.16: スタイル別セクション */}
      {patterns.map((pattern) => (
        <PatternSection
          key={pattern}
          pattern={pattern}
          results={results.filter((r) => r.pattern === pattern)}
          overallGenerating={overallGenerating}
          plan={user.plan}
          onRegenerate={(size) => generateOne(pattern, size)}
          onDownload={(url, size, isPreview) => handleDownload(url, pattern, size, isPreview)}
          onToggleSelected={(size) => toggleSelected(pattern, size)}
        />
      ))}

      <div className="flex justify-start pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
        >
          ← 素材に戻る
        </button>
      </div>

      {/* Phase A.11.3: 上限到達モーダル */}
      <UsageLimitModal
        open={usageLimitModalOpen}
        onClose={() => setUsageLimitModalOpen(false)}
        usageCount={user.usageCount}
        usageLimit={user.usageLimit}
        plan={user.plan}
      />

      {/* Phase A.11.5: 履歴保存通知トースト */}
      {toastInfo && (
        <Toast
          message="履歴に保存しました"
          actionLabel="履歴を見る"
          actionHref={`/history/${toastInfo.generationId}`}
          onClose={() => setToastInfo(null)}
        />
      )}
    </div>
  );
}

function PatternSection({
  pattern,
  results,
  overallGenerating,
  plan,
  onRegenerate,
  onDownload,
  onToggleSelected,
}: {
  pattern: IroncladPattern;
  results: PatternSizeResult[];
  overallGenerating: boolean;
  plan: string;
  onRegenerate: (size: IroncladSize) => void;
  onDownload: (url: string, size: IroncladSize, isPreview: boolean) => void;
  onToggleSelected: (size: IroncladSize) => void;
}) {
  const successCount = results.filter((r) => r.status === 'success').length;
  return (
    <section className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
      <h3 className="text-base font-bold text-teal-300 mb-3 flex items-center gap-2">
        <span className="text-xl">🎨</span>
        <span>{pattern}</span>
        <span className="text-xs text-slate-500 ml-2">
          {successCount}/{results.length}
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((r) => (
          <div
            key={r.size}
            className="border border-slate-700 rounded-lg p-3 bg-slate-900/50 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-200">{r.size}</div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {/* Phase A.17: 完了バッジの右に一括DLチェックマーク（生成成功時のみ表示） */}
                {r.status === 'success' && r.imageUrl && (
                  <button
                    type="button"
                    onClick={() => onToggleSelected(r.size)}
                    aria-label={r.selected !== false ? '一括DLから除外' : '一括DLに含める'}
                    title={r.selected !== false ? '一括DLから除外' : '一括DLに含める'}
                    className={`w-7 h-7 rounded-md border-2 transition flex items-center justify-center shrink-0 ${
                      r.selected !== false
                        ? 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600'
                        : 'bg-slate-700 border-slate-500 text-transparent hover:border-slate-400'
                    }`}
                  >
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-[14rem] flex items-center justify-center bg-slate-950 rounded overflow-hidden">
              {r.status === 'generating' && (
                <div className="w-full">
                  <GenerationProgress compact estimatedSeconds={45} />
                </div>
              )}
              {r.status === 'error' && (
                <div className="text-red-400 text-xs p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  {r.errorMessage}
                </div>
              )}
              {r.status === 'success' && r.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.imageUrl}
                  alt={`Banner ${pattern} ${r.size}`}
                  className="w-full h-auto"
                />
              )}
              {r.status === 'idle' && (
                <div className="text-slate-500 text-xs">
                  {overallGenerating ? '待機中…' : '生成ボタンを押してください'}
                </div>
              )}
            </div>
            {r.status === 'success' && r.imageUrl && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onRegenerate(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  このサイズだけ再生成
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(r.imageUrl!, r.size, r.isPreview === true)}
                  className={`text-[11px] px-2 py-1 rounded text-white font-bold flex items-center gap-1 ${
                    r.isPreview && plan === 'free'
                      ? 'bg-slate-600 hover:bg-slate-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                  title={r.isPreview && plan === 'free' ? 'Pro でロック解除' : 'ダウンロード'}
                >
                  <Download className="w-3 h-3" />
                  {r.isPreview && plan === 'free' ? 'Pro で DL' : 'DL'}
                </button>
              </div>
            )}
            {r.status === 'error' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onRegenerate(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  再試行
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: PatternSizeResult['status'] }) {
  const cls =
    status === 'success'
      ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
      : status === 'generating'
        ? 'bg-sky-900/50 text-sky-300 border-sky-700 animate-pulse'
        : status === 'error'
          ? 'bg-red-900/50 text-red-300 border-red-700'
          : 'bg-slate-900/50 text-slate-400 border-slate-700';
  const label =
    status === 'success'
      ? '完了'
      : status === 'generating'
        ? '生成中'
        : status === 'error'
          ? 'エラー'
          : '待機中';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function MaterialsSummary({
  baseMaterials,
  patterns,
  sizes,
}: {
  baseMaterials: IroncladBaseMaterials;
  patterns: IroncladPattern[];
  sizes: IroncladSize[];
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-2 text-xs">
      <h3 className="text-sm font-bold text-teal-300 mb-3">選択した材料</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
        <KV label="スタイル" value={patterns.join(' / ')} />
        <KV label="サイズ" value={sizes.join(', ')} />
        <KV label="商材" value={baseMaterials.product} />
        <KV label="ターゲット" value={baseMaterials.target} />
        <KV label="目的" value={baseMaterials.purpose} />
        <KV label="トーン" value={baseMaterials.tone} />
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">コピー</div>
        <ul className="space-y-0.5 text-slate-300">
          {baseMaterials.copies.filter(Boolean).map((c, i) => (
            <li key={i}>・{c}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">デザイン要件</div>
        <ul className="space-y-0.5 text-slate-300">
          {baseMaterials.designRequirements.filter(Boolean).map((d, i) => (
            <li key={i}>・{d}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <KV label="CTA" value={baseMaterials.cta} />
        {baseMaterials.caution && <KV label="注意" value={baseMaterials.caution} />}
      </div>
      {(baseMaterials.productImageUrl || baseMaterials.badgeImageUrl1 || baseMaterials.badgeImageUrl2) && (
        <div className="pt-2 border-t border-slate-800">
          <div className="text-slate-500 mb-1">添付素材（composite モードで改変禁止）</div>
          <div className="flex flex-wrap gap-2">
            {baseMaterials.productImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={baseMaterials.productImageUrl}
                alt="product"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
            {baseMaterials.badgeImageUrl1 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={baseMaterials.badgeImageUrl1}
                alt="badge1"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
            {baseMaterials.badgeImageUrl2 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={baseMaterials.badgeImageUrl2}
                alt="badge2"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
