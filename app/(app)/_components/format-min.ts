/**
 * Minuti in forma umana: "45'", "4h", "5h30" (run-11). Modulo minuscolo
 * e senza dipendenze: lo importano sia la timeline di Oggi (chunk della
 * home) sia il corpo lazy del rituale — la matematica di capacità resta
 * in `ritual/ritual-logic.ts`, fuori dal chunk della home.
 */
export function formatMin(min: number): string {
  const safe = Math.max(0, Math.round(min));
  if (safe < 60) return `${safe}'`;
  const h = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, "0")}`;
}
