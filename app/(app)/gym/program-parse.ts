/**
 * Logica pura del builder di programmi (run-07 prompt 2) — parsing degli
 * input "da foglio" e raggruppamento per sezioni. Zero side effect.
 *
 * Prescrizioni (reps/RIR): il dominio è TESTO (schema ≤20 char); qui si
 * normalizza solo la grafia — trattino ASCII tra numeri → trattino medio
 * "–" come sul foglio, spazi collassati — senza mai interpretare.
 * Recuperi: il campo desktop accetta "90" (secondi), "1'30" / "1:30",
 * "4'" (minuti); i chip coprono i valori del foglio.
 */

import type { GymProgramSlot } from "@/data/schemas";

/* ── Prescrizioni testuali ───────────────────────────────────────────── */

/**
 * Normalizza una prescrizione digitata: trim, spazi interni collassati,
 * "3-5" → "3–5" (trattino medio tra numeri, la grafia del foglio), tetto
 * dello schema (20) rispettato troncando. Vuoto → null.
 */
export function normalizePrescriptionInput(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed === "") return null;
  const dashed = collapsed.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
  return dashed.slice(0, 20);
}

/* ── Recuperi ────────────────────────────────────────────────────────── */

/** I valori del foglio, in secondi (chips del builder). */
export const REST_CHOICES = [60, 75, 90, 120, 150, 180, 210, 240, 270] as const;

/** Etichette-sezione suggerite (chips); il dominio resta testo libero. */
export const SECTION_SUGGESTIONS = ["FORZA", "IPERTROFIA", "CORE"] as const;

/**
 * Interpreta l'input libero del recupero: "90" = secondi; "1'30" o
 * "1:30" = minuti+secondi; "4'" = minuti tondi. Clamp al dominio dello
 * schema (0..900). Vuoto o incomprensibile → null (nessun recupero).
 */
export function parseRestInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (s === "") return null;
  let seconds: number | null = null;
  const plain = /^(\d{1,4})$/.exec(s);
  const minSec = /^(\d{1,2})['’:](\d{1,2})?['’]?$/.exec(s);
  if (plain) {
    seconds = Number.parseInt(plain[1], 10);
  } else if (minSec) {
    const min = Number.parseInt(minSec[1], 10);
    const sec = minSec[2] === undefined ? 0 : Number.parseInt(minSec[2], 10);
    if (sec > 59) return null;
    seconds = min * 60 + sec;
  }
  if (seconds === null) return null;
  return Math.max(0, Math.min(900, seconds));
}

/** 270 → "4'30", 60 → "1'", 45 → "45\"", null → "—". */
export function formatRestShort(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}"`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min}'` : `${min}'${String(sec).padStart(2, "0")}`;
}

/* ── Sezioni: raggruppamento visivo ──────────────────────────────────── */

export type SectionGroup<T> = { section: string | null; slots: T[] };

/**
 * Raggruppa gli slot CONSECUTIVI con la stessa sezione: l'ordine totale
 * (sort_order) resta la verità, le intestazioni si limitano a seguirlo —
 * mai un ri-ordinamento implicito per sezione.
 */
export function sectionGroups<T extends { section: string | null }>(
  slots: readonly T[],
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.section === slot.section) {
      last.slots.push(slot);
    } else {
      groups.push({ section: slot.section, slots: [slot] });
    }
  }
  return groups;
}

/* ── Riepilogo riga (vista mobile) ───────────────────────────────────── */

/** "4×3–5 · RIR 1 · rec 4'30 · corpo libero" — solo le parti presenti. */
export function slotSummary(
  slot: Pick<
    GymProgramSlot,
    "target_sets" | "target_reps" | "target_rir" | "rest_seconds" | "bodyweight"
  >,
): string {
  const parts: string[] = [];
  parts.push(
    slot.target_reps === null
      ? `${slot.target_sets} serie`
      : `${slot.target_sets}×${slot.target_reps}`,
  );
  if (slot.target_rir !== null) parts.push(`RIR ${slot.target_rir}`);
  if (slot.rest_seconds !== null)
    parts.push(`rec ${formatRestShort(slot.rest_seconds)}`);
  if (slot.bodyweight) parts.push("corpo libero");
  return parts.join(" · ");
}
