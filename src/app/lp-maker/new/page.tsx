/**
 * LP Maker Pro 2.0 — Brief 入力ウィザード（Client Component）。
 *
 * D2-T3: STEP1 (商材) → STEP2 (素材) → STEP3 (確認 → 生成)。
 * 送信先 `/api/lp/generate` は D2-T4 で実装予定。
 */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefWizardStep1 } from '@/components/lp-maker/BriefWizardStep1';
import { BriefWizardStep2 } from '@/components/lp-maker/BriefWizardStep2';
import { BriefWizardStep3 } from '@/components/lp-maker/BriefWizardStep3';
import type { LpBrief } from '@/lib/lp/types';

export default function NewLpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [brief, setBrief] = useState<Partial<LpBrief>>({
    productName: '',
    lpUrl: '',
    target: '',
    offer: '',
    materialAssetIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/lp/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { landingPageId } = await res.json();
      router.push(`/lp-maker/${landingPageId}/edit`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">新規 LP を作る</h1>
        <p className="text-slate-400 text-sm mb-6">STEP {step} / 3</p>

        {step === 1 && (
          <BriefWizardStep1
            brief={brief}
            onChange={setBrief}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <BriefWizardStep2
            brief={brief}
            onChange={setBrief}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <BriefWizardStep3
            brief={brief}
            submitting={submitting}
            error={error}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </main>
  );
}
