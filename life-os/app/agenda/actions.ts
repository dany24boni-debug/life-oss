"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listEvents,
  revokeToken,
} from "@/lib/google/calendar-client";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { getValidAccessToken } from "@/lib/google/token-store";
import {
  buildExternalEventRows,
  EXTERNAL_EVENTS_CONFLICT_TARGET,
} from "@/lib/google/upsert-events";

const SYNC_WINDOW_BACKWARD_DAYS = 7;
const SYNC_WINDOW_FORWARD_DAYS = 30;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Pull the user's events from Google Calendar in the configured window
 * and UPSERT them into external_calendar_events. Idempotent: re-running
 * is safe and only updates rows whose Google representation has
 * changed.
 *
 * Failure modes are persisted to last_sync_error (truncated) so the
 * /agenda UI can surface a "couldn't sync" state pill instead of a
 * blank screen.
 */
export async function refreshGoogleCalendar() {
  const { supabase, user } = await requireUser();

  const { data: account } = await supabase
    .from("external_calendar_accounts")
    .select("id, external_account_email")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (!account) {
    revalidatePath("/agenda");
    return;
  }

  let syncedCount = 0;
  let syncError: string | null = null;
  try {
    const accessToken = await getValidAccessToken(supabase, account.id, user.id);

    const now = new Date();
    const timeMin = new Date(
      now.getTime() - SYNC_WINDOW_BACKWARD_DAYS * 24 * 60 * 60 * 1000,
    );
    const timeMax = new Date(
      now.getTime() + SYNC_WINDOW_FORWARD_DAYS * 24 * 60 * 60 * 1000,
    );

    const events = await listEvents({
      accessToken,
      calendarId: "primary",
      timeMin,
      timeMax,
    });

    if (events.length > 0) {
      const rows = buildExternalEventRows(events, user.id, account.id, now);
      const { error: upErr } = await supabase
        .from("external_calendar_events")
        .upsert(rows, { onConflict: EXTERNAL_EVENTS_CONFLICT_TARGET });
      if (upErr) {
        throw new Error("upsert_failed");
      }
    }

    syncedCount = events.length;
  } catch (err) {
    // Map to a stable error code rather than echoing raw error
    // strings (which can include Google API response bodies, request
    // IDs, or PostgREST schema details that surface in the UI via
    // last_sync_error). Full error stays in the server log only.
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("token") || raw.includes("refresh") || raw.includes("auth")) {
      syncError = "token_refresh_failed";
    } else if (raw.includes("upsert")) {
      syncError = "db_upsert_failed";
    } else if (raw.includes("listEvents")) {
      syncError = "google_api_error";
    } else if (raw.includes("account not found")) {
      syncError = "account_missing";
    } else {
      syncError = "sync_failed";
    }
    console.error("[agenda] sync failed:", err);
  }

  await supabase
    .from("external_calendar_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: syncError,
    })
    .eq("id", account.id)
    .eq("user_id", user.id);

  void syncedCount;
  revalidatePath("/agenda");
}

/**
 * Disconnect the linked Google account: revoke the refresh token at
 * Google (best-effort) and delete the local row. The events table
 * cascades on delete, so all imported rows go with it.
 */
export async function disconnectGoogleCalendar() {
  const { supabase, user } = await requireUser();

  const { data: account } = await supabase
    .from("external_calendar_accounts")
    .select("id, refresh_token_ciphertext")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (!account) {
    revalidatePath("/agenda");
    return;
  }

  try {
    const refreshToken = decryptToken(account.refresh_token_ciphertext);
    await revokeToken(refreshToken);
  } catch (err) {
    console.error("[agenda] revoke failed (continuing with local delete):", err);
  }

  const { error: delErr } = await supabase
    .from("external_calendar_accounts")
    .delete()
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (delErr) {
    console.error("[agenda] delete account row failed:", delErr.message);
  }

  revalidatePath("/agenda");
}
