import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pat = process.env.SUPABASE_ACCESS_TOKEN;

if (!url || !serviceKey || !pat) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

// Extract project ref from https://<ref>.supabase.co
const ref = new URL(url).hostname.split(".")[0];
console.log("[fix] Project ref:", ref);

const sqlFile = "supabase/migrations/0003_drop_legacy_email_check.sql";
const sql = readFileSync(sqlFile, "utf8");
console.log(`[fix] Running ${sqlFile} (${sql.length} bytes) via Management API...`);

const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const mgmtText = await mgmtRes.text();
console.log("[fix] HTTP status:", mgmtRes.status);
console.log("[fix] Response body:");
try {
  console.log(JSON.stringify(JSON.parse(mgmtText), null, 2));
} catch {
  console.log(mgmtText);
}

if (!mgmtRes.ok) {
  console.error("[fix] FAILED: management API error, aborting diag.");
  process.exit(2);
}

// Now verify by trying to create a user
console.log("\n[diag] Creating test user (random unrelated email) to verify trigger removed...");
const testEmail = `diag-${Date.now()}@example.com`;
const adminUrl = `${url}/auth/v1/admin/users`;
const res = await fetch(adminUrl, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: testEmail, email_confirm: true }),
});

const body = await res.text();
console.log("[diag] HTTP:", res.status);
try { console.log(JSON.stringify(JSON.parse(body), null, 2)); }
catch { console.log(body); }

if (res.ok) {
  const created = JSON.parse(body);
  const id = created.id ?? created.user?.id;
  // Check the profile row was created
  const pRes = await fetch(`${url}/rest/v1/profiles?id=eq.${id}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log("[diag] profile row(s):", await pRes.text());
  // Cleanup
  const delRes = await fetch(`${adminUrl}/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log("[diag] cleanup HTTP:", delRes.status);
  console.log("\n[OK] All green. Magic link flow should work now.");
}