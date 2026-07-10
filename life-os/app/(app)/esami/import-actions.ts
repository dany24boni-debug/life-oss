"use server";

/**
 * Lettura server della tabella legacy `exams` per l'importer (run-05
 * prompt 3, B3.6): SOLO fetch, RLS-scoped all'utente della sessione — la
 * tabella vecchia resta sorgente read-only intatta. Mappatura e scrittura
 * avvengono sul client (importer.ts + import-run.ts), nei port locali.
 */

import { createClient } from "@/lib/supabase/server";
import type { LegacyExamRow } from "./importer";

export type LegacyEsamiData = {
  ok: boolean;
  exams: LegacyExamRow[];
};

export async function fetchLegacyEsami(): Promise<LegacyEsamiData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, exams: [] };

  const res = await supabase
    .from("exams")
    .select(
      "id, title, exam_date, total_chapters, completed_chapters, notes, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true });

  if (res.error) {
    console.error("[esami] lettura tabella legacy fallita:", res.error);
    return { ok: false, exams: [] };
  }
  return { ok: true, exams: (res.data ?? []) as LegacyExamRow[] };
}
