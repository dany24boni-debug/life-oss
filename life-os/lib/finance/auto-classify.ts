/**
 * Keyword-based auto-classifier per /finance Uscite (Sprint U2).
 *
 * Pure function: zero side effects, deterministica, NO LLM.
 * Restituisce una categoria suggerita dal testo della nota, per
 * pre-selezionare il chip nel form expense. L'utente può
 * cambiare il chip manualmente — l'auto-classify è solo
 * un'euristica.
 *
 * Mirror del closed enum DB sulla colonna
 * personal_expenses.category (migration 0017). Drift fra le due
 * = write failure: l'auto-classify potrebbe suggerire un valore
 * che la migration non accetta.
 *
 * Sull'ordine di matching: scorriamo le categorie nell'ordine
 * di `CATEGORY_KEYWORDS`. Una nota tipo "spotify ticket cinema"
 * matcha la prima keyword trovata (svago via "cinema"). L'ordine
 * delle categorie non riflette priorità — riflette il dominio
 * d'uso quotidiano: cibo/trasporto in cima perché sono i casi
 * più frequenti. Le keyword più ambigue (es. "spotify" → tech
 * vs. "spotify ticket" → svago) sono gestite scegliendo la
 * keyword più specifica nella categoria giusta — vedi
 * note inline su `svago`.
 */

export const CATEGORIES = [
  "cibo",
  "trasporto",
  "svago",
  "vestiti",
  "casa",
  "salute",
  "studio",
  "tech",
  "regalo",
  "altro",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Keyword → category mapping. Tutte le keyword devono essere
 * lowercased qui (il matcher converte la nota in lowercase prima
 * di confrontare). Substring match — "Esselunga" matcha
 * "esselunga" anche dentro "Spesa Esselunga di sabato".
 *
 * Le keyword sono case-insensitive ma sensibili agli accenti:
 * "università" è separato da "universita". Se vuoi un match
 * accent-insensitive in V2 aggiungi normalize NFD strip.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [Category, ReadonlyArray<string>]> = [
  [
    "cibo",
    [
      "esselunga",
      "lidl",
      "conad",
      "coop",
      "supermercato",
      "ristorante",
      "bar",
      "panino",
      "sushi",
      "pizza",
      "spesa",
      "despar",
      "carrefour",
      "mcdonald",
    ],
  ],
  [
    "trasporto",
    [
      "treno",
      "frecciarossa",
      "trenord",
      "italo",
      "metro",
      // "atm" matcha anche "atmosfera". Substring-only — V2 \b.
      "atm",
      "benzina",
      "uber",
      "taxi",
      "autostrada",
      "telepass",
      "autobus",
    ],
  ],
  [
    "svago",
    [
      "cinema",
      "concerto",
      "locale",
      "pub",
      "discoteca",
      "club",
      // "spotify ticket" è la versione disambiguata di "spotify"
      // — un biglietto comprato via Spotify Live è svago, mentre
      // l'abbonamento mensile cade in tech. Il matcher cerca la
      // stringa esatta, quindi "spotify ticket abc" matcha svago,
      // mentre "spotify" da solo è gestito dalla categoria tech.
      "spotify ticket",
    ],
  ],
  [
    "vestiti",
    [
      "zara",
      "h&m",
      "decathlon",
      "scarpe",
      "vestito",
      "abbigliamento",
      "nike",
      "adidas",
    ],
  ],
  [
    "casa",
    [
      "affitto",
      "bolletta",
      "luce",
      // "gas" è una stringa molto corta → falsi positivi noti:
      // "pagas" / "legas" (verbi colloquiali). Substring-only.
      // V2: word-boundary matching o keyword "metano"/"bolletta gas".
      "gas",
      "internet",
      "fastweb",
      "iliad",
      "vodafone",
      // "tim" matcha anche dentro "ottimo" / "vittima" — false
      // positive coperto da test inline. Stesso disclaimer di "gas".
      "tim",
      "condominio",
    ],
  ],
  [
    "salute",
    [
      "farmacia",
      "medico",
      "dentista",
      "ospedale",
      "sanitario",
      "visita",
    ],
  ],
  [
    "studio",
    [
      "libro",
      // "corso" matcha anche "discorso" / "percorso". Substring-only.
      "corso",
      "udemy",
      "skillshare",
      // "universit" è il prefix comune di "università" (it) e
      // "university" (en) — chiude L2 dell'ECC mid-sprint senza
      // richiedere NFD normalization. Matcha entrambe le grafie.
      "universit",
      "tasse universitarie",
    ],
  ],
  [
    "tech",
    [
      "netflix",
      "spotify",
      "icloud",
      "github",
      "anthropic",
      "openai",
      "chatgpt",
      "claude",
      // "abbonamento" è una keyword catch-all: matcherà
      // "abbonamento netflix" (tech, true positive) ma anche
      // "abbonamento palestra" (salute) / "abbonamento treno"
      // (trasporto) → false positive in tech. La keyword resta
      // perché il caso "abbonamento <tech-service>" è il pattern
      // più frequente per le spese ricorrenti dell'utente.
      // Mitigazione: scriverne il merchant ("Netflix") che ha
      // priorità più alta nel matching scanning order.
      "abbonamento",
    ],
  ],
  [
    "regalo",
    [
      "regalo",
      "gift",
      "compleanno",
    ],
  ],
];

/**
 * Suggerisce una categoria dalla nota.
 *
 * - Empty / whitespace-only → `null` (il caller decide se non
 *   pre-selezionare nessun chip, o usare un default UX-specifico).
 * - Keyword match → la categoria corrispondente alla PRIMA
 *   keyword trovata scorrendo CATEGORY_KEYWORDS in ordine.
 * - Nota non-vuota senza nessun match → "altro" (fallback
 *   esplicito: l'utente ha scritto qualcosa, non lo lasciamo
 *   appeso senza chip).
 */
export function suggestCategory(note: string): Category | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;

  const lower = trimmed.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }
  return "altro";
}
