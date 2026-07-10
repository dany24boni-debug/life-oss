/**
 * Step 2 of the Google Calendar OAuth dance.
 *
 * Google bounces the user back here with `code` (auth code) and `state`
 * (CSRF token). We:
 *   1. Validate the state cookie matches the query string.
 *   2. Confirm the user is signed in (must be the same Supabase session).
 *   3. Exchange the auth code for access + refresh tokens.
 *   4. Encrypt both tokens and upsert into external_calendar_accounts.
 *   5. Redirect to /agenda with a status query param.
 *
 * On any failure the user lands on /agenda?error=<slug> instead of
 * silently breaking. The state cookie is deleted on every exit path.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  getUserEmail,
} from "@/lib/google/calendar-client";
import { encryptToken } from "@/lib/crypto/token-cipher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "google_oauth_state";

// Standard OAuth 2.0 error codes (RFC 6749 §4.1.2.1) plus Google's
// extensions. Anything outside this allowlist collapses to a generic
// slug so a forged callback URL can't reflect arbitrary text into the
// agenda page (UI redress / phishing surface).
const ALLOWED_OAUTH_ERRORS = new Set([
  "access_denied",
  "invalid_request",
  "unauthorized_client",
  "unsupported_response_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
  "interaction_required",
  "login_required",
  "consent_required",
]);

/**
 * Constant-time equality for the CSRF state cookie. Strings of
 * different length short-circuit (the timing leak is the length
 * itself, which is fixed at 64 hex chars in our flow).
 */
function safeStateCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function redirectAgenda(slug: string, kind: "error" | "connected"): NextResponse {
  const url = new URL("/agenda", appUrl());
  url.searchParams.set(kind, slug);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // Always clear the state cookie — single-use semantics.
  cookieStore.delete(STATE_COOKIE_NAME);

  const search = request.nextUrl.searchParams;
  const queryError = search.get("error");
  const queryState = search.get("state");
  const code = search.get("code");

  // User denied consent or Google returned an error. Allowlist the
  // slug we forward to the UI so a forged callback can't echo
  // arbitrary attacker-controlled text into the page.
  if (queryError) {
    const safe = ALLOWED_OAUTH_ERRORS.has(queryError) ? queryError : "oauth_error";
    return redirectAgenda(safe, "error");
  }
  if (!code || !queryState) {
    return redirectAgenda("missing_code_or_state", "error");
  }
  if (!stateCookie || !safeStateCompare(stateCookie, queryState)) {
    return redirectAgenda("state_mismatch", "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectAgenda("not_authenticated", "error");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectAgenda("not_configured", "error");
  }

  let tokens;
  let email: string;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    email = await getUserEmail(tokens.accessToken);
  } catch (err) {
    // Don't leak Google API error bodies to the URL bar.
    console.error("[google-oauth] token exchange failed:", err);
    return redirectAgenda("token_exchange_failed", "error");
  }

  // The first-consent response MUST include a refresh_token because we
  // requested access_type=offline + prompt=consent. If it's missing,
  // something is wrong — bail rather than persisting a useless row.
  if (!tokens.refreshToken) {
    return redirectAgenda("missing_refresh_token", "error");
  }

  let accessCt: string;
  let refreshCt: string;
  try {
    accessCt = encryptToken(tokens.accessToken);
    refreshCt = encryptToken(tokens.refreshToken);
  } catch (err) {
    console.error("[google-oauth] token encryption failed:", err);
    return redirectAgenda("encryption_failed", "error");
  }

  const { error: upsertErr } = await supabase
    .from("external_calendar_accounts")
    .upsert(
      {
        user_id: user.id,
        provider: "google",
        external_account_email: email,
        access_token_ciphertext: accessCt,
        refresh_token_ciphertext: refreshCt,
        access_token_expires_at: tokens.expiresAt.toISOString(),
        scope: tokens.scope,
        last_sync_error: null,
      },
      { onConflict: "user_id,provider,external_account_email" },
    );

  if (upsertErr) {
    console.error("[google-oauth] upsert failed:", upsertErr);
    return redirectAgenda("db_upsert_failed", "error");
  }

  return redirectAgenda("google", "connected");
}
