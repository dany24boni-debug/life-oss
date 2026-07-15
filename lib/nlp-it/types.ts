/**
 * Contratto pubblico del parser (B2.1). Nessun import da data/ o app/:
 * la libreria è pura e autonoma, i tipi stringa sono alias locali.
 */

/** Giorno civile "YYYY-MM-DD". */
export type IsoDate = string;

/** Orario "HH:MM" 24h. */
export type Hhmm = string;

/** Priorità: 1 = P1 (massima) ... 3 = P3 (minima). */
export type Priority = 1 | 2 | 3;

/** Moduli suggeribili dal testo; per ora solo la palestra. */
export type ModuleHint = "gym";

/**
 * Regola di ripetizione riconosciuta ("ogni lunedì", "nei feriali"):
 * stessa forma del dominio ma dichiarata qui — la libreria resta
 * autonoma, senza import da data/.
 */
export type RecurrenceValue = {
  freq: "daily" | "weekly";
  /** Giorni ISO 1-7 (solo weekly), ordinati e senza duplicati. */
  weekdays?: number[];
};

export type FragmentKind =
  | "date"
  | "time"
  | "priority"
  | "tag"
  | "module"
  | "recurrence";

/**
 * Frammento riconosciuto: span di caratteri sull'input ORIGINALE
 * (start incluso, end escluso — convenzione slice), così la UI può
 * evidenziare inline e rendere ogni chip dismissibile (l'utente vince
 * sempre sul parser). `display` è l'etichetta pronta per il chip
 * ("ven 17 lug", "18:30", "P2", "#spesa", "Palestra").
 */
export type Fragment = {
  kind: FragmentKind;
  start: number;
  end: number;
  display: string;
};

export type ParseOptions = {
  /** L'istante "adesso" — SEMPRE iniettato, mai letto dall'ambiente. */
  now: Date;
  /** Timezone IANA del giorno civile dell'utente, es. "Europe/Rome". */
  timeZone: string;
};

/**
 * Esito del parse. `title` è l'input meno i frammenti consumati,
 * normalizzato negli spazi. Il frammento module NON viene consumato:
 * la parola resta nel titolo e il chip è solo un suggerimento.
 * Una ricorrenza senza data esplicita valorizza `date` col PRIMO
 * giorno previsto (oggi incluso): la regola detta il ritmo, la data
 * la prima occorrenza.
 */
export type ParseResult = {
  title: string;
  date?: IsoDate;
  time?: Hhmm;
  priority?: Priority;
  tags: string[];
  moduleHint?: ModuleHint;
  recurrence?: RecurrenceValue;
  fragments: Fragment[];
};
