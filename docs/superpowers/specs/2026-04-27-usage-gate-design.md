# Phase A.11.3: 機能 gate + 使用回数表示 + クレジット可視化 設計書

**作成日:** 2026-04-27
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.11.0-A.11.2（DB schema + Header + /account）本番動作確認済み
**配置場所:** `docs/superpowers/specs/2026-04-27-usage-gate-design.md`

---

## 1. 背景・目的

Phase A.11.0 で User テーブルに `usageCount` / `usageResetAt` を追加し、`/api/ironclad-generate` 成功時にカウントアップする仕組みを実装した。Phase A.11.2 で `/account` ページに使用状況プログレスバーを表示した。しかし以下が未実装：

1. **ヘッダーに使用状況が見えない** → ユーザーは生成のたびに /account に行かないと残数が分からない
2. **上限到達時の gate がない** → free プラン (3回/月) を超えても OpenAI 課金が発生し得る（コストリスク）
3. **生成後の即時反映がない** → JWT キャッシュのため /account 以外ではカウンタが古いまま

本フェーズで上記 3 点を解決し、課金可能な料金体系の前提となる **使用量制御の信頼性** を確立する。

## 2. スコープ

### 本フェーズで実装
- ヘッダーへの使用状況表示（`12/100 [12%]` 形式）
- クライアント側 pre-check（生成前に上限到達チェック）
- API 側 gate（保険として 429 Too Many Requests）
- 上限到達時の UpgradeModal 流用
- 生成成功後の `useSession().update()` による即時反映

### スコープ外（後続フェーズ）
- プラン変更による limit 動的変更 → Phase A.12（Stripe）
- 過去履歴ベース統計（先月使用量グラフ等）→ Phase A.11.5
- メータード課金（Pro 超過分 ¥80/回）→ Phase A.14
- 月初 cron リセット → 既存 lazy reset で十分（実装不要）

---

## 3. アーキテクチャ全体像

```
[ヘッダー UI]                    [API 側 gate]                  [/account]
PlanPill 隣に            →       /api/ironclad-generate に       →   既存プログレスバー
新規 UsageDisplay 配置             冒頭で上限チェック追加              既存実装で同期
"12/100 [12%]" 表示                 ↓ 上限超過なら 429
                                  ↓ 成功なら incrementUsage 後に
                                    新 count をレスポンスに含める

[生成クライアント]
- 生成前: usageCount >= usageLimit なら UpgradeModal 表示（API 呼ばない）
- 成功時: useSession().update({ usageCount }) で session 更新
- 429 受信: UpgradeModal 表示（API gate からの応答に対応）
```

## 4. データフロー

```
1. ユーザーが Step 3「生成」ボタン押下
2. クライアント pre-check: usageCount >= usageLimit
   YES → UpgradeModal 表示、終了
   NO → API 呼び出し続行
3. API 側 gate（保険）: 同条件で 429 返却
4. OpenAI 生成成功
5. incrementUsage() で DB +1
6. レスポンスに新 usageCount を含めて返却
7. クライアント: update({ usageCount }) で session 更新
8. Header の useSession() が再評価 → 新数値表示
9. /account へ遷移時もリアルタイム値を反映
```

---

## 5. コンポーネント設計

### 5.1 新規作成

#### `src/components/layout/UsageDisplay.tsx` (Client Component)

ヘッダー右側でプラン Pill の隣に表示する使用状況コンポーネント。

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';

export function UsageDisplay() {
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);

  // 未ログイン: 表示なし
  if (!user.userId) return null;

  // admin / 無制限: 表示なし（Pill だけで十分）
  if (!Number.isFinite(user.usageLimit)) return null;

  const ratio = user.usageCount / user.usageLimit;
  const percent = Math.round(ratio * 100);

  // 80%超で amber, 100%で red
  const colorClass =
    ratio >= 1
      ? 'text-red-400'
      : ratio >= 0.8
        ? 'text-amber-400'
        : 'text-slate-300';

  return (
    <span className={`text-xs ${colorClass} tabular-nums`}>
      {user.usageCount}/{user.usageLimit} [{percent}%]
    </span>
  );
}
```

**設計判断**:
- `PlanPill.tsx` には統合せず独立コンポーネント化（責務分離、admin 時の表示制御を独立）
- `tabular-nums` で数字幅を揃え、カウントアップ時の見た目ガタつき防止
- マイページのプログレスバー色と同じ閾値（80% / 100%）で色変化、視覚的整合

#### `src/components/layout/UsageLimitModal.tsx` (Client Component)

上限到達時に表示するモーダル。`/account/UpgradeModal.tsx` と機能は近いが、ヘッダー導線で再利用する想定で `layout/` に配置。

```tsx
'use client';

import { useEffect } from 'react';

interface UsageLimitModalProps {
  open: boolean;
  onClose: () => void;
  usageCount: number;
  usageLimit: number;
  plan: string;
}

export function UsageLimitModal({ open, onClose, usageCount, usageLimit, plan }: UsageLimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[勝ちバナー作る君] アップグレード相談（${plan} → 上位プラン）`;
  const body = `現在のプラン: ${plan}\n今月使用: ${usageCount}/${usageLimit}\n\nアップグレードを希望します。`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-limit-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="usage-limit-title" className="text-lg font-bold mb-3">
          今月の生成回数上限に到達しました
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          現在の {plan} プランの月間上限（{usageLimit} 回）を使い切りました。
          来月 1 日にリセットされます。それまでに追加で生成したい場合は、
          <a href={mailtoHref} className="text-teal-400 underline mx-1 hover:text-teal-300">
            アップグレードのご相談
          </a>
          をお送りください（Phase A.12 で Stripe Checkout に切替予定）。
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 変更

#### `src/components/layout/Header.tsx`

`PlanPill` の隣に `UsageDisplay` を配置：

```tsx
<div className="flex items-center gap-3 flex-shrink-0">
  <div className="flex items-center gap-2">
    <PlanPill plan={user.plan} />
    <UsageDisplay />
  </div>
  <UserMenu user={user} />
</div>
```

#### `src/app/api/ironclad-generate/route.ts`

冒頭に上限チェック、成功時に新 `usageCount` をレスポンスに含める：

```ts
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { incrementUsage } from '@/lib/plans/usage';
import { getPrisma } from '@/lib/prisma';

// ... 既存 import ...

export async function POST(req: Request) {
  try {
    // Phase A.11.3: 上限チェック（fail-fast でコスト保護）
    const currentUser = await getCurrentUser();
    if (currentUser.userId && Number.isFinite(currentUser.usageLimit)) {
      // DB から fresh な count を取得（JWT は古い可能性）
      const prisma = getPrisma();
      const dbUser = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { usageCount: true, usageResetAt: true },
      });
      if (dbUser) {
        // lazy reset 考慮: usageResetAt 過ぎていれば 0 として扱う
        const effectiveCount =
          dbUser.usageResetAt && new Date() >= dbUser.usageResetAt
            ? 0
            : dbUser.usageCount;
        if (effectiveCount >= currentUser.usageLimit) {
          return NextResponse.json(
            {
              error: '今月の生成回数上限に到達しました',
              usageCount: effectiveCount,
              usageLimit: currentUser.usageLimit,
              limitReached: true,
            },
            { status: 429 },
          );
        }
      }
    }

    // ... 既存の生成ロジック ...

    // Phase A.11.0: 生成成功時に使用回数カウントアップ
    let newUsageCount: number | undefined;
    if (currentUser.userId) {
      try {
        await incrementUsage(currentUser.userId);
        // Phase A.11.3: クライアント update() 用に新 count を取得
        const prisma = getPrisma();
        const updated = await prisma.user.findUnique({
          where: { id: currentUser.userId },
          select: { usageCount: true },
        });
        newUsageCount = updated?.usageCount;
      } catch (err) {
        console.error('incrementUsage failed:', err);
      }
    }

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
      usageCount: newUsageCount,  // Phase A.11.3: クライアント session update 用
    });
  } catch (error: unknown) {
    // ... 既存のエラー処理 ...
  }
}
```

**設計判断**:
- 上限チェックは DB から fresh な値を取得する（JWT は最大 1 セッション分古い）
- lazy reset を考慮し、`usageResetAt` 過ぎていれば 0 扱い（生成を許可）
- 生成成功後の DB 再取得 1 件追加（軽量、`select: { usageCount }` のみ）
- `usageCount` レスポンス追加でクライアント update() の引数に直接使える

#### `src/components/ironclad/IroncladGenerateScreen.tsx`

生成前 pre-check + 成功時 update + 429 ハンドル：

```tsx
'use client';

// ... 既存 import ...
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { UsageLimitModal } from '@/components/layout/UsageLimitModal';

export function IroncladGenerateScreen({ baseMaterials, sizes, onBack }: Props) {
  const { data: session, update: updateSession } = useSession();
  const user = sessionToCurrentUser(session);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);

  // ... 既存 state ...

  const generateOne = async (size: IroncladSize): Promise<void> => {
    // Phase A.11.3: 生成前 pre-check
    if (
      user.userId &&
      Number.isFinite(user.usageLimit) &&
      user.usageCount >= user.usageLimit
    ) {
      setUsageLimitModalOpen(true);
      return;
    }

    updateResult(size, { status: 'generating', errorMessage: undefined });
    const materials: IroncladMaterials = { ...baseMaterials, size };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320 * 1000);

    try {
      const res = await fetch('/api/ironclad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials),
        signal: controller.signal,
      });

      // Phase A.11.3: 429 = 上限到達（保険として API 側 gate）
      if (res.status === 429) {
        setUsageLimitModalOpen(true);
        updateResult(size, { status: 'idle' });
        return;
      }

      if (!res.ok) {
        // ... 既存のエラー処理 ...
      }

      const json = await res.json();
      updateResult(size, {
        status: 'success',
        imageUrl: json.imageUrl,
        promptPreview: json.promptPreview,
        metadata: json.metadata,
      });

      // Phase A.11.3: ヘッダーカウンタ即時反映
      if (typeof json.usageCount === 'number') {
        await updateSession({ usageCount: json.usageCount });
      }
    } catch (e) {
      // ... 既存のエラー処理 ...
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // ... 既存 generateAll / handleDownload など ...

  return (
    <>
      {/* ... 既存 JSX ... */}

      <UsageLimitModal
        open={usageLimitModalOpen}
        onClose={() => setUsageLimitModalOpen(false)}
        usageCount={user.usageCount}
        usageLimit={user.usageLimit}
        plan={user.plan}
      />
    </>
  );
}
```

**設計判断**:
- pre-check で API 呼び出し前に弾く → OpenAI 課金回避
- 429 受信時も同じ Modal を開く（API gate からの応答にも対応）
- `updateSession({ usageCount })` は client-side merge のみ。NextAuth の trigger='update' は呼ばれず、軽量

---

## 6. NextAuth update() の動作仕様

### 6.1 NextAuth v5 の `update()` メソッド

`useSession()` から返される `update` 関数は、引数を **session オブジェクトの partial merge** として扱う：

```ts
const { update } = useSession();
await update({ usageCount: 87 });
// → session.user.usageCount が 87 に更新（その場で）
// → useSession() の data が再評価され全 subscriber が再レンダリング
```

**注意**: NextAuth の `jwt` callback の `trigger='update'` は、サーバ側の JWT を再発行するために呼ばれる。クライアント側の merge のみで完結する場合（今回の usageCount 更新はこのケース）、サーバを叩かずに済む。

### 6.2 タブ間整合の限界

別タブで開いている画面の Header カウンタは更新されない（各タブが独立した useSession インスタンスを持つため）。これは仕様として許容：

- 別タブの古い表示は次の Server fetch（タブ切替時の re-mount）で更新
- 上限近くで複数タブから生成しても API gate で弾かれるので二重課金は起きない

---

## 7. 検証戦略

### 7.1 Phase A.11.3 検証チェックリスト

- [ ] ヘッダーに `12/100 [12%]` 形式で使用状況が表示される
- [ ] admin プランでは `UsageDisplay` 非表示
- [ ] 80% 超で amber、100% で red の文字色変化
- [ ] バナー生成成功後、ヘッダーカウンタが 1 増える（リロードなしで）
- [ ] 上限到達状態で生成ボタン押下 → UpgradeModal 表示、API は呼ばれない（DevTools Network で確認）
- [ ] DevTools で usageCount を 100 に書換え → 生成ボタン押下 → API 側 gate で 429 返却 → Modal 表示
- [ ] 生成成功後 /account に遷移 → プログレスバーが新数値で表示される
- [ ] usageResetAt を昨日に書換えて生成 → リセットされて usageCount=1（lazy reset 動作）
- [ ] スマホ幅（375px）で `12/100 [12%]` が崩れず表示
- [ ] TypeScript ビルド `npm run build` がエラーなく通る

### 7.2 リスクとロールバック

| リスク | 対策 |
|---|---|
| `update()` 呼出失敗で session 不整合 | catch で握りつぶし。次回 /account 遷移時に DB から修正される |
| API gate が DB クエリ追加で遅くなる | `select: { usageCount, usageResetAt }` のみ取得 = 数十 ms 増。pre-check により大半のリクエストは早期 return |
| pre-check と API gate の二重判定で実装複雑化 | DRY のため pre-check ロジックを `isUsageLimitReached(user)` ヘルパーに切り出し |
| 上限到達中も DevTools 改ざんで生成可能 | API gate で防御済み。改ざんは技術的素養必要、自社利用想定では問題なし |

---

## 8. 完了の定義

以下が満たされたら本 spec は完了：

1. ヘッダーで使用状況が `12/100 [12%]` 形式で常時表示される（admin 除く）
2. 上限到達時、フロント・API 両方で生成が gate される
3. 生成成功後、ヘッダーと /account のカウンタが即時更新される
4. Phase A.12（Stripe）着手時に追加実装不要（plan 変更で usageLimit 自動連動）
5. `npm run build` エラーなく通り、本番 Vercel で動作確認済み

---

## 付録 A: 議論経緯（Q&A サマリ）

| 議題 | 結論 |
|---|---|
| ヘッダー数字表示形式 | A: `12/100 [12%]`（残数は計算で導出可、admin は非表示） |
| 上限到達時の挙動 | b + c: モーダル表示 + API 側 429 gate（保険） |
| 即時反映方法 | a: `useSession().update()`（client-side merge、ネットワーク往復なし） |
| `UsageDisplay` の配置 | `PlanPill` 隣の独立コンポーネント（責務分離） |
| `UsageLimitModal` の配置 | `src/components/layout/`（ヘッダー導線で再利用想定） |
| API gate の DB クエリ | fresh な値を取得（JWT 古い前提）、lazy reset 考慮 |
