import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Phase A 着手時に退避したプロトタイプ時代の一時スクリプト群。
    // _archive/README.md のとおり本番ロジック非依存で、import している
    // コードは1件も無い。「元の場所に戻せば動く」状態で保持するのが目的
    // なので、CommonJS の require をそのまま残す。
    "_archive/**",
  ]),
]);

export default eslintConfig;
