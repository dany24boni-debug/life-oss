/**
 * Token lifecycle for connected Google accounts.
 *
 * Encapsulates the only reason application code ever decrypts the
 * access token: to call Google with it. If the cached access token is
 * within REFRESH_BUFFER_MS of expiry, refresh first using the encrypted
 * refresh_token, persist the new ciphertext, and return the fresh
 * access token in plaintext (in-memory only — never logged, never
 * returned to the client).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/crypto/token-cipher";
import { refreshAccessToken } from "@/lib/google/calendar-client";

const REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry

type AccountRow = {
  id: string;
  user_id: string;
  provider: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_token_expires_at: string;
};

/**
 * Shape a caller must provide when reusing a row it has already
 * fetched from `external_calendar_accounts`. Public alias so
 * helper modules (e.g. drive-journal) can SELECT once and feed the
 * result into multiple token calls per request.
 *
 * Includes `user_id` so the preloaded path can verify the row
 * actually belongs to the caller's userId — without that field, a
 * future caller could (accidentally or maliciously) hand off row A
 * belonging to user A while asserting userId=B and silently bypass
 * the cross-user guard.
 */
export type PreloadedTokenAccount = AccountRow;

/** The columns a caller needs to SELECT to populate PreloadedTokenAccount. */
export const TOKEN_ACCOUNT_COLUMNS =
  "id, user_id, provider, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at" as const;

/**
 * Returns a valid (non-expired) Google access token for the given
 * account row. Refreshes and persists the new token if needed.
 *
 * Defence-in-depth: the explicit `userId` parameter is filtered into
 * both the SELECT and the UPDATE alongside RLS. If a future caller
 * accidentally uses a service-role client (which bypasses RLS), the
 * explicit user_id filter still prevents cross-user access.
 *
 * Error messages NEVER include `accountId` or provider strings —
 * those values would propagate through last_sync_error into the UI.
 *
 * Perf — `preloaded` (optional): if the caller already SELECTed the
 * account row with the columns in TOKEN_ACCOUNT_COLUMNS, pass it
 * here to skip the redundant SELECT. Two defence-in-depth checks
 * fire on this path so the SELECT shortcut doesn't double as a
 * permission shortcut:
 *  - preloaded.id must equal accountId (rules out stale-row plumbing)
 *  - preloaded.user_id must equal userId (rules out cross-user row
 *    handoff — without this, a caller could pass row A belonging to
 *    user A while asserting userId=B and bypass the SELECT's
 *    .eq("user_id", userId) guard entirely)
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  preloaded?: PreloadedTokenAccount,
): Promise<string> {
  let account: AccountRow;

  if (preloaded) {
    // Defence in depth: refuse a preloaded row that doesn't match
    // the caller's stated accountId. A mismatched row signals a bug
    // in the caller's plumbing and we'd rather fail loudly than
    // silently use the wrong account.
    if (preloaded.id !== accountId) {
      throw new Error("getValidAccessToken: preloaded account id mismatch");
    }
    // Defence in depth: same logic for user_id. Replaces the
    // .eq("user_id", userId) filter we'd otherwise apply via SELECT.
    if (preloaded.user_id !== userId) {
      throw new Error("getValidAccessToken: preloaded account user_id mismatch");
    }
    account = preloaded;
  } else {
    const { data, error } = await supabase
      .from("external_calendar_accounts")
      .select(TOKEN_ACCOUNT_COLUMNS)
      .eq("id", accountId)
      .eq("user_id", userId)
      .single<AccountRow>();
    if (error || !data) {
      throw new Error("getValidAccessToken: account not found");
    }
    account = data;
  }

  if (account.provider !== "google") {
    throw new Error("getValidAccessToken: provider not supported in V0");
  }

  const expiresAt = new Date(account.access_token_expires_at);
  const stillFresh = Date.now() < expiresAt.getTime() - REFRESH_BUFFER_MS;
  if (stillFresh) {
    return decryptToken(account.access_token_ciphertext);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "getValidAccessToken: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing",
    );
  }

  const refreshToken = decryptToken(account.refresh_token_ciphertext);
  const fresh = await refreshAccessToken({
    refreshToken,
    clientId,
    clientSecret,
  });

  // Persist the new access ciphertext + expiry. Google rarely rotates
  // the refresh_token, but if it did we'd carry forward the rotated one.
  // Also persist the scope returned by Google — if the user revokes a
  // specific scope mid-session (e.g. drive.file) Google downgrades it on
  // refresh, and hasDriveFileScope() must see the truth.
  const updates: Record<string, unknown> = {
    access_token_ciphertext: encryptToken(fresh.accessToken),
    access_token_expires_at: fresh.expiresAt.toISOString(),
    scope: fresh.scope,
  };
  if (fresh.refreshToken && fresh.refreshToken !== refreshToken) {
    updates.refresh_token_ciphertext = encryptToken(fresh.refreshToken);
  }

  const { error: upErr } = await supabase
    .from("external_calendar_accounts")
    .update(updates)
    .eq("id", account.id)
    .eq("user_id", userId);
  if (upErr) {
    // Log but still return the fresh token — the caller can use it for
    // this request even if persistence failed; the next request will
    // re-refresh.
    console.error("[token-store] failed to persist refreshed token:", upErr.message);
  }

  return fresh.accessToken;
}
