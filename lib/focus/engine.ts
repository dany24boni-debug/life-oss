/**
 * Motore del timer focus (run-08 prompt 5) — PURO, senza I/O né clock
 * proprio: ogni funzione riceve `now` (ms epoch) e restituisce stato
 * nuovo. Il timer è wake/reload-safe PER COSTRUZIONE: lo stato
 * persistito è {fase, started_at, elapsed_ms, duration_ms, config} e il
 * tempo mostrato è sempre la DIFFERENZA da `now` — mai un contatore che
 * ticchetta in memoria.
 *
 * Rollover (documentato, testato):
 *   - a fase finita con scarto piccolo (tab aperta che ticchetta) la
 *     fase successiva parte IN CORSA dall'istante esatto di fine — zero
 *     deriva tra fasi;
 *   - al rientro dopo un'assenza (blocco schermo, reload) si avanza di
 *     UNA fase e la successiva parte IN PAUSA: non fingiamo pomodori
 *     mai fatti — il chime e il toast suonano al rientro.
 *   - una fase di LAVORO conclusa riporta i suoi minuti: il chiamante
 *     li logga come FocusSession (data/).
 */

export type FocusPhase = "work" | "break" | "long_break";

export type FocusConfig = {
  /** Minuti di lavoro (default 25). */
  work_min: number;
  /** Minuti di pausa breve (default 5). */
  break_min: number;
  /** Minuti di pausa lunga (default 15). */
  long_break_min: number;
  /** Cicli di lavoro prima della pausa lunga (default 4). */
  cycles: number;
};

export const DEFAULT_CONFIG: FocusConfig = {
  work_min: 25,
  break_min: 5,
  long_break_min: 15,
  cycles: 4,
};

export const FOCUS_PRESETS: ReadonlyArray<{
  name: string;
  config: FocusConfig;
}> = [
  { name: "Classico 25/5", config: DEFAULT_CONFIG },
  {
    name: "Profondo 50/10",
    config: { work_min: 50, break_min: 10, long_break_min: 20, cycles: 3 },
  },
  {
    name: "Leggero 15/3",
    config: { work_min: 15, break_min: 3, long_break_min: 9, cycles: 4 },
  },
];

export type FocusState = {
  config: FocusConfig;
  phase: FocusPhase;
  /** Ciclo di lavoro corrente, 1-based (1..config.cycles). */
  cycle: number;
  /** ms epoch di (ri)partenza; null quando in pausa o mai partito. */
  started_at: number | null;
  /** ms già maturati prima dell'ultima (ri)partenza. */
  elapsed_ms: number;
  /** Durata della fase in ms (config + aggiustamenti live ±1'). */
  duration_ms: number;
  running: boolean;
};

const MIN = 60_000;
/** Tetto della durata di fase (2 ore): l'aggiustamento live non sfugge. */
const MAX_PHASE_MS = 120 * MIN;
/** Scarto oltre il quale il rollover è "al rientro" (pausa, non corsa). */
const CHAIN_GRACE_MS = 60_000;

/** Dominio onesto della config (steppers UI: 1..120 / cicli 1..12). */
export function clampConfig(config: FocusConfig): FocusConfig {
  const int = (n: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Math.round(n)));
  return {
    work_min: int(config.work_min, 1, 120),
    break_min: int(config.break_min, 1, 60),
    long_break_min: int(config.long_break_min, 1, 90),
    cycles: int(config.cycles, 1, 12),
  };
}

function phaseMinutes(config: FocusConfig, phase: FocusPhase): number {
  if (phase === "work") return config.work_min;
  if (phase === "break") return config.break_min;
  return config.long_break_min;
}

export function initialState(config: FocusConfig = DEFAULT_CONFIG): FocusState {
  const clamped = clampConfig(config);
  return {
    config: clamped,
    phase: "work",
    cycle: 1,
    started_at: null,
    elapsed_ms: 0,
    duration_ms: clamped.work_min * MIN,
    running: false,
  };
}

/** ms maturati della fase, adesso. */
export function elapsedMs(state: FocusState, now: number): number {
  const live =
    state.running && state.started_at !== null ? now - state.started_at : 0;
  return Math.max(0, state.elapsed_ms + Math.max(0, live));
}

/** ms che mancano alla fine della fase, adesso (mai negativi). */
export function remainingMs(state: FocusState, now: number): number {
  return Math.max(0, state.duration_ms - elapsedMs(state, now));
}

export function start(state: FocusState, now: number): FocusState {
  if (state.running) return state;
  return { ...state, running: true, started_at: now };
}

export function pause(state: FocusState, now: number): FocusState {
  if (!state.running || state.started_at === null) return state;
  return {
    ...state,
    running: false,
    started_at: null,
    elapsed_ms: elapsedMs(state, now),
  };
}

/**
 * Aggiustamento live ±minuti: cambia la DURATA della fase in corsa
 * ("posso mettere più tempo, meno tempo"). Non scende mai sotto il
 * tempo già maturato (la fase finirebbe retroattivamente) né sotto 1'.
 */
export function adjustMinutes(
  state: FocusState,
  deltaMin: number,
  now: number,
): FocusState {
  const floor = Math.max(MIN, elapsedMs(state, now));
  const duration = Math.min(
    MAX_PHASE_MS,
    Math.max(floor, state.duration_ms + deltaMin * MIN),
  );
  return { ...state, duration_ms: duration };
}

/** La fase che segue, coi suoi contatori. */
function nextPhaseOf(state: FocusState): { phase: FocusPhase; cycle: number } {
  if (state.phase === "work") {
    return state.cycle >= state.config.cycles
      ? { phase: "long_break", cycle: state.cycle }
      : { phase: "break", cycle: state.cycle };
  }
  if (state.phase === "break") {
    return { phase: "work", cycle: state.cycle + 1 };
  }
  return { phase: "work", cycle: 1 }; // dopo la pausa lunga si riparte
}

export type PhaseEnd = {
  /** La fase appena conclusa. */
  phase: FocusPhase;
  /** Minuti CONCLUSI della fase (per il log delle fasi di lavoro). */
  minutes: number;
};

export type AdvanceResult = { state: FocusState; ended: PhaseEnd };

/**
 * Chiude la fase corrente e apre la successiva. `now` decide il modo:
 * scarto piccolo = la prossima parte in corsa dall'istante esatto di
 * fine; scarto grande (rientro) = parte in pausa. Con `forcePaused`
 * (skip manuale a piacere) la prossima parte comunque in pausa.
 */
export function advance(
  state: FocusState,
  now: number,
  opts?: { forcePaused?: boolean },
): AdvanceResult {
  const overshoot = elapsedMs(state, now) - state.duration_ms;
  const endedAt = overshoot >= 0 ? now - overshoot : now;
  const chain =
    !opts?.forcePaused && overshoot >= 0 && overshoot < CHAIN_GRACE_MS &&
    state.running;
  const next = nextPhaseOf(state);
  const nextState: FocusState = {
    ...state,
    phase: next.phase,
    cycle: next.cycle,
    duration_ms: phaseMinutes(state.config, next.phase) * MIN,
    elapsed_ms: 0,
    started_at: chain ? endedAt : null,
    running: chain,
  };
  // Minuti CONCLUSI: la durata a fase finita; il tempo maturato se si
  // salta prima (uno skip a metà lavoro logga i minuti veri, mai finti).
  const doneMs = Math.min(elapsedMs(state, now), state.duration_ms);
  return {
    state: nextState,
    ended: { phase: state.phase, minutes: Math.floor(doneMs / MIN) },
  };
}

/**
 * Un giro dell'orologio (tick del vivo E rientro da reload/lock):
 * se la fase in corsa è finita avanza di UNA fase — con lo scarto a
 * decidere corsa/pausa — altrimenti non tocca nulla.
 */
export function tick(
  state: FocusState,
  now: number,
): { state: FocusState; ended: PhaseEnd | null } {
  if (!state.running || remainingMs(state, now) > 0) {
    return { state, ended: null };
  }
  const r = advance(state, now);
  return { state: r.state, ended: r.ended };
}

/** Torna all'inizio (lavoro, ciclo 1) con la config data, fermo. */
export function reset(config: FocusConfig): FocusState {
  return initialState(config);
}

/** Cambia config: vale dalla PROSSIMA fase; quella in corsa non salta. */
export function withConfig(state: FocusState, config: FocusConfig): FocusState {
  return { ...state, config: clampConfig(config) };
}

/* ── Persistenza difensiva (localStorage del chiamante) ──────────────── */

/** Ricostruisce uno stato da JSON sconosciuto; null = riparti da zero. */
export function parseState(raw: unknown): FocusState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const num = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const phase = s.phase;
  if (phase !== "work" && phase !== "break" && phase !== "long_break") {
    return null;
  }
  const c = s.config as Record<string, unknown> | undefined;
  if (
    !c ||
    !num(c.work_min) ||
    !num(c.break_min) ||
    !num(c.long_break_min) ||
    !num(c.cycles)
  ) {
    return null;
  }
  if (!num(s.cycle) || !num(s.elapsed_ms) || !num(s.duration_ms)) return null;
  if (s.started_at !== null && !num(s.started_at)) return null;
  if (typeof s.running !== "boolean") return null;
  const config = clampConfig({
    work_min: c.work_min,
    break_min: c.break_min,
    long_break_min: c.long_break_min,
    cycles: c.cycles,
  });
  return {
    config,
    phase,
    cycle: Math.max(1, Math.min(config.cycles, Math.round(s.cycle))),
    started_at: s.started_at === null ? null : (s.started_at as number),
    elapsed_ms: Math.max(0, s.elapsed_ms),
    duration_ms: Math.max(MIN, Math.min(MAX_PHASE_MS, s.duration_ms)),
    running: s.running && s.started_at !== null,
  };
}

/** "24:59" — mm:ss del tempo rimanente (per il ring e il titolo). */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Etichetta italiana della fase. */
export function phaseLabel(phase: FocusPhase): string {
  if (phase === "work") return "Lavoro";
  if (phase === "break") return "Pausa";
  return "Pausa lunga";
}
