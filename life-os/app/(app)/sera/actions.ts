"use server";

/**
 * Export del diario su Google Drive (run-05 prompt 5) — la RICOLLOCAZIONE
 * della `saveDiaryEntry` che viveva in app/sera/actions.ts (morta col
 * ritiro della pagina legacy): stessa lib `lib/google/drive-journal`
 * (READ-ONLY, mai reimplementata — crypto e cartella Life-OS/Diario/
 * invariate), stessi slug d'errore stabili. Differenza: nel mondo nuovo
 * NON è un autosave — è un bottone esplicito, il salvataggio continuo del
 * diario è locale.
 */

import { createClient } from "@/lib/supabase/server";
import { saveJournalEntry } from "@/lib/google/drive-journal";
import {
  SaveDiaryEntrySchema,
  MAX_DIARY_CHARS,
  parseFormData,
} from "@/lib/validation/form-inputs";

export async function saveDiaryEntry(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }

  const parsed = parseFormData(SaveDiaryEntrySchema, formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    if (flat.content?.some((m: string) => m.includes("at most"))) {
      return { ok: false, error: "content_too_large" };
    }
    return { ok: false, error: "bad_input" };
  }
  const { date, content } = parsed.data;
  const mood = parsed.data.mood ?? null;

  if (content.length > MAX_DIARY_CHARS) {
    return { ok: false, error: "content_too_large" };
  }

  try {
    await saveJournalEntry(supabase, user.id, date, content, mood);
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[sera] saveDiaryEntry failed:", raw);
    if (raw.includes("account_missing")) {
      return { ok: false, error: "account_missing" };
    }
    if (raw.includes("scope_missing")) {
      return { ok: false, error: "scope_missing" };
    }
    if (raw.includes("drive_api_error")) {
      return { ok: false, error: "drive_api_error" };
    }
    return { ok: false, error: "unknown" };
  }
}
