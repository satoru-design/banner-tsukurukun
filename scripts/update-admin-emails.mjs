#!/usr/bin/env node
/**
 * Vercel API: ADMIN_EMAILS と ALLOWED_EMAILS の value のみ PATCH 更新する。
 * vercel-set-env.mjs は target/type を含めて送るため "already exists" エラーになる。
 * このスクリプトは value のみ送って既存 record を上書きする。
 *
 * 実行例:
 *   node scripts/update-admin-emails.mjs "str.kk.co@gmail.com,satoru@inkyouup.co.jp"
 */
import { readFileSync } from 'node:fs';

const VERCEL_API = 'https://api.vercel.com';
const newValue = process.argv[2];
if (!newValue) {
  console.error('Usage: node scripts/update-admin-emails.mjs "<comma-separated emails>"');
  process.exit(1);
}

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('VERCEL_TOKEN env required');
  process.exit(1);
}

const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
const projectId = project.projectId;
const teamId = project.orgId;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const listUrl = `${VERCEL_API}/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`;
const listRes = await fetch(listUrl, { headers });
const listJson = await listRes.json();

for (const key of ['ADMIN_EMAILS', 'ALLOWED_EMAILS']) {
  const existing = listJson.envs.filter((e) => e.key === key);
  if (existing.length === 0) {
    console.log(`SKIP ${key}: not found`);
    continue;
  }
  for (const env of existing) {
    const patchUrl = `${VERCEL_API}/v9/projects/${projectId}/env/${env.id}?teamId=${teamId}`;
    const r = await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ value: newValue }),
    });
    if (!r.ok) {
      console.error(`FAIL ${key} (${env.id}): ${r.status} ${await r.text()}`);
    } else {
      console.log(`OK ${key} (id=${env.id}) targets=${env.target.join(',')} → ${newValue}`);
    }
  }
}
