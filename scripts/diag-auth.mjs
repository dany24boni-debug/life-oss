const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const testEmail = `diag-${Date.now()}@example.com`;
console.log("[diag] Project URL:", url);
console.log("[diag] Creating test user via admin API:", testEmail);

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

const text = await res.text();
console.log("[diag] HTTP status:", res.status);
console.log("[diag] Response body:");
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}

// If user was created, fetch profile row and clean up
if (res.ok) {
  const created = JSON.parse(text);
  const id = created.id ?? created.user?.id;
  console.log("[diag] Created user id:", id);

  // Look up profile via PostgREST
  const pgrUrl = `${url}/rest/v1/profiles?id=eq.${id}&select=id,email,display_name,onboarding_completed`;
  const pRes = await fetch(pgrUrl, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log("[diag] profile lookup HTTP:", pRes.status);
  console.log("[diag] profile rows:", await pRes.text());

  // Delete the test user (cascades to profile)
  const delRes = await fetch(`${adminUrl}/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log("[diag] cleanup HTTP:", delRes.status);
}