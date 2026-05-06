'use client';

/**
 * Phase B.1: 動画生成ダイアログ
 *
 * 既存のバナー画像から動画を生成するための UI。既存サイトと同じダーク基調。
 * - フォーマット選択 (9:16/16:9/1:1)
 * - 尺 (4/6/8 秒、provider により制限)
 * - プロバイダ (Veo Fast / Veo Lite 音声付 / Kling tier)
 * - 動きの指示 (日本語入力 + AI 提案)
 *
 * 金額表示は意図的に省略 (admin 検証中は気にせず使ってもらう方針)。
 */

import { useEffect, useState } from 'react';
import { Sparkles, X, Download, Wand2, Loader2 } from 'lucide-react';
import { GenerationProgress } from '@/components/ui/GenerationProgress';

interface VideoGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  generationId: string;
  inputImageUrl: string;
  /// 既存バナーの size 文字列 (例: "Instagram (1080x1080)") を表示
  imageSizeLabel?: string;
}

type ProviderId =
  | 'veo-3.1-fast'
  | 'veo-3.1-lite'
  | 'kling-2.1-standard'
  | 'kling-2.1-pro'
  | 'kling-2.1-master';

interface ProviderOption {
  id: ProviderId;
  label: string;
  allowedDurations: number[];
  supportsAudio: boolean;
  description: string;
  /// 完了までの推定秒数 (プログレスバー用)
  estimatedSeconds: number;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    allowedDurations: [4, 6, 8],
    supportsAudio: false,
    description: '高速・コスパ良。音声なし。',
    estimatedSeconds: 60,
  },
  {
    id: 'veo-3.1-lite',
    label: 'Veo 3.1 Lite (音声+リップシンク)',
    allowedDurations: [4, 6, 8],
    supportsAudio: true,
    description: '音声+口パクを同時生成。記事のHeyGen互換。',
    estimatedSeconds: 75,
  },
  {
    id: 'kling-2.1-standard',
    label: 'Kling 2.1 Standard',
    allowedDurations: [5, 10],
    supportsAudio: false,
    description: '高速で軽い動き向け。音声なし。',
    estimatedSeconds: 90,
  },
  {
    id: 'kling-2.1-pro',
    label: 'Kling 2.1 Pro',
    allowedDurations: [5, 10],
    supportsAudio: false,
    description: 'プロ品質。動きが自然。',
    estimatedSeconds: 120,
  },
];

const ASPECT_OPTIONS: Array<{ value: '9:16' | '16:9' | '1:1'; label: string }> = [
  { value: '9:16', label: '9:16 縦型 (Reels/TikTok/Shorts)' },
  { value: '16:9', label: '16:9 横型 (YouTube/Web)' },
  { value: '1:1', label: '1:1 正方形 (Instagram フィード)' },
];

/// 内部 status を顧客向け日本語に変換
function statusToJa(status: string | null): string {
  switch (status) {
    case 'pending':
      return '生成キューに登録しました';
    case 'processing':
      return 'AI が動画を作成中です';
    case 'done':
      return '完成しました';
    case 'failed':
      return '生成に失敗しました';
    default:
      return '準備中';
  }
}

export function VideoGenerationDialog({
  isOpen,
  onClose,
  generationId,
  inputImageUrl,
  imageSizeLabel,
}: VideoGenerationDialogProps) {
  const [provider, setProvider] = useState<ProviderId>('veo-3.1-fast');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [durationSeconds, setDurationSeconds] = useState<number>(8);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [promptJa, setPromptJa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  const currentProvider = PROVIDERS.find((p) => p.id === provider)!;
  const validDuration = currentProvider.allowedDurations.includes(durationSeconds)
    ? durationSeconds
    : currentProvider.allowedDurations[currentProvider.allowedDurations.length - 1];

  // dialog 起動時にプロバイダ選択肢に応じて尺を補正
  useEffect(() => {
    if (!currentProvider.allowedDurations.includes(durationSeconds)) {
      setDurationSeconds(
        currentProvider.allowedDurations[currentProvider.allowedDurations.length - 1],
      );
    }
    if (!currentProvider.supportsAudio) setGenerateAudio(false);
  }, [provider, currentProvider, durationSeconds]);

  // 動画生成ジョブをポーリング
  useEffect(() => {
    if (!videoId || videoStatus === 'done' || videoStatus === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate-video/${videoId}`);
        if (!res.ok) return;
        const data = await res.json();
        setVideoStatus(data.status);
        if (data.status === 'done' && data.blobUrl) {
          setVideoBlobUrl(data.blobUrl);
          clearInterval(interval);
        } else if (data.status === 'failed') {
          setErrorMessage(data.errorMessage ?? '生成に失敗しました');
          clearInterval(interval);
        }
      } catch (e) {
        console.error('poll error:', e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [videoId, videoStatus]);

  /**
   * fetch のレスポンスを安全に JSON パース。
   * Content-Type が application/json でない場合は status code から
   * 適切な日本語メッセージを返す（gzip HTML を JSON.parse して binary
   * エラーを出すのを防ぐ）。
   */
  const safeParseJson = async (res: Response): Promise<{ data: any; errorMessage?: string }> => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      let msg: string;
      if (res.status === 401) msg = 'ログインの有効期限が切れました。再ログインしてください。';
      else if (res.status === 403) msg = 'この機能を使う権限がありません。';
      else if (res.status === 404) msg = 'API が見つかりませんでした。';
      else if (res.status >= 500) msg = `サーバーエラー (${res.status})。しばらくしてから再試行してください。`;
      else msg = `予期しない応答 (${res.status})`;
      return { data: null, errorMessage: msg };
    }
    try {
      return { data: await res.json() };
    } catch (e) {
      return {
        data: null,
        errorMessage: 'サーバーから不正な応答が返りました。再試行してください。',
      };
    }
  };

  const handleSubmit = async () => {
    if (!promptJa.trim()) {
      setErrorMessage('動きの指示を入力してください');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId,
          inputImageUrl,
          promptJa: promptJa.trim(),
          provider,
          aspectRatio,
          durationSeconds: validDuration,
          generateAudio: currentProvider.supportsAudio && generateAudio,
          format: `${aspectRatio} ${validDuration}s`,
        }),
      });
      const { data, errorMessage: parseError } = await safeParseJson(res);
      if (parseError) {
        setErrorMessage(parseError);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setErrorMessage(data?.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      setVideoId(data.videoId);
      setVideoStatus(data.status);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestPrompt = async () => {
    setSuggesting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/suggest-video-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputImageUrl, generationId }),
      });
      const { data, errorMessage: parseError } = await safeParseJson(res);
      if (parseError) {
        setErrorMessage(parseError);
        return;
      }
      if (!res.ok) {
        setErrorMessage(data?.error || `HTTP ${res.status}`);
        return;
      }
      if (typeof data.promptJa === 'string' && data.promptJa.trim()) {
        setPromptJa(data.promptJa.trim().slice(0, 500));
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleReset = () => {
    setVideoId(null);
    setVideoStatus(null);
    setVideoBlobUrl(null);
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  // ダーク基調 (既存サイトと統一)
  const inputClass =
    'w-full rounded border border-slate-700 bg-slate-900 p-2 text-slate-100 focus:border-purple-500 focus:outline-none';
  const labelClass = 'mb-1 block text-sm font-medium text-slate-200';

  // 生成中 (videoId が立っていて done/failed でない) は X ボタンも無効化
  // → ユーザーが誤って閉じて進捗を見失わないようにする
  const inProgress = Boolean(videoId) && videoStatus !== 'done' && videoStatus !== 'failed';

  // 背景クリックでは絶対に閉じない (作業状況を見失う事故を防ぐ)
  // 閉じるのは右上の X ボタンのみ。生成中は X も無効化。
  const handleClose = () => {
    if (inProgress) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-800 bg-neutral-950 shadow-2xl"
      >
        {/* ヘッダ */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-neutral-950 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100">
            <Sparkles className="h-5 w-5 text-purple-400" />
            動画化 {imageSizeLabel ? <span className="text-sm text-slate-400">({imageSizeLabel})</span> : null}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={inProgress}
            className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={inProgress ? '生成中は閉じられません' : '閉じる'}
            title={inProgress ? '生成中です。完了するまで閉じられません' : '閉じる'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {/* プレビュー画像 */}
          <div className="flex justify-center">
            <img
              src={inputImageUrl}
              alt="入力画像"
              className="max-h-48 rounded border border-slate-800"
            />
          </div>

          {videoId && videoStatus !== 'done' && videoStatus !== 'failed' ? (
            // 生成中表示 (既存 GenerationProgress を流用)
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
              <GenerationProgress
                estimatedSeconds={currentProvider.estimatedSeconds}
                label={statusToJa(videoStatus)}
              />
              <p className="mt-3 text-center text-xs text-slate-500">
                ※ 30〜120秒ほどかかります。このままお待ちください。
              </p>
            </div>
          ) : videoStatus === 'done' && videoBlobUrl ? (
            // 完成表示
            <div className="space-y-3">
              <video src={videoBlobUrl} controls className="w-full rounded" />
              <div className="flex gap-2">
                <a
                  href={videoBlobUrl}
                  download
                  className="flex-1 rounded bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-purple-500"
                >
                  <Download className="mr-1 inline h-4 w-4" />
                  ダウンロード
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  もう一度生成
                </button>
              </div>
            </div>
          ) : (
            // 入力フォーム
            <>
              {/* プロバイダ */}
              <div>
                <label className={labelClass}>モデル</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as ProviderId)}
                  className={inputClass}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{currentProvider.description}</p>
              </div>

              {/* アスペクト比 */}
              <div>
                <label className={labelClass}>フォーマット</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')}
                  className={inputClass}
                >
                  {ASPECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 尺 */}
              <div>
                <label className={labelClass}>尺</label>
                <div className="flex gap-2">
                  {currentProvider.allowedDurations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationSeconds(d)}
                      className={`flex-1 rounded border p-2 text-sm transition ${
                        validDuration === d
                          ? 'border-purple-500 bg-purple-900/40 font-medium text-purple-100'
                          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {d}秒
                    </button>
                  ))}
                </div>
              </div>

              {/* 音声 (Lite のみ) */}
              {currentProvider.supportsAudio && (
                <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 p-3 text-slate-200 cursor-pointer hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={generateAudio}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    日本語ナレーション + リップシンクを生成 (preview)
                  </span>
                </label>
              )}

              {/* プロンプト */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-200">
                    動きの指示 (日本語)
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestPrompt}
                    disabled={suggesting}
                    className="inline-flex items-center gap-1 rounded border border-purple-500/40 bg-purple-900/30 px-2 py-1 text-xs text-purple-200 hover:bg-purple-900/50 disabled:opacity-50"
                  >
                    {suggesting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    {suggesting ? 'AI 提案中…' : 'AI に書いてもらう'}
                  </button>
                </div>
                <textarea
                  value={promptJa}
                  onChange={(e) => setPromptJa(e.target.value)}
                  placeholder="例: カメラがゆっくりズームアウトしながら、女性が右手で商品を持ち上げて笑顔でこちらを見る"
                  rows={4}
                  className={`${inputClass} placeholder:text-slate-500`}
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-slate-500">{promptJa.length} / 500</p>
              </div>

              {/* エラー */}
              {errorMessage && (
                <div className="rounded border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              )}

              {/* 送信 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !promptJa.trim()}
                className="w-full rounded bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {submitting ? '送信中…' : '動画を生成'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
