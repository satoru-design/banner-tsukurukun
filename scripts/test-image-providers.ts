// 実行: npx tsx scripts/test-image-providers.ts
import 'dotenv/config';
import { listProviders } from '../src/lib/image-providers';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROMPT =
  'A clean minimalist product hero photo, softly lit studio environment, empty negative space on the left half, high-end advertising photography, 4k';

async function main() {
  const outDir = path.join(
    __dirname,
    '../docs/baselines/2026-04-21-provider-smoke',
  );
  fs.mkdirSync(outDir, { recursive: true });

  for (const p of listProviders()) {
    console.log(`\n=== Testing provider: ${p.displayName} (${p.id}) ===`);
    try {
      const result = await p.generate({
        prompt: TEST_PROMPT,
        aspectRatio: '1:1',
        seed: 42,
      });
      const b64 = result.base64.replace(/^data:image\/\w+;base64,/, '');
      const outFile = path.join(outDir, `${p.id}.png`);
      fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
      console.log(`  OK Saved ${outFile}`);
      console.log(
        `  metadata: ${JSON.stringify(result.providerMetadata)}`,
      );
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }
}

main();
