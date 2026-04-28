'use client';

/**
 * Phase A.12 Task 13: Stripe Checkout の success_url / cancel_url から戻った時のトースト表示。
 *
 * - ?stripe=success → 「アップグレードしました」
 * - ?stripe=canceled → 「キャンセルしました」
 *
 * 表示後は router.replace で /account へ URL を戻す（クエリ除去）。
 *
 * Toast コンポーネント採用検討:
 * - src/components/ui/Toast.tsx は emerald 固定・CheckCircle アイコン固定のため
 *   cancel 時（中断）に使うと意味が通じにくい。
 * - window.alert はブロッキングだが、Stripe return は一度のみ発火するため許容。
 *   後でノン・ブロッキング Toast に差し替えやすいよう関数に分離している。
 */
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function showStripeAlert(stripe: string) {
  if (stripe === 'success') {
    window.alert('プランをアップグレードしました!\n反映に数秒かかる場合があります。');
  } else if (stripe === 'canceled') {
    window.alert('キャンセルしました');
  }
}

export const AccountStripeToast = () => {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const stripe = params.get('stripe');
    if (!stripe) return;
    showStripeAlert(stripe);
    router.replace('/account');
  }, [params, router]);

  return null;
};
