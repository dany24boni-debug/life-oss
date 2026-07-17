/**
 * Fuzzy matcher della palette (run-12 P4) — subsequence CON punteggio,
 * in casa e puro: ogni carattere della query deve comparire in ordine
 * nel bersaglio; il punteggio premia gli inizi di parola, le sequenze
 * consecutive e — a parità — i bersagli corti. null = nessun match.
 * Niente normalizzazione unicode: lowercase semplice, prevedibile.
 */

export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  let qi = 0;
  let streak = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi += 1;
      streak += 1;
      const prev = ti === 0 ? " " : t[ti - 1];
      const wordStart =
        prev === " " || prev === "/" || prev === "-" || prev === ":";
      score += 1 + (wordStart ? 2 : 0) + (streak > 1 ? streak : 0);
    } else {
      streak = 0;
    }
  }
  if (qi < q.length) return null;
  // Penalità dolce per lunghezza: a pari match vince il bersaglio corto.
  return score - t.length / 100;
}

/**
 * Il rank per la shell CommandPalette: punteggio su "label + keywords".
 * Estratto qui perché sia testabile e riusabile dalla sorgente lazy.
 */
export function rankOf(
  query: string,
  item: { label: string; keywords?: string },
): number | null {
  return fuzzyScore(query, `${item.label} ${item.keywords ?? ""}`);
}
