import "server-only";

/**
 * Lettura server-side del blocco Google per /calendar (prompt 09) — il
 * porting della parte di LETTURA di /agenda, coi due azzardi dell'audit
 * evitati per costruzione:
 *
 *   1. NIENTE `.maybeSingle()` sugli account: si legge la LISTA. Il
 *      callback OAuth ha unique (user_id, provider, email), quindi due
 *      account Google = due righe — qui è un caso normale, non un errore.
 *   2. NIENTE scritture durante la GET: la pagina legacy inserisce un
 *      "holder" custom_modules al render; la nuova non ha bisogno di
 *      nulla del genere (gli eventi locali vivono in Dexie).
 *
 * Il range letto è l'intera tabella dell'utente: la sync la ripopola già
 * bounded a [-7g, +30g] (finestra di lib/google via actions), quindi
 * "tutto" È il massimo range visibile — mesi fuori finestra mostrano
 * onestamente zero eventi Google.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toGoogleAgendaEvent,
  type GoogleAgendaEvent,
  type GoogleEventRow,
} from "./agenda";

export type GoogleAccountInfo = {
  id: string;
  email: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type GoogleBlockData = {
  accounts: GoogleAccountInfo[];
  events: GoogleAgendaEvent[];
};

export async function readGoogleBlock(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
): Promise<GoogleBlockData> {
  // Lettura a LISTA (mai maybeSingle): più account = più righe, tutte care.
  const { data: accountsRaw } = await supabase
    .from("external_calendar_accounts")
    .select("id, external_account_email, last_synced_at, last_sync_error")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("created_at", { ascending: true });

  const accounts: GoogleAccountInfo[] = (accountsRaw ?? []).map((a) => ({
    id: a.id as string,
    email: a.external_account_email as string,
    lastSyncedAt: (a.last_synced_at as string | null) ?? null,
    lastSyncError: (a.last_sync_error as string | null) ?? null,
  }));
  if (accounts.length === 0) return { accounts: [], events: [] };

  const { data: eventsRaw } = await supabase
    .from("external_calendar_events")
    .select("id, title, starts_at, ends_at, all_day, status")
    .eq("user_id", userId)
    .order("starts_at", { ascending: true });

  const events: GoogleAgendaEvent[] = [];
  for (const row of (eventsRaw ?? []) as GoogleEventRow[]) {
    const mapped = toGoogleAgendaEvent(row, timeZone);
    if (mapped) events.push(mapped); // i "cancelled" cadono qui
  }
  return { accounts, events };
}
