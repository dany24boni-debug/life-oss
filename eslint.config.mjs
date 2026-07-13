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
    // Edge Functions Supabase: mondo Deno (import jsr:, global Deno) —
    // le linta/valida la piattaforma al deploy, non la toolchain Node.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
