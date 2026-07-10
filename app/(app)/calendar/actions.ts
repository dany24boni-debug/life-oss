"use server";

/**
 * "Sincronizza Google" per /calendar (prompt 09) — il porting della sync
 * manuale di /agenda, riusando lo stesso codice testato di lib/google
 * (client API, token store, mapping upsert). Differenza deliberata: gira
 * su TUTTI gli account Google collegati (lista, mai `.maybeSingle()` —
 * l'audit A2 documenta che un secondo account rompeva la pagina legacy).
 *
 * Il flusso di CONNESSIONE resta quello esistente e intoccato:
 * /api/auth/google/start → consenso → callback → redirect su /agenda
 * (il redirect del callback è fuori fence in questo run; il prompt 15
 * chiuderà il cerchio reindirizzando /agenda su /calendar).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listEvents, revokeToken } from "@/lib/google/calendar-client";
import { decryptToken } from "@/lib/crypto/token-cipher";
import { getValidAccessToken } from "@/lib/google/token-store";
import {
  buildExternalEventRows,
  EXTERNAL_EVENTS_CONFLICT_TARGET,
} from "@/lib/google/upsert-events";

const SYNC_WINDOW_BACKWARD_DAYS = 7;
const SYNC_WINDOW_FORWARD_DAYS = 30;

export async function syncGoogleCalendars(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts } = await supabase
    .from("external_calendar_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .order("created_at", { ascending: true });

  const now = new Date();
  const timeMin = new Date(
    now.getTime() - SYNC_WINDOW_BACKWARD_DAYS * 24 * 60 * 60 * 1000,
  );
  const timeMax = new Date(
    now.getTime() + SYNC_WINDOW_FORWARD_DAYS * 24 * 60 * 60 * 1000,
  );

  for (const account of accounts ?? []) {
    let syncError: string | null = null;
    try {
      const accessToken = await getValidAccessToken(
        supabase,
        account.id as string,
        user.id,
      );
      const events = await listEvents({
        accessToken,
        calendarId: "primary",
        timeMin,
        timeMax,
      });
      if (events.length > 0) {
        const rows = buildExternalEventRows(
          events,
          user.id,
          account.id as string,
          now,
        );
        const { error: upErr } = await supabase
          .from("external_calendar_events")
          .upsert(rows, { onConflict: EXTERNAL_EVENTS_CONFLICT_TARGET });
        if (upErr) throw new Error("upsert_failed");
      }
    } catch (err) {
      // Codici stabili, mai stringhe grezze verso la UI (convenzione della
      // action legacy, invariata).
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes("token") || raw.includes("refresh") || raw.includes("auth")) {
        syncError = "token_refresh_failed";
      } else if (raw.includes("upsert")) {
        syncError = "db_upsert_failed";
      } else if (raw.includes("listEvents")) {
        syncError = "google_api_error";
      } else {
        syncError = "sync_failed";
      }
      console.error("[calendar] sync google fallita:", err);
    }

    await supabase
      .from("external_calendar_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: syncError,
      })
      .eq("id", account.id as string)
      .eq("user_id", user.id);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
}

/**
 * "Disconnetti" per /calendar (run-05 prompt 1) — il porting della
 * disconnessione che viveva sulla /agenda legacy, con la stessa logica
 * server-side riusata (revoca best-effort del refresh token a Google via
 * lib, poi delete della riga account: gli eventi importati cascadono).
 * Differenza deliberata: PER-ACCOUNT (riga scelta per id + user_id), mai
 * `.maybeSingle()` sul provider — con due account Google se ne stacca
 * uno solo, l'altro resta.
 */
export async function disconnectGoogleAccount(
  accountId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("external_calendar_accounts")
    .select("id, refresh_token_ciphertext")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle(); // qui è una riga puntuale per PK: singolare per natura.
  if (!account) {
    revalidatePath("/calendar");
    return;
  }

  try {
    const refreshToken = decryptToken(account.refresh_token_ciphertext);
    await revokeToken(refreshToken);
  } catch (err) {
    console.error(
      "[calendar] revoca Google fallita (procedo col delete locale):",
      err,
    );
  }

  const { error: delErr } = await supabase
    .from("external_calendar_accounts")
    .delete()
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (delErr) {
    console.error("[calendar] delete account fallita:", delErr.message);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
}
