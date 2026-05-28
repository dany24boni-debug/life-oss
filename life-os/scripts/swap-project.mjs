import { readFileSync, writeFileSync } from "node:fs";

const pat = process.env.SUPABASE_ACCESS_TOKEN;
const oldRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Find the new project
console.log("[1/8] Listing projects...");
const list = await api("/v1/projects");
if (!list.ok) { console.error("FAILED listing projects:", list); process.exit(1); }
const newProj = list.body.find((p) => p.id !== oldRef);
if (!newProj) {
  console.error("No new project found. Existing:", list.body.map((p) => p.id));
  process.exit(1);
}
console.log(`     Found new project: ${newProj.id} (${newProj.name}, status=${newProj.status})`);

// 2. Wait until ACTIVE_HEALTHY (max 120s)
console.log("[2/8] Waiting for ACTIVE_HEALTHY...");
let status = newProj.status;
const start = Date.now();
while (status !== "ACTIVE_HEALTHY") {
  if (Date.now() - start > 120000) {
    console.error(`     Timeout. Last status: ${status}`);
    process.exit(1);
  }
  await wait(5000);
  const check = await api(`/v1/projects/${newProj.id}`);
  status = check.body.status;
  console.log(`     ...status=${status}`);
}
console.log("     Project is healthy.");

// 3. Get API keys
console.log("[3/8] Fetching API keys...");
const keys = await api(`/v1/projects/${newProj.id}/api-keys?reveal=true`);
if (!keys.ok) { console.error("FAILED fetching keys:", keys); process.exit(1); }
const anon = keys.body.find((k) => k.name === "anon")?.api_key;
const service = keys.body.find((k) => k.name === "service_role")?.api_key;
if (!anon || !service) { console.error("Missing keys:", keys.body.map((k) => k.name)); process.exit(1); }
console.log("     anon + service_role retrieved.");

const newUrl = `https://${newProj.id}.supabase.co`;

// 4. Update .env.local
console.log("[4/8] Updating .env.local...");
let env = readFileSync(".env.local", "utf8");
env = env.replace(/^NEXT_PUBLIC_SUPABASE_URL=.*$/m, `NEXT_PUBLIC_SUPABASE_URL=${newUrl}`);
env = env.replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
env = env.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/m, `SUPABASE_SERVICE_ROLE_KEY=${service}`);
writeFileSync(".env.local", env, "utf8");
console.log(`     URL: ${newUrl}`);

// 5. Run migration 0001 on new project
console.log("[5/8] Running migration 0001 on new project...");
const sql0001 = readFileSync("supabase/migrations/0001_init.sql", "utf8");
const r1 = await api(`/v1/projects/${newProj.id}/database/query`, {
  method: "POST",
  body: JSON.stringify({ query: sql0001 }),
});
console.log(`     0001 -> HTTP ${r1.status}`);
if (!r1.ok) { console.error("     ERROR:", r1.body); process.exit(1); }

// 6. Run migration 0002 (trigger fix - belt-and-suspenders, fresh project should not need it but harmless)
console.log("[6/8] Running migration 0002 (trigger hardening)...");
const sql0002 = readFileSync("supabase/migrations/0002_fix_profile_trigger.sql", "utf8");
const r2 = await api(`/v1/projects/${newProj.id}/database/query`, {
  method: "POST",
  body: JSON.stringify({ query: sql0002 }),
});
console.log(`     0002 -> HTTP ${r2.status}`);
if (!r2.ok) { console.error("     ERROR:", r2.body); process.exit(1); }

// 7. Configure auth: site_url + redirect URLs
console.log("[7/8] Configuring auth (site_url + redirect URLs)...");
const authPatch = await api(`/v1/projects/${newProj.id}/config/auth`, {
  method: "PATCH",
  body: JSON.stringify({
    site_url: "http://localhost:3000",
    uri_allow_list: "http://localhost:3000/auth/callback,http://localhost:3000",
  }),
});
console.log(`     auth config -> HTTP ${authPatch.status}`);
if (!authPatch.ok) { console.error("     ERROR:", authPatch.body); /* non-fatal, continue */ }

// 8. Diag: create user with admin API to verify trigger pipeline
console.log("[8/8] Diag: creating test user via admin API...");
const testEmail = `diag-${Date.now()}@example.com`;
const adminUrl = `${newUrl}/auth/v1/admin/users`;
const cu = await fetch(adminUrl, {
  method: "POST",
  headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: testEmail, email_confirm: true }),
});
const cuText = await cu.text();
console.log(`     create user -> HTTP ${cu.status}`);
if (!cu.ok) { console.error("     ERROR:", cuText); process.exit(1); }
const created = JSON.parse(cuText);
const id = created.id;
const pRes = await fetch(`${newUrl}/rest/v1/profiles?id=eq.${id}&select=*`, {
  headers: { apikey: service, Authorization: `Bearer ${service}` },
});
console.log("     profile row:", await pRes.text());
const del = await fetch(`${adminUrl}/${id}`, {
  method: "DELETE",
  headers: { apikey: service, Authorization: `Bearer ${service}` },
});
console.log(`     cleanup -> HTTP ${del.status}`);

console.log("\n[DONE] New project ready. Restart dev server and try magic link.");
console.log(`       New ref: ${newProj.id}`);
console.log(`       New URL: ${newUrl}`);