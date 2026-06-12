import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

// Magic-link callback — a Route Handler, NOT a Server Component, so the
// session cookies Supabase writes during exchangeCodeForSession actually
// get attached to the outgoing response. Cookie writes are forbidden
// during Server Component render (that was the original bug: the write
// threw, got swallowed, and the redirect fired with no session).
//
//   PKCE flow (default, login started via signInWithOtp in this app):
//   Supabase redirects here with ?code=xxx → exchange server-side →
//   HTTP-only session cookies set → redirect to `next`.
//
//   Implicit flow (admin/generate_link or older links): tokens arrive in
//   the URL hash fragment (#access_token=...), invisible to the server.
//   With no ?code= we redirect to /auth/confirm, a client page that can
//   read window.location.hash. Browsers re-attach the original fragment
//   to a redirect whose Location has none (RFC 7231 §7.1.2), so the
//   tokens survive the hop.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    const confirmUrl = new URL("/auth/confirm", origin);
    confirmUrl.searchParams.set("next", next);
    return NextResponse.redirect(confirmUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
