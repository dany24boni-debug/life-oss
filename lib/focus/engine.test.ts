import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  adjustMinutes,
  advance,
  clampConfig,
  elapsedMs,
  formatRemaining,
  initialState,
  parseState,
  pause,
  remainingMs,
  reset,
  start,
  tick,
  withConfig,
} from "./engine";

const T0 = 1_800_000_000_000; // un istante qualsiasi (ms epoch)
const MIN = 60_000;

describe("focus engine — partenza, pausa, differenza da now", () => {
  it("lo stato iniziale è lavoro 25', fermo", () => {
    const s = initialState();
    expect(s.phase).toBe("work");
    expect(s.cycle).toBe(1);
    expect(s.running).toBe(false);
    expect(remainingMs(s, T0)).toBe(25 * MIN);
  });

  it("il tempo è SEMPRE la differenza da now (wake-safe per costruzione)", () => {
    const s = start(initialState(), T0);
    // 10 minuti dopo — anche se nel frattempo nessuno ha mai "tickato".
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(elapsedMs(s, T0 + 10 * MIN)).toBe(10 * MIN);
  });

  it("pausa: congela il maturato; la ripresa riparte da lì", () => {
    let s = start(initialState(), T0);
    s = pause(s, T0 + 7 * MIN);
    expect(s.running).toBe(false);
    // Il tempo fermo non scorre.
    expect(remainingMs(s, T0 + 60 * MIN)).toBe(18 * MIN);
    // Riparte: 3 minuti dopo la ripresa sono 10 totali.
    s = start(s, T0 + 60 * MIN);
    expect(elapsedMs(s, T0 + 63 * MIN)).toBe(10 * MIN);
  });

  it("pause/start ridondanti sono no-op", () => {
    const fermo = initialState();
    expect(pause(fermo, T0)).toBe(fermo);
    const inCorsa = start(fermo, T0);
    expect(start(inCorsa, T0 + 1000)).toBe(inCorsa);
  });
});

describe("focus engine — aggiustamento live ±1'", () => {
  it("più tempo e meno tempo cambiano la durata della fase in corsa", () => {
    let s = start(initialState(), T0);
    s = adjustMinutes(s, 1, T0 + MIN);
    expect(remainingMs(s, T0 + MIN)).toBe(25 * MIN); // 26' totali, 1 maturato
    s = adjustMinutes(s, -5, T0 + MIN);
    expect(s.duration_ms).toBe(21 * MIN);
  });

  it("non scende mai sotto il tempo già maturato (né sotto 1')", () => {
    let s = start(initialState(), T0);
    // A 20 minuti maturati, togliere 10' clampa la durata a 20'.
    s = adjustMinutes(s, -10, T0 + 20 * MIN);
    expect(s.duration_ms).toBe(20 * MIN);
    expect(remainingMs(s, T0 + 20 * MIN)).toBe(0);
    // Da fermo a zero maturato: mai sotto il minuto.
    let f = initialState();
    f = adjustMinutes(f, -60, T0);
    expect(f.duration_ms).toBe(MIN);
  });
});

describe("focus engine — rollover di fase", () => {
  it("lavoro → pausa → lavoro, con la pausa lunga a fine giro", () => {
    const config = { ...DEFAULT_CONFIG, cycles: 2 };
    const s = start(initialState(config), T0);
    // Fine lavoro 1 (tab aperta: scarto zero) → pausa in corsa.
    let r = advance(s, T0 + 25 * MIN);
    expect(r.ended).toEqual({ phase: "work", minutes: 25 });
    expect(r.state.phase).toBe("break");
    expect(r.state.running).toBe(true);
    expect(remainingMs(r.state, T0 + 25 * MIN)).toBe(5 * MIN);
    // Fine pausa → lavoro 2.
    r = advance(r.state, T0 + 30 * MIN);
    expect(r.ended.phase).toBe("break");
    expect(r.state.phase).toBe("work");
    expect(r.state.cycle).toBe(2);
    // Fine lavoro 2 (ultimo del giro) → pausa LUNGA.
    r = advance(r.state, T0 + 55 * MIN);
    expect(r.state.phase).toBe("long_break");
    // Fine pausa lunga → si riparte dal ciclo 1.
    r = advance(r.state, T0 + 70 * MIN);
    expect(r.state.phase).toBe("work");
    expect(r.state.cycle).toBe(1);
  });

  it("il rollover in corsa NON deriva: la fase nuova parte dall'istante esatto di fine", () => {
    const s = start(initialState(), T0);
    // Il tick arriva 800ms dopo la fine vera.
    const { state: next } = tick(s, T0 + 25 * MIN + 800);
    expect(next.phase).toBe("break");
    expect(next.running).toBe(true);
    // La pausa è già maturata di 800ms: partita a T0+25'.
    expect(elapsedMs(next, T0 + 25 * MIN + 800)).toBe(800);
  });

  it("tick: prima della fine non tocca nulla; da fermo mai", () => {
    const s = start(initialState(), T0);
    expect(tick(s, T0 + 10 * MIN)).toEqual({ state: s, ended: null });
    const fermo = initialState();
    expect(tick(fermo, T0 + 100 * MIN).ended).toBeNull();
  });

  it("skip manuale: la prossima parte in pausa e i minuti loggati sono quelli VERI", () => {
    const s = start(initialState(), T0);
    const r = advance(s, T0 + 10 * MIN + 30_000, { forcePaused: true });
    expect(r.state.phase).toBe("break");
    expect(r.state.running).toBe(false);
    expect(r.ended).toEqual({ phase: "work", minutes: 10 }); // 10'30" → 10
  });
});

describe("focus engine — rientro da reload/blocco schermo", () => {
  it("al rientro dopo la fine: avanza di UNA fase, in pausa, minuti pieni", () => {
    const s = start(initialState(), T0);
    // Torna dopo 2 ore: il lavoro era finito da un pezzo.
    const { state: next, ended } = tick(s, T0 + 120 * MIN);
    expect(ended).toEqual({ phase: "work", minutes: 25 });
    expect(next.phase).toBe("break");
    expect(next.running).toBe(false); // niente pomodori finti
    expect(next.elapsed_ms).toBe(0);
    // Un secondo tick non avanza ancora (è in pausa).
    expect(tick(next, T0 + 121 * MIN).ended).toBeNull();
  });

  it("reload resume: lo stato persistito si ricostruisce e il tempo torna giusto", () => {
    const s = start(initialState(), T0);
    const persisted = JSON.parse(JSON.stringify(s)) as unknown;
    const revived = parseState(persisted);
    expect(revived).not.toBeNull();
    // 12 minuti dopo il reload il tempo è quello vero.
    expect(remainingMs(revived!, T0 + 12 * MIN)).toBe(13 * MIN);
    expect(revived!.running).toBe(true);
  });

  it("parseState difensivo: spazzatura → null; incoerenze → normalizzate", () => {
    expect(parseState(null)).toBeNull();
    expect(parseState("x")).toBeNull();
    expect(parseState({ phase: "nap" })).toBeNull();
    // running true senza started_at: degradato a fermo.
    const odd = parseState({
      config: DEFAULT_CONFIG,
      phase: "work",
      cycle: 1,
      started_at: null,
      elapsed_ms: 0,
      duration_ms: 25 * MIN,
      running: true,
    });
    expect(odd?.running).toBe(false);
  });
});

describe("focus engine — config e formattazione", () => {
  it("clampConfig tiene i domini onesti; withConfig non tocca la fase in corsa", () => {
    expect(clampConfig({ work_min: 0, break_min: 999, long_break_min: 15, cycles: 0 }))
      .toEqual({ work_min: 1, break_min: 60, long_break_min: 15, cycles: 1 });
    const s = start(initialState(), T0);
    const next = withConfig(s, { ...DEFAULT_CONFIG, work_min: 50 });
    expect(next.duration_ms).toBe(25 * MIN); // la fase in corsa resta
    const after = advance(next, T0 + 25 * MIN);
    const backToWork = advance(after.state, T0 + 30 * MIN);
    expect(backToWork.state.duration_ms).toBe(50 * MIN); // dalla prossima
  });

  it("reset torna a lavoro/ciclo 1 fermo; formatRemaining è mm:ss", () => {
    const s = reset(DEFAULT_CONFIG);
    expect(s.phase).toBe("work");
    expect(s.running).toBe(false);
    expect(formatRemaining(25 * MIN)).toBe("25:00");
    expect(formatRemaining(61_000)).toBe("1:01");
    expect(formatRemaining(999)).toBe("0:01");
  });
});
