// scripts/admin-magic-link.mjs
//
// Bypass: genera un magic link per la tua email via Supabase Admin API
// (no SMTP, no rate limit). Stampa il link nel terminale —
// copialo e aprilo su iPhone Safari.
//
// Side effect: aggiorna `uri_allow_list` rimuovendo eventuali entry
// "nude" (production URL senza path /auth/callback) che causano
// Supabase a strippare /auth/callback dal redirect_to, rompendo il
// code-exchange.
//
// Usage:
//   node scripts/admin-magic-link.mjs <email>
//   ADMIN_EMAIL=you@example.com node scripts/admin-magic-link.mjs
//
// Email argument is required (or settable via ADMIN_EMAIL env var) —
// post-S4 scrub the script no longer hardcodes a default owner email.

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !pat || !serviceKey) {
  console.error("missing env (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_ACCESS_TOKEN + SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const ref = new URL(supaUrl).hostname.split(".")[0];
const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email || !email.includes("@")) {
  console.error("ERR: pass an email as argv[2] or set ADMIN_EMAIL env var");
  console.error("Usage: node scripts/admin-magic-link.mjs you@example.com");
  process.exit(1);
}
// Set PROD to your own production URL (e.g. your Vercel domain).
// Used to keep the Supabase auth allowlist consistent across deploys.
const PROD = process.env.PROD_URL ?? "https://YOUR_PROD_DOMAIN_HERE";

// 1) Update allowlist — keep wildcard, remove naked URL
const newAllowList = `http://localhost:3000/auth/callback,http://localhost:3000,${PROD}/**`;
const patchRes = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uri_allow_list: newAllowList }),
  },
);
console.log(`Step 1: PATCH allowlist → ${patchRes.status}`);
if (patchRes.status !== 200) {
  console.error("allowlist update failed:", await patchRes.text());
  process.exit(1);
}

// 2) Generate magic link via admin endpoint (bypass SMTP)
const genRes = await fetch(`${supaUrl}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "magiclink",
    email,
    redirect_to: `${PROD}/auth/callback`,
  }),
});

console.log(`Step 2: generate_link → ${genRes.status}`);
const j = await genRes.json();
if (!j.action_link) {
  console.error("link generation failed:", JSON.stringify(j, null, 2));
  process.exit(1);
}

console.log("\n========================================");
console.log("MAGIC LINK (one-time use):");
console.log("========================================");
console.log(j.action_link);
console.log("========================================");

// Generate a QR code URL so the link can travel PC → iPhone
// without going through an app that does preview prefetching
// (Telegram / iMessage / WhatsApp / Slack / Mail consume the
// token via their link-preview bot before the user clicks).
//
// Open this QR URL on your PC browser, scan with iPhone Camera
// app → Safari opens with the link directly → no app inbetween,
// token survives.
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(j.action_link)}`;
console.log("\nQR CODE — apri questo URL nel browser del PC, scansiona col");
console.log("Camera dell'iPhone (si apre direttamente in Safari, NO preview prefetch):");
console.log(qrUrl);
console.log("\nAlternativa: scrivi il link a mano sull'iPhone (no shortcut via app intermedie).");
console.log("\nAtterri LOGGATO nella dashboard se il flow va a buon fine.");
