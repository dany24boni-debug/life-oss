"use server";

/**
 * Lettura server degli eventi locali della /agenda legacy (run-05
 * prompt 1, B3.6): SOLO fetch, RLS-scoped all'utente della sessione.
 * Sorgente (audit A5): le righe di `custom_module_entries` appartenenti
 * al modulo "holder" `custom_modules` kind=calendar creato dalla pagina
 * legacy col nome fisso "Agenda principale". Gli ALTRI moduli custom
 * kind=calendar restano fuori: vivono ancora in /custom (D4) e importarli
 * duplicherebbe dati tuttora visibili lì.
 *
 * Lettura a LISTA anche sul holder (mai `.maybeSingle()`): se per una
 * race storica ne esistessero due, si importano le righe di entrambi.
 */

import { createClient } from "@/lib/supabase/server";
import type { LegacyAgendaEntryRow } from "./importer";

const AGENDA_MODULE_NAME = "Agenda principale";

export type LegacyAgendaData = {
  ok: boolean;
  entries: LegacyAgendaEntryRow[];
};

export async function fetchLegacyAgendaEvents(): Promise<LegacyAgendaData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, entries: [] };

  const holdersRes = await supabase
    .from("custom_modules")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "calendar")
    .eq("name", AGENDA_MODULE_NAME);
  if (holdersRes.error) {
    console.error(
      "[calendar] lettura holder agenda legacy fallita:",
      holdersRes.error,
    );
    return { ok: false, entries: [] };
  }
  const holderIds = (holdersRes.data ?? []).map((m) => m.id as string);
  if (holderIds.length === 0) return { ok: true, entries: [] };

  const entriesRes = await supabase
    .from("custom_module_entries")
    .select("id, date, label, notes, created_at")
    .eq("user_id", user.id)
    .in("custom_module_id", holderIds)
    .order("date", { ascending: true });
  if (entriesRes.error) {
    console.error(
      "[calendar] lettura eventi agenda legacy fallita:",
      entriesRes.error,
    );
    return { ok: false, entries: [] };
  }

  return { ok: true, entries: (entriesRes.data ?? []) as LegacyAgendaEntryRow[] };
}
