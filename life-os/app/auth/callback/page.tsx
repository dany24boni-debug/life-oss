import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallbackHashHandler } from "./_client";

// Allowlisted same-origin paths the magic-link callback may forward to.
// Anything else (including protocol-relative `//foo` and parent-traversal `..`)
// falls back to /dashboard so the auth flow can't be weaponised for in-domain
// phishing redirects via a crafted ?next= query.
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  if (raw.includes("://")) return "/dashboard";
  if (raw.includes("..")) return "/dashboard";
  return raw;
}

// Magic-link callback. Two possible flows:
//
//   1. PKCE (default when login starts from this app via
//      supabase.auth.signInWithOtp) → Supabase redirects here
//      with ?code=xxx → exchange server-side, set HTTP-only cookie
//      session, redirect.
//
//   2. Implicit (used by admin/generate_link or older flow) →
//      Supabase redirects here with `#access_token=&refresh_token=`
//      in the hash fragment. Hash isn't visible server-side, so we
//      render a small client component that reads window.location
//      .hash, calls setSession(), and redirects.
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;
  const next = safeNext(
    typeof params.next === "string" ? params.next : null,
  );

  // PKCE path — code arrives as ?code=
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
    redirect(next);
  }

  // No code on the server — could be implicit flow (tokens in the
  // hash fragment). Render the client handler; it reads the hash
  // and sets the session. If the hash is also empty (real "missing
  // code" case), it redirects back to /login with an error.
  return <CallbackHashHandler next={next} />;
}
