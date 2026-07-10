/**
 * Step 1 of the Google Calendar OAuth dance.
 *
 * Verifies the user is signed in, generates a CSRF state token, drops
 * it in an httpOnly cookie, then redirects the user to Google's consent
 * screen. The matching `callback` route (sibling) verifies the state
 * cookie before doing anything destructive.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  buildAuthorizationUrl,
  GOOGLE_SCOPE_CALENDAR_READONLY,
  GOOGLE_SCOPE_DRIVE_FILE,
} from "@/lib/google/calendar-client";
import { checkAndConsume } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "google_oauth_state";
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes — generous but bounded

// OAuth start should be infrequent. 5/minute per user is plenty for
// retries if the consent screen fails; anything more is suspicious
// and would just churn state cookies.
const OAUTH_START_WINDOW_MS = 60_000;
const OAUTH_START_MAX_PER_WINDOW = 5;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Not authenticated — bounce to login. The /agenda page is the
    // landing surface so they end up there after sign-in.
    return NextResponse.redirect(new URL("/login?next=/agenda", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  // Sprint A: ?upgrade=drive triggers the "unified consent" flow —
  // the user re-authorises with calendar.events.readonly + drive.file
  // in a single Google prompt. prompt=consent (already set in
  // buildAuthorizationUrl) forces a fresh refresh_token that replaces
  // the previous one, carrying both scopes.
  const upgrade = request.nextUrl.searchParams.get("upgrade");
  const includeDrive = upgrade === "drive";

  const rl = checkAndConsume(
    `google_oauth_start:${user.id}`,
    OAUTH_START_WINDOW_MS,
    OAUTH_START_MAX_PER_WINDOW,
  );
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "google_oauth_not_configured",
        message: "Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI in .env.local.",
      },
      { status: 503 },
    );
  }

  // 32 bytes = 256 bits — far above CSRF-relevant thresholds.
  const state = randomBytes(32).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",                 // 'lax' lets the cookie travel on the redirect-back from Google
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  // Scope set: always include openid + email + calendar.events.readonly.
  // Add drive.file only when the unified-consent upgrade is requested.
  const scopes = includeDrive
    ? [
        GOOGLE_SCOPE_CALENDAR_READONLY,
        GOOGLE_SCOPE_DRIVE_FILE,
        "openid",
        "email",
      ]
    : undefined; // undefined → buildAuthorizationUrl uses its default

  const url = buildAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    scopes,
  });

  return NextResponse.redirect(url);
}
