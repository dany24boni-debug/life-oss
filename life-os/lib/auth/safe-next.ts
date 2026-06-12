// Allowlisted same-origin paths the magic-link auth flow may forward to.
// Anything else (including protocol-relative `//foo` and parent-traversal
// `..`) falls back to /dashboard so the auth flow can't be weaponised for
// in-domain phishing redirects via a crafted ?next= query.
//
// Shared by app/auth/callback/route.ts (PKCE flow) and
// app/auth/confirm/page.tsx (implicit flow) — both reachable independently,
// so both sanitise their own `next` rather than trusting an upstream one.
export function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  if (raw.includes("://")) return "/dashboard";
  if (raw.includes("..")) return "/dashboard";
  return raw;
}
