// scripts/promote-to-owner.mjs <email>
//
// Promote an existing user to "owner": sets `profiles.is_owner = true`
// for the user whose `auth.users.email` matches the argument, plus
// seeds `private_modules_whitelist` with the `chameleon_os` slug
// (the only private module registered on the shared branch).
//
// Replaces the hardcoded-email trigger that was in migration 0007
// (removed by migration 0016). Idempotent: re-running is safe.
//
// Usage:
//   node --env-file=.env.local scripts/promote-to-owner.mjs you@example.com
//
// Pre-req: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_ACCESS_TOKEN in env
// (same vars used by scripts/run-migration.mjs).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !pat) {
  console.error("ERR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set");
  process.exit(1);
}

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("ERR: pass owner email as argv[2] (e.g. you@example.com)");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];

// Single-statement SQL using a CTE so the auth.users lookup +
// profile update + whitelist seed run atomically. If the email
// doesn't exist in auth.users, the CTE returns 0 rows and the
// downstream statements affect 0 rows — no error, just a no-op
// (the script logs a warning).
//
// SQL string is parameter-free: we interpolate the email as a
// quoted literal. The Management API's /database/query endpoint
// doesn't support bind parameters, but we lowercase + escape
// single-quotes defensively.
//
// Unicode NFC normalize: emails copy-pasted da iOS share sheet,
// password manager o invio via WhatsApp possono arrivare in NFD
// (decomposed) — accenti rappresentati come "e + combining acute"
// invece di "é" precomposto. auth.users.email è storicizzato in
// NFC dal flow di signup di Supabase, quindi senza normalize il
// lookup `lower(email) = lower('...')` non matcha. Closes ECC S2
// Sec-M3.
const safeEmail = email.normalize("NFC").toLowerCase().replace(/'/g, "''");
const sql = `
with target as (
  select id from auth.users where lower(email) = lower('${safeEmail}') limit 1
), upd as (
  update public.profiles
    set is_owner = true
    where id = (select id from target)
    returning id
), seed as (
  -- Shared-branch variant: seed ONLY chameleon_os, the single
  -- private module registered on this branch.
  insert into public.private_modules_whitelist (user_id, module_slug)
    select id, slug
    from (select id from target) t, unnest(array['chameleon_os']) as slug
    on conflict (user_id, module_slug) do nothing
    returning user_id
)
select
  (select count(*) from target) as user_found,
  (select count(*) from upd) as profile_updated,
  (select count(*) from seed) as whitelist_seeded;
`;

console.log(`Promoting ${email} to owner on project ref=${ref} ...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

console.log("HTTP:", res.status);
const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error("Failed:", JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));

// body shape (per Supabase Management API): array with one row
// like { user_found, profile_updated, whitelist_seeded }.
const row = Array.isArray(body) ? body[0] : null;
if (row && Number(row.user_found) === 0) {
  console.warn(
    `\n⚠️  No user found with email '${email}'. Did you sign up first?`,
  );
  console.warn("    The promotion did nothing — re-run after the user signs up.");
  process.exit(1);
}

console.log(`\n✓ ${email} is now an owner.`);
console.log(
  `  is_owner=true on profiles, private_modules_whitelist seeded with chameleon_os.`,
);
