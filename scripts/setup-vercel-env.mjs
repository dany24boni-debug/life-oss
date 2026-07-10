// scripts/setup-vercel-env.mjs
//
// One-shot: legge .env.local e popola le env var del progetto Vercel
// con `vercel env add`. Idempotente — se una var esiste già la
// rimuove e ri-aggiunge col valore corrente.
//
// Usage:
//   node scripts/setup-vercel-env.mjs
//
// Pre-req: `vercel login` + `vercel` (link al progetto) già fatti
// così che la cartella .vercel/ esiste.
//
// Le 7 var "secret" vengono lette da .env.local (devi averlo).
// Le 2 var "domain-dependent" sono hardcoded sul dominio Vercel
// production stabile: se cambia, edita PRODUCTION_DOMAIN qui sotto.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Set to your own production domain (without protocol). Override via env:
//   PRODUCTION_DOMAIN=your-app.vercel.app node scripts/setup-vercel-env.mjs
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN ?? "YOUR_PROD_DOMAIN.vercel.app";

// Variabili da leggere dal .env.local (identico valore in Vercel).
const SECRET_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TOKEN_ENCRYPTION_KEY",
];

// Variabili con valore nuovo (dipendente dal dominio Vercel).
const DOMAIN_KEYS = {
  NEXT_PUBLIC_APP_URL: `https://${PRODUCTION_DOMAIN}`,
  GOOGLE_REDIRECT_URI: `https://${PRODUCTION_DOMAIN}/api/auth/google/callback`,
};

const ENVIRONMENTS = ["production", "preview", "development"];

// --- Parse .env.local ---
let envLocal;
try {
  envLocal = readFileSync(".env.local", "utf8");
} catch (e) {
  console.error("ERR: cannot read .env.local —", e.message);
  process.exit(1);
}

const parsed = {};
for (const line of envLocal.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let val = m[2];
  // strip optional surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  parsed[m[1]] = val;
}

// --- Helper: run vercel command ---
function runVercel(args, valueViaStdin) {
  const res = spawnSync("vercel", args, {
    input: valueViaStdin,
    encoding: "utf8",
    shell: true,
  });
  return { code: res.status, out: (res.stdout || "") + (res.stderr || "") };
}

// --- Helper: add an env var (rm first for idempotency) ---
function addEnvVar(name, value) {
  if (!value) {
    console.log(`✗ ${name}: empty value, skipping`);
    return false;
  }
  let ok = true;
  for (const env of ENVIRONMENTS) {
    // Try rm first (silently — fails if not exists, that's fine)
    runVercel(["env", "rm", name, env, "--yes"]);
    // Add new value
    const { code, out } = runVercel(["env", "add", name, env], value);
    if (code !== 0) {
      const trimmed = out.trim().split("\n").slice(-3).join(" | ");
      console.log(`✗ ${name}/${env}: code=${code} ${trimmed}`);
      ok = false;
    }
  }
  if (ok) console.log(`✓ ${name} (3 envs)`);
  return ok;
}

// --- Run ---
console.log(`Target domain: ${PRODUCTION_DOMAIN}\n`);

let added = 0, failed = 0;
for (const key of SECRET_KEYS) {
  const value = parsed[key];
  if (!value) {
    console.log(`✗ ${key}: NOT found in .env.local`);
    failed++;
    continue;
  }
  if (addEnvVar(key, value)) added++; else failed++;
}
for (const [key, value] of Object.entries(DOMAIN_KEYS)) {
  if (addEnvVar(key, value)) added++; else failed++;
}

console.log(`\nDone: ${added} added, ${failed} failed.`);
if (failed > 0) process.exit(1);
