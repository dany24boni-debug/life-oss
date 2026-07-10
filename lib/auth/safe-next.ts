// Allowlisted same-origin paths the magic-link auth flow may forward to.
// Anything else (including protocol-relative `//foo` and parent-traversal
// `..`) falls back to the app home so the auth flow can't be weaponised
// for in-domain phishing redirects via a crafted ?next= query.
//
// Shared by app/auth/callback/route.ts (PKCE flow) and
// app/auth/confirm/page.tsx (implicit flow) — both reachable independently,
// so both sanitise their own `next` rather than trusting an upstream one.
//
// Run-05 prompt 1: il fallback era "/dashboard" (la dashboard mock, ora
// un redirect a "/"): atterrare direttamente su "/" evita il doppio salto.
export function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("://")) return "/";
  if (raw.includes("..")) return "/";
  return raw;
}
