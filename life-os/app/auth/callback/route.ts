import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

// I type OTP che Supabase può mettere in un link email (EmailOtpType).
const OtpTypeSchema = z.enum([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

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

  //   Token-hash flow (B3.3, chiude l'audit H5): i template email col
  //   formato {{ .TokenHash }} arrivano con ?token_hash=...&type=... —
  //   verifica server-side SENZA code verifier, quindi il link funziona
  //   anche aperto in un contesto diverso da quello che l'ha richiesto.
  //   Ramo PRIMA del PKCE: un link token_hash non ha ?code=.
  const tokenHash = searchParams.get("token_hash");
  const otpType = OtpTypeSchema.safeParse(searchParams.get("type"));
  if (tokenHash && otpType.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType.data,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(
            "Questo link non è più valido. Richiedi un nuovo codice.",
          )}`,
          origin,
        ),
      );
    }
    return NextResponse.redirect(new URL(next, origin));
  }

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
