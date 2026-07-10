"use server";

/**
 * Lettura server della tabella legacy `evening_checkins` per l'importer
 * (run-05 prompt 5, B3.6): SOLO fetch, RLS-scoped — la tabella resta
 * sorgente read-only intatta. I diari NON stanno qui: vivono su Drive
 * (dove restano leggibili) — l'importer porta i CHECK-IN.
 */

import { createClient } from "@/lib/supabase/server";
import type { LegacyCheckinRow } from "./importer";

export type LegacySeraData = {
  ok: boolean;
  checkins: LegacyCheckinRow[];
};

export async function fetchLegacySera(): Promise<LegacySeraData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, checkins: [] };

  const res = await supabase
    .from("evening_checkins")
    .select("id, date, energy_1_5, mood, notes, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  if (res.error) {
    console.error("[sera] lettura tabella legacy fallita:", res.error);
    return { ok: false, checkins: [] };
  }
  return { ok: true, checkins: (res.data ?? []) as LegacyCheckinRow[] };
}
