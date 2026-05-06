'use client';

/**
 * Phase B.1: 動画生成ダイアログ
 *
 * 既存のバナー画像から動画を生成するための UI。
 * - フォーマット選択 (9:16/16:9/1:1)
 * - 尺 (4/6/8 秒、provider により制限)
 * - プロバイダ (Veo Fast / Veo Lite 音声付 / Kling tier)
 * - 動きの指示 (日本語入力)
 *
 * 送信後はポーリング表示。完成すると <video> プレビュー。
 */

import { useEffect, useState } from 'react';
import { Sparkles, X, Download, Loader2 } from 'lucide-react';

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
  pricePerSec: number;
  allowedDurations: number[];
  supportsAudio: boolean;
  description: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    pricePerSec: 0.15,
    allowedDurations: [4, 6, 8],
    supportsAudio: false,
    description: '高速・コスパ良。音声なし。',
  },
  {
    id: 'veo-3.1-lite',
    label: 'Veo 3.1 Lite (音声+リップシンク)',
    pricePerSec: 0.10,
    allowedDurations: [4, 6, 8],
    supportsAudio: true,
    description: '音声+口パクを同時生成。記事のHeyGen互換。',
  },
  {
    id: 'kling-2.1-standard',
    label: 'Kling 2.1 Standard',
    pricePerSec: 0.025,
    allowedDurations: [5, 10],
    supportsAudio: false,
    description: '最安価格。音声なし。',
  },
  {
    id: 'kling-2.1-pro',
    label: 'Kling 2.1 Pro',
    pricePerSec: 0.05,
    allowedDurations: [5, 10],
    supportsAudio: false,
    description: 'プロ品質。動きが自然。',
  },
];

const ASPECT_OPTIONS: Array<{ value: '9:16' | '16:9' | '1:1'; label: string }> = [
  { value: '9:16', label: '9:16 縦型 (Reels/TikTok/Shorts)' },
  { value: '16:9', label: '16:9 横型 (YouTube/Web)' },
  { value: '1:1', label: '1:1 正方形 (Instagram フィード)' },
];

const USD_TO_JPY = 155;
const formatJpy = (usd: number) => `¥${Math.round(usd * USD_TO_JPY).toLocaleString()}`;

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

  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  const currentProvider = PROVIDERS.find((p) => p.id === provider)!;
  const validDuration = currentProvider.allowedDurations.includes(durationSeconds)
    ? durationSeconds
    : currentProvider.allowedDurations[currentProvider.allowedDurations.length - 1];

  const costUsd = currentProvider.pricePerSec * validDuration;

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
          // promptEn を入れていない場合は API 側で promptJa を流用
          provider,
          aspectRatio,
          durationSeconds: validDuration,
          generateAudio: currentProvider.supportsAudio && generateAudio,
          format: `${aspectRatio} ${validDuration}s`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || `HTTP ${res.status}`);
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

  const handleReset = () => {
    setVideoId(null);
    setVideoStatus(null);
    setVideoBlobUrl(null);
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダ */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-purple-600" />
            動画化 {imageSizeLabel ? `(${imageSizeLabel})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="閉じる"
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
              className="max-h-48 rounded border"
            />
          </div>

          {videoId && videoStatus !== 'done' && videoStatus !== 'failed' ? (
            // 生成中表示
            <div className="rounded-lg bg-purple-50 p-6 text-center">
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-purple-600" />
              <p className="text-sm font-medium">動画生成中… (30〜90秒)</p>
              <p className="mt-2 text-xs text-gray-500">
                ステータス: {videoStatus} / Job ID: {videoId.slice(0, 8)}…
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
                  className="flex-1 rounded bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-purple-700"
                >
                  <Download className="mr-1 inline h-4 w-4" />
                  ダウンロード
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  もう一度生成
                </button>
              </div>
            </div>
          ) : (
            // 入力フォーム
            <>
              {/* プロバイダ選択 */}
              <div>
                <label className="mb-1 block text-sm font-medium">モデル</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as ProviderId)}
                  className="w-full rounded border p-2"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} (¥{Math.round(p.pricePerSec * USD_TO_JPY)}〜/秒)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{currentProvider.description}</p>
              </div>

              {/* アスペクト比 */}
              <div>
                <label className="mb-1 block text-sm font-medium">フォーマット</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')}
                  className="w-full rounded border p-2"
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
                <label className="mb-1 block text-sm font-medium">尺</label>
                <div className="flex gap-2">
                  {currentProvider.allowedDurations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationSeconds(d)}
                      className={`flex-1 rounded border p-2 text-sm ${
                        validDuration === d
                          ? 'border-purple-600 bg-purple-50 font-medium text-purple-900'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {d}秒 ({formatJpy(currentProvider.pricePerSec * d)})
                    </button>
                  ))}
                </div>
              </div>

              {/* 音声 (Lite のみ) */}
              {currentProvider.supportsAudio && (
                <label className="flex items-center gap-2 rounded border p-3">
                  <input
                    type="checkbox"
                    checked={generateAudio}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                  />
                  <span className="text-sm">
                    日本語ナレーション + リップシンクを生成 (preview)
                  </span>
                </label>
              )}

              {/* プロンプト */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  動きの指示 (日本語)
                </label>
                <textarea
                  value={promptJa}
                  onChange={(e) => setPromptJa(e.target.value)}
                  placeholder="例: カメラがゆっくりズームアウトしながら、女性が右手で商品を持ち上げて笑顔でこちらを見る"
                  rows={4}
                  className="w-full rounded border p-2 text-sm"
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-gray-500">{promptJa.length} / 500</p>
              </div>

              {/* エラー */}
              {errorMessage && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* 送信 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !promptJa.trim()}
                className="w-full rounded bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 disabled:bg-gray-300"
              >
                {submitting ? '送信中…' : `動画を生成 (${formatJpy(costUsd)})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
