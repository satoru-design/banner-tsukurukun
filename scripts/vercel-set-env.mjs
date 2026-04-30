/**
 * Vercel API で project の env variable を作成または更新する。
 *
 * 使い方:
 *   node scripts/vercel-set-env.mjs <KEY> <VALUE> [target...] [--sensitive]
 *
 * 例:
 *   node scripts/vercel-set-env.mjs MY_TOKEN xxx production --sensitive
 *
 * 必要 env:
 *   - VERCEL_TOKEN: Vercel Personal Access Token
 *
 * .vercel/project.json から projectId と teamId（orgId）を読む。
 */
import { readFileSync } from 'node:fs';

const VERCEL_API = 'https://api.vercel.com';

const args = process.argv.slice(2);
const sensitive = args.includes('--sensitive');
const positional = args.filter((a) => a !== '--sensitive');
const [key, value, ...rest] = positional;
if (!key || value === undefined) {
  console.error('Usage: node scripts/vercel-set-env.mjs <KEY> <VALUE> [target...] [--sensitive]');
  process.exit(1);
}

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('VERCEL_TOKEN env var is required');
  process.exit(1);
}

// 適用 environment（デフォルトは production / preview / development の 3 つ）
const targets = rest.length > 0 ? rest : ['production', 'preview', 'development'];
const envType = sensitive ? 'sensitive' : 'plain';

const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
const projectId = project.projectId;
const teamId = project.orgId;

const baseHeaders = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

// 既存 env variable を検索
const listUrl = `${VERCEL_API}/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`;
const listRes = await fetch(listUrl, { headers: baseHeaders });
if (!listRes.ok) {
  console.error('Failed to list env vars:', listRes.status, await listRes.text());
  process.exit(1);
}
const listJson = await listRes.json();
const existing = listJson.envs.find((e) => e.key === key);

if (existing) {
  // PATCH 既存
  const patchUrl = `${VERCEL_API}/v9/projects/${projectId}/env/${existing.id}?teamId=${teamId}`;
  const patchBody = { value, target: targets, type: envType };
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: baseHeaders,
    body: JSON.stringify(patchBody),
  });
  if (!patchRes.ok) {
    console.error('PATCH failed:', patchRes.status, await patchRes.text());
    process.exit(1);
  }
  console.log(`Updated ${key} (id=${existing.id}) targets=${targets.join(',')} type=${envType}`);
} else {
  // POST 新規
  const postUrl = `${VERCEL_API}/v10/projects/${projectId}/env?teamId=${teamId}`;
  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ key, value, type: envType, target: targets }),
  });
  if (!postRes.ok) {
    console.error('POST failed:', postRes.status, await postRes.text());
    process.exit(1);
  }
  console.log(`Created ${key} targets=${targets.join(',')} type=${envType}`);
}
