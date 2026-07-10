// Usage: node --env-file=.env.local scripts/verify-schema.mjs
// Lists all public tables and their columns, plus seeded modules_registry rows.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(url).hostname.split(".")[0];

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

const tables = await q(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name;
`);
console.log("\n=== public tables ===");
for (const r of tables) console.log("  -", r.table_name);

const expected = [
  "profiles",
  "modules_registry",
  "private_modules_whitelist",
  "user_modules",
  "user_states",
  "user_long_term_goals",
  "user_monthly_targets",
  "daily_tasks",
  "user_streaks",
  "voglia_detections",
  "mood_entries",
  "daily_calls",
];
const got = new Set(tables.map((r) => r.table_name));
const missing = expected.filter((t) => !got.has(t));
console.log("\n=== expected coverage ===");
console.log(missing.length === 0 ? "  OK: all 12 tables present" : "  MISSING: " + missing.join(", "));

const rls = await q(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
`);
console.log("\n=== RLS status ===");
for (const r of rls) console.log(`  ${r.rls_enabled ? "ON " : "OFF"}  ${r.table_name}`);

const seeds = await q(`
  select slug, name, is_default, is_private from public.modules_registry order by slug;
`);
console.log("\n=== modules_registry seed ===");
for (const r of seeds) {
  console.log(`  ${r.slug.padEnd(14)} default=${r.is_default ? "Y" : "N"} private=${r.is_private ? "Y" : "N"}  (${r.name})`);
}
