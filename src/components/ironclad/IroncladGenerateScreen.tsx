'use client';

import React, { useState } from 'react';
import { Download, Sparkles, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type {
  IroncladBaseMaterials,
  IroncladMaterials,
  IroncladSize,
} from '@/lib/prompts/ironclad-banner';
import { GenerationProgress } from '@/components/ui/GenerationProgress';
import { Toast } from '@/components/ui/Toast';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { isUsageLimitReached } from '@/lib/plans/usage-check';
import { UsageLimitModal } from '@/components/layout/UsageLimitModal';

type Props = {
  baseMaterials: IroncladBaseMaterials;
  sizes: IroncladSize[];
  onBack: () => void;
};

type SizeResult = {
  size: IroncladSize;
  status: 'idle' | 'generating' | 'success' | 'error';
  imageUrl?: string;
  promptPreview?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export function IroncladGenerateScreen({ baseMaterials, sizes, onBack }: Props) {
  // Phase A.11.3: useSession で current user を取得し、生成前の上限 pre-check と
  // 成功時の usageCount session 反映に使用
  const { data: session, update: updateSession } = useSession();
  const user = sessionToCurrentUser(session);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);
  // Phase A.11.5: 履歴保存通知トースト
  const [toastInfo, setToastInfo] = useState<{ generationId: string } | null>(null);

  const [results, setResults] = useState<SizeResult[]>(
    sizes.map((size) => ({ size, status: 'idle' })),
  );
  const [overallGenerating, setOverallGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const updateResult = (size: IroncladSize, patch: Partial<SizeResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.size === size ? { ...r, ...patch } : r)),
    );
  };

  const generateOne = async (size: IroncladSize): Promise<void> => {
    // Phase A.11.3: 生成前 pre-check（API 呼出前に上限到達なら即 Modal）
    if (
      user.userId &&
      isUsageLimitReached({
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        usageResetAt: user.usageResetAt,
      })
    ) {
      setUsageLimitModalOpen(true);
      return;
    }

    updateResult(size, { status: 'generating', errorMessage: undefined });
    const materials: IroncladMaterials = { ...baseMaterials, size };

    // Phase A.11.2 hotfix: クライアント側タイムアウト 320s（サーバ maxDuration=300s + 余裕 20s）。
    // これがないと Vercel が 504 で関数を落としても fetch が永遠に hang する。
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
        updateResult(size, { status: 'idle' });
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
      updateResult(size, {
        status: 'success',
        imageUrl: json.imageUrl,
        promptPreview: json.promptPreview,
        metadata: json.metadata,
      });

      // Phase A.11.3: ヘッダーカウンタ即時反映（client-side session merge）
      if (typeof json.usageCount === 'number') {
        await updateSession({ usageCount: json.usageCount });
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
      updateResult(size, {
        status: 'error',
        errorMessage,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const generateAll = async () => {
    setOverallGenerating(true);
    // 直列生成（APIレート制限/コスト管理のため）
    for (const size of sizes) {
      await generateOne(size);
    }
    setOverallGenerating(false);
  };

  const handleDownload = (imageUrl: string, size: IroncladSize) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (baseMaterials.product || 'banner').replace(
      /[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g,
      '_',
    ).slice(0, 30);
    const sizeTag = size.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `ironclad_${safeName}_${sizeTag}_${ts}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const completedCount = results.filter((r) => r.status === 'success').length;
  const anyPromptPreview = results.find((r) => r.promptPreview)?.promptPreview;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">STEP 3. 完成</h2>
          <p className="text-sm text-slate-400 mt-1">
            選択した {sizes.length} サイズ全てを同じ材料で生成します。統一感を担保するため直列処理。
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

      <MaterialsSummary baseMaterials={baseMaterials} sizes={sizes} />

      {showPrompt && anyPromptPreview && (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-950/50">
          <h3 className="text-xs font-bold text-teal-300 mb-2">鉄板プロンプト（1枚目のもの、サイズ以外同じ）</h3>
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
{anyPromptPreview}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={generateAll}
          disabled={overallGenerating}
          className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:opacity-90 disabled:opacity-40 shadow-xl hover:scale-[1.02] transition-transform"
        >
          <Sparkles className={`w-5 h-5 ${overallGenerating ? 'animate-pulse' : ''}`} />
          {overallGenerating
            ? `生成中… ${completedCount + 1}/${sizes.length}`
            : completedCount > 0
              ? `すべて再生成（${sizes.length}サイズ）`
              : `バナー生成開始（${sizes.length}サイズ）`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((r) => (
          <div
            key={r.size}
            className="border border-slate-700 rounded-lg p-3 bg-slate-900/50 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200">{r.size}</div>
              <div className="flex items-center gap-1">
                {r.status === 'success' && r.metadata && typeof r.metadata.referenceCount === 'number' && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      r.metadata.referenceCount > 0
                        ? 'bg-teal-900/50 text-teal-300 border-teal-700'
                        : 'bg-amber-900/50 text-amber-300 border-amber-700'
                    }`}
                    title={`素材 ${r.metadata.referenceCount} 枚使用 / mode: ${r.metadata.mode ?? 'unknown'}`}
                  >
                    素材: {r.metadata.referenceCount as number}枚
                  </span>
                )}
                <StatusBadge status={r.status} />
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
                  alt={`Banner ${r.size}`}
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
                  onClick={() => generateOne(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  このサイズだけ再生成
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(r.imageUrl!, r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  DL
                </button>
              </div>
            )}
            {r.status === 'error' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => generateOne(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  再試行
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

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

function StatusBadge({ status }: { status: SizeResult['status'] }) {
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
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  );
}

function MaterialsSummary({
  baseMaterials,
  sizes,
}: {
  baseMaterials: IroncladBaseMaterials;
  sizes: IroncladSize[];
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-2 text-xs">
      <h3 className="text-sm font-bold text-teal-300 mb-3">選択した材料</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
        <KV label="パターン" value={baseMaterials.pattern} />
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
