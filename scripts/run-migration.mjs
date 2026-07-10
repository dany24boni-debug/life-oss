// Usage: node --env-file=.env.local scripts/run-migration.mjs <migration-file-relative-to-repo>
// Example: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0005_phase2_schema.sql
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("ERR: pass migration path as argv[2]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !pat) {
  console.error("ERR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const sql = readFileSync(file, "utf8");

console.log(`Applying ${file} to project ref=${ref} ...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});

console.log("HTTP:", res.status);
const text = await res.text();
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}

if (!res.ok) process.exit(1);
