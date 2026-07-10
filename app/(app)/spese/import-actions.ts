"use server";

/**
 * Lettura server della tabella legacy `personal_expenses` per l'importer
 * (run-05 prompt 4, B3.6): SOLO fetch, RLS-scoped — la tabella resta
 * sorgente read-only intatta (e /finance il suo archivio, D4).
 */

import { createClient } from "@/lib/supabase/server";
import type { LegacyExpenseRow } from "./importer";

export type LegacySpeseData = {
  ok: boolean;
  expenses: LegacyExpenseRow[];
};

export async function fetchLegacySpese(): Promise<LegacySpeseData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, expenses: [] };

  const res = await supabase
    .from("personal_expenses")
    .select("id, expense_date, amount, category, note, created_at, updated_at")
    .eq("user_id", user.id)
    .order("expense_date", { ascending: true });

  if (res.error) {
    console.error("[spese] lettura tabella legacy fallita:", res.error);
    return { ok: false, expenses: [] };
  }
  return { ok: true, expenses: (res.data ?? []) as LegacyExpenseRow[] };
}
