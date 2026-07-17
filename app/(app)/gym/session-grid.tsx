"use client";

/**
 * LA GRIGLIA della seduta (run-07 prompt 3) — il foglio, vivo: righe =
 * slot del giorno nei loro gruppi di sezione, N celle per le serie
 * previste; la cella fantasma mostra l'obiettivo ("3–5 @RIR1") e al tap
 * apre il micro-editor — FAST PATH peso (±2,5, prefill dall'ultima
 * volta; nascosto a corpo libero) + reps; "Altro" a un tap (RIR fatto,
 * feeling, recupero reale suggerito dal trascorso) e mai bloccante.
 * Cella confermata = "62,5 × 9" (o "× 12" a corpo libero).
 *
 * Recupero QUIETO: un chip col trascorso dall'ultima serie confermata e
 * il target dello slot accanto ("2:10 / 4'30") — NESSUN countdown, mai.
 * Chime opzionale al raggiungimento (impostazione per-dispositivo,
 * default SPENTA, campanella sul chip).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BottomSheet,
  Button,
  Input,
  Modal,
  Skeleton,
  cx,
  useToast,
} from "@/ui";
import {
  appRepos,
  useExercises,
  useProgramDay,
  useProgramSlots,
  useSessionsByProgramDay,
  useSetsByExercise,
  useSetsBySession,
  useSettings,
} from "@/data/hooks";
import type { GymExercise, GymSession, GymSet } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { EquipmentEditor } from "./equipment-editor";
import { ExercisePicker } from "./exercise-picker";
import { nowInstant, stepReps, stepWeight } from "./logic";
import {
  plateBreakdown,
  type PlateBreakdown,
  type PlateCount,
} from "./plate-math";
import { weightPrCheck } from "./pr";
import { formatRestShort } from "./program-parse";
import {
  buildGridRows,
  doneCellLabel,
  formatElapsed,
  formatKgShort,
  ghostLabel,
  lastDoneSet,
  nextSetNumberInRow,
  parseActualRestInput,
  rirFloorAt,
  parseRirFloors,
  suggestedRestS,
  verdictForSlot,
  verdictLabel,
  type GridRow,
  type Verdict,
} from "./progression";

/**
 * Impostazione per-dispositivo del chime (default SPENTO), fuori da
 * React con l'idioma useSyncExternalStore (pwa-store): niente
 * setState-in-effect, SSR = spento.
 */
const CHIME_KEY = "lifeos.gym.chime";
let chimeCache: boolean | null = null;
const chimeListeners = new Set<() => void>();

function readChime(): boolean {
  if (chimeCache === null) {
    try {
      chimeCache = localStorage.getItem(CHIME_KEY) === "1";
    } catch {
      chimeCache = false;
    }
  }
  return chimeCache;
}

function subscribeChime(listener: () => void): () => void {
  chimeListeners.add(listener);
  return () => chimeListeners.delete(listener);
}

function writeChime(next: boolean): void {
  chimeCache = next;
  try {
    localStorage.setItem(CHIME_KEY, next ? "1" : "0");
  } catch {
    // Senza storage il toggle vale finché la pagina vive.
  }
  for (const listener of [...chimeListeners]) listener();
}

type EditorState = {
  row: GridRow;
  setIndex: number;
  existing: GymSet | null;
  /** Recupero reale suggerito, calcolato AL TAP (trascorso vero). */
  suggestedRestS: number | null;
};

export function SessionGrid({
  session,
  onFinish,
}: {
  session: GymSession;
  /** "Concludi allenamento": il riepilogo vive nello screen padre. */
  onFinish: () => void;
}) {
  const toast = useToast();
  const day = useProgramDay(session.program_day_id);
  const slots = useProgramSlots(session.program_day_id);
  const sets = useSetsBySession(session.id);
  const exercises = useExercises();
  const [pending, setPending] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Il momento PR (run-12): i set che in QUESTA sessione hanno battuto il
  // massimo storico, id → massimo battuto. Stato effimero del log — il
  // marcatore permanente vive nella griglia storica (weightPrSetIds).
  const [prCells, setPrCells] = useState<ReadonlyMap<string, number>>(
    new Map(),
  );

  // Verdetto per slot: l'ultima seduta COMPLETATA di questo giorno
  // (mai quella in corso).
  const daySessions = useSessionsByProgramDay(session.program_day_id);
  const lastCompleted =
    (daySessions ?? []).find(
      (s) => s.id !== session.id && s.finished_at !== null,
    ) ?? null;
  const lastCompletedSets = useSetsBySession(lastCompleted?.id ?? null);

  const byId = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id, e] as const)),
    [exercises],
  );
  const nameOf = (id: string) => byId.get(id)?.name ?? "Esercizio rimosso";

  const rows = useMemo(
    () => buildGridRows(slots ?? [], sets ?? [], pending),
    [slots, sets, pending],
  );

  const verdicts = useMemo(() => {
    const out = new Map<string, Verdict>();
    if (!lastCompleted || lastCompletedSets === undefined) return out;
    const byExercise = new Map<string, GymSet[]>();
    for (const s of lastCompletedSets) {
      const list = byExercise.get(s.exercise_id) ?? [];
      list.push(s);
      byExercise.set(s.exercise_id, list);
    }
    for (const list of byExercise.values()) {
      list.sort((a, b) => a.set_number - b.set_number);
    }
    for (const slot of slots ?? []) {
      const v = verdictForSlot(slot, byExercise.get(slot.exercise_id) ?? []);
      if (v !== null) out.set(slot.id, v);
    }
    return out;
  }, [slots, lastCompleted, lastCompletedSets]);

  function openEditor(row: GridRow, setIndex: number, existing: GymSet | null) {
    setEditor({
      row,
      setIndex,
      existing,
      suggestedRestS: existing
        ? existing.rest_actual_s
        : suggestedRestS(
            lastDoneSet(sets ?? [])?.done_at ?? null,
            nowInstant().ms,
          ),
    });
  }

  async function confirmSet(input: {
    row: GridRow;
    existing: GymSet | null;
    weightKg: number | null;
    reps: number;
    rirDone: number | null;
    feeling: number | null;
    restActualS: number | null;
    /** Massimo storico battuto da questo carico; null = niente PR. */
    prBeaten: number | null;
  }) {
    const repo = appRepos().gym;
    const r = input.existing
      ? await repo.updateSet(input.existing.id, {
          weight_kg: input.weightKg,
          reps: input.reps,
          rir_done: input.rirDone,
          feeling_1_10: input.feeling,
          rest_actual_s: input.restActualS,
        })
      : await repo.addSet({
          session_id: session.id,
          exercise_id: input.row.exerciseId,
          set_number: nextSetNumberInRow(input.row),
          weight_kg: input.weightKg,
          reps: input.reps,
          rir_done: input.rirDone,
          feeling_1_10: input.feeling,
          rest_actual_s: input.restActualS,
          done_at: new Date().toISOString(),
        });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    // PROP-gym-04: il PR si celebra AL SET — chip ember sulla cella +
    // toast col numero battuto. Sobrio, deterministico, zero coriandoli.
    setPrCells((prev) => {
      const next = new Map(prev);
      if (input.prBeaten !== null) next.set(r.data.id, input.prBeaten);
      else next.delete(r.data.id);
      return next;
    });
    if (input.prBeaten !== null && input.weightKg !== null) {
      toast.show({
        message: `PR: ${formatKgShort(input.weightKg)} kg su ${nameOf(input.row.exerciseId)} · prima ${formatKgShort(input.prBeaten)}`,
        tone: "success",
      });
    }
    setEditor(null);
  }

  async function removeSet(existing: GymSet) {
    const r = await appRepos().gym.softDeleteSet(existing.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    setEditor(null);
    // Undo = ricreare la serie identica (il port non ha un restore per i
    // set; i valori sono tutti qui, l'id nuovo è irrilevante per la riga).
    toast.show({
      message: "Serie eliminata.",
      action: {
        label: "Annulla",
        onClick: () => {
          void appRepos().gym.addSet({
            session_id: existing.session_id,
            exercise_id: existing.exercise_id,
            set_number: existing.set_number,
            weight_kg: existing.weight_kg,
            reps: existing.reps,
            rir_done: existing.rir_done,
            rest_actual_s: existing.rest_actual_s,
            feeling_1_10: existing.feeling_1_10,
            done_at: existing.done_at,
          });
        },
      },
    });
  }

  if (
    day === undefined ||
    slots === undefined ||
    sets === undefined ||
    exercises === undefined
  ) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    );
  }

  const last = lastDoneSet(sets);
  const lastRow = last
    ? rows.find((r) =>
        r.cells.some((c) => c.kind === "done" && c.set.id === last.id),
      )
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="em-body font-semibold text-[var(--em-text)]">
            {day ? day.name : "Sessione libera"}
          </p>
          {day?.subtitle ? (
            <p className="em-body-sm truncate text-[var(--em-text-3)]">
              {day.subtitle}
            </p>
          ) : null}
        </div>
        <RestChip
          lastDoneAt={last?.done_at ?? null}
          targetS={lastRow?.slot?.rest_seconds ?? null}
        />
      </div>

      {rows.length === 0 ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Aggiungi il primo esercizio: ogni cella è una serie, il fantasma
          mostra l&apos;obiettivo.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {groupRows(rows).map((group, gi) => (
          <section key={`g:${gi}`} aria-label={group.section ?? "Esercizi"}>
            {group.section !== null ? (
              <p className="em-eyebrow pb-1.5 text-[var(--em-ember-text)]">
                {group.section}
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {group.rows.map((row) => {
                const verdict = row.slot
                  ? (verdicts.get(row.slot.id) ?? null)
                  : null;
                return (
                  <div key={row.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="em-body min-w-0 truncate font-medium text-[var(--em-text)]">
                        {nameOf(row.exerciseId)}
                        {row.slot?.variant ? (
                          <span className="text-[var(--em-text-3)]">
                            {" "}
                            · {row.slot.variant}
                          </span>
                        ) : null}
                      </p>
                      {verdict ? (
                        <span
                          title="Suggerimento, non un ordine."
                          className={cx(
                            "em-eyebrow shrink-0 rounded-full px-2 py-0.5",
                            verdict === "aumenta"
                              ? "bg-[var(--em-ember-tint)] text-[var(--em-ember-text)]"
                              : "bg-[var(--em-surface-2)] text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)]",
                          )}
                        >
                          {verdictLabel(verdict, row.slot?.bodyweight ?? false)}
                          <span className="ml-1 font-normal normal-case opacity-70">
                            sugg.
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.cells.map((cell) => (
                        <button
                          key={cell.setIndex}
                          type="button"
                          onClick={() =>
                            openEditor(
                              row,
                              cell.setIndex,
                              cell.kind === "done" ? cell.set : null,
                            )
                          }
                          className={cx(
                            "em-body-sm em-num h-11 rounded-[var(--em-r-md)] px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
                            cell.kind === "done"
                              ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                              : "bg-[var(--em-surface-2)] text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
                          )}
                          aria-label={
                            cell.kind === "done"
                              ? `Serie ${cell.setIndex + 1} di ${nameOf(row.exerciseId)}: ${doneCellLabel(cell.set)}${prCells.has(cell.set.id) ? " — record personale" : ""} — modifica`
                              : `Registra la serie ${cell.setIndex + 1} di ${nameOf(row.exerciseId)} (obiettivo ${cell.label})`
                          }
                        >
                          {cell.kind === "done"
                            ? doneCellLabel(cell.set)
                            : cell.label}
                          {cell.kind === "done" &&
                          prCells.has(cell.set.id) ? (
                            <span className="ml-1.5 inline-flex items-baseline gap-1">
                              <span
                                className="em-dot em-dot--live"
                                aria-hidden="true"
                              />
                              <span className="em-eyebrow text-[var(--em-ember-text)]">
                                PR
                              </span>
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openEditor(row, row.cells.length, null)}
                        aria-label={`Aggiungi una serie a ${nameOf(row.exerciseId)}`}
                        className="em-body h-11 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] px-3 font-semibold text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
        + Aggiungi esercizio
      </Button>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onFinish}
        disabled={sets.length === 0}
      >
        Concludi allenamento
      </Button>

      <ExercisePicker
        open={pickerOpen}
        allowCreate
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setPickerOpen(false);
          setPending((prev) =>
            prev.includes(e.id) ? prev : [...prev, e.id],
          );
        }}
      />

      <SetEditorSheet
        editor={editor}
        sessionSets={sets}
        exercise={editor ? (byId.get(editor.row.exerciseId) ?? null) : null}
        onClose={() => setEditor(null)}
        onConfirm={confirmSet}
        onRemove={removeSet}
      />
    </div>
  );
}

/** "2×20 + 5 + 2,5" — i dischi di un lato, tagli decrescenti. */
function perSideLabel(perSide: readonly PlateCount[]): string {
  return perSide
    .map((p) =>
      p.count > 1
        ? `${p.count}×${formatKgShort(p.kg)}`
        : formatKgShort(p.kg),
    )
    .join(" + ");
}

/** La riga del calcolatore: esatto, solo bilanciere, o il più vicino. */
function plateLineLabel(b: PlateBreakdown): string {
  if (b.kind === "bar-only") return "Per lato: solo bilanciere";
  if (b.kind === "exact") return `Per lato: ${perSideLabel(b.perSide)}`;
  return `Più vicino: ${formatKgShort(b.totalKg)} kg${
    b.perSide.length > 0
      ? ` (${perSideLabel(b.perSide)} per lato)`
      : " (solo bilanciere)"
  }`;
}

/** Gruppi di sezione sulle righe (consecutivi, come nel builder). */
function groupRows(rows: GridRow[]): Array<{ section: string | null; rows: GridRow[] }> {
  const groups: Array<{ section: string | null; rows: GridRow[] }> = [];
  for (const row of rows) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.section === row.section) {
      lastGroup.rows.push(row);
    } else {
      groups.push({ section: row.section, rows: [row] });
    }
  }
  return groups;
}

/* ── Il chip del recupero: trascorso, MAI countdown ──────────────────── */

function RestChip({
  lastDoneAt,
  targetS,
}: {
  lastDoneAt: string | null;
  targetS: number | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const chime = useSyncExternalStore(subscribeChime, readChime, () => false);
  const chimedFor = useRef<string | null>(null);

  useEffect(() => {
    if (lastDoneAt === null) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const iv = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [lastDoneAt]);

  const elapsedS =
    lastDoneAt === null
      ? null
      : Math.max(0, Math.floor((nowMs - Date.parse(lastDoneAt)) / 1000));

  useEffect(() => {
    if (
      chime &&
      lastDoneAt !== null &&
      targetS !== null &&
      elapsedS !== null &&
      elapsedS >= targetS &&
      chimedFor.current !== lastDoneAt
    ) {
      chimedFor.current = lastDoneAt;
      playChime();
    }
  }, [chime, lastDoneAt, targetS, elapsedS]);

  function toggleChime() {
    writeChime(!chime);
  }

  if (elapsedS === null) return null;
  const over = targetS !== null && elapsedS >= targetS;

  return (
    <div
      className={cx(
        "flex shrink-0 items-center gap-1 rounded-full bg-[var(--em-surface-2)] py-1 pl-3 pr-1 shadow-[0_0_0_1px_var(--em-hairline)]",
      )}
    >
      <span
        aria-label={`Recupero: ${formatElapsed(elapsedS)} trascorsi${targetS !== null ? ` su ${formatRestShort(targetS)} di obiettivo` : ""}`}
        className={cx(
          "em-body-sm em-num font-medium",
          over ? "text-[var(--em-salvia)]" : "text-[var(--em-text-2)]",
        )}
      >
        {formatElapsed(elapsedS)}
        {targetS !== null ? (
          <span className="text-[var(--em-text-3)]"> / {formatRestShort(targetS)}</span>
        ) : null}
      </span>
      <button
        type="button"
        aria-pressed={chime}
        aria-label={
          chime
            ? "Suono a recupero raggiunto: attivo"
            : "Suono a recupero raggiunto: spento"
        }
        onClick={toggleChime}
        className={cx(
          "grid h-9 w-9 place-items-center rounded-full transition-colors duration-[var(--em-dur-tap)]",
          chime
            ? "bg-[var(--em-ember-tint)] text-[var(--em-text)]"
            : "text-[var(--em-text-3)] hover:text-[var(--em-text)]",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
          {chime ? null : <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** Stesso pattern WebAudio dei promemoria: un enhancement, mai la consegna. */
function playChime() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state !== "running") {
      void ctx.close();
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // Niente audio: il chip visivo resta la consegna vera.
  }
}

/* ── Micro-editor della cella ────────────────────────────────────────── */

function SetEditorSheet({
  editor,
  sessionSets,
  exercise,
  onClose,
  onConfirm,
  onRemove,
}: {
  editor: EditorState | null;
  sessionSets: GymSet[];
  exercise: GymExercise | null;
  onClose: () => void;
  onConfirm: (input: {
    row: GridRow;
    existing: GymSet | null;
    weightKg: number | null;
    reps: number;
    rirDone: number | null;
    feeling: number | null;
    restActualS: number | null;
    prBeaten: number | null;
  }) => Promise<void>;
  onRemove: (existing: GymSet) => Promise<void>;
}) {
  const isDesktop = useIsDesktop();
  const open = editor !== null;

  const body = editor ? (
    <SetEditorBody
      key={`${editor.row.key}:${editor.setIndex}:${editor.existing?.id ?? "nuova"}`}
      editor={editor}
      sessionSets={sessionSets}
      onConfirm={onConfirm}
      onRemove={onRemove}
    />
  ) : null;

  const title = editor
    ? `Serie ${editor.setIndex + 1}${exercise ? ` · ${exercise.name}` : ""}`
    : "Serie";

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body ?? <span />}
    </BottomSheet>
  );
}

/**
 * Il caricatore del form: aspetta la storia dell'esercizio (prefill
 * "dall'ultima volta") PRIMA di montare gli stati del form — così il
 * prefill è giusto, non una corsa con la live query. Limite 500 (come la
 * griglia storica): al check PR serve il massimo di TUTTA la storia,
 * non degli ultimi 25 set (run-12).
 */
function SetEditorBody({
  editor,
  sessionSets,
  onConfirm,
  onRemove,
}: {
  editor: EditorState;
  sessionSets: GymSet[];
  onConfirm: (input: {
    row: GridRow;
    existing: GymSet | null;
    weightKg: number | null;
    reps: number;
    rirDone: number | null;
    feeling: number | null;
    restActualS: number | null;
    prBeaten: number | null;
  }) => Promise<void>;
  onRemove: (existing: GymSet) => Promise<void>;
}) {
  const history = useSetsByExercise(editor.row.exerciseId, 500);
  if (history === undefined) return <Skeleton className="h-24 w-full" />;
  return (
    <SetEditorForm
      editor={editor}
      sessionSets={sessionSets}
      history={history}
      onConfirm={onConfirm}
      onRemove={onRemove}
    />
  );
}

function SetEditorForm({
  editor,
  sessionSets,
  history,
  onConfirm,
  onRemove,
}: {
  editor: EditorState;
  sessionSets: GymSet[];
  history: GymSet[];
  onConfirm: (input: {
    row: GridRow;
    existing: GymSet | null;
    weightKg: number | null;
    reps: number;
    rirDone: number | null;
    feeling: number | null;
    restActualS: number | null;
    prBeaten: number | null;
  }) => Promise<void>;
  onRemove: (existing: GymSet) => Promise<void>;
}) {
  const { row, existing, setIndex } = editor;
  const bodyweight = row.slot?.bodyweight ?? false;
  // Profilo attrezzatura (P1): alimenta il plate calculator. La riga
  // settings è una live query da una riga sola — costa nulla.
  const settings = useSettings();
  const [equipOpen, setEquipOpen] = useState(false);

  // Prefill del peso: la serie che si modifica → la cella precedente
  // della riga → l'ultima volta in assoluto (storia dell'esercizio).
  const priorInRow = [...row.cells]
    .slice(0, setIndex)
    .reverse()
    .find((c) => c.kind === "done");
  const lastTime = history.find(
    (s) => !sessionSets.some((cur) => cur.id === s.id),
  );

  const prefillWeight =
    existing?.weight_kg ??
    (priorInRow?.kind === "done" ? priorInRow.set.weight_kg : null) ??
    lastTime?.weight_kg ??
    null;
  const prefillReps =
    existing?.reps ??
    (priorInRow?.kind === "done" ? priorInRow.set.reps : undefined) ??
    lastTime?.reps ??
    8;

  const [weightKg, setWeightKg] = useState<number | null>(
    bodyweight && existing === null ? null : prefillWeight,
  );
  const [reps, setReps] = useState<number>(prefillReps);
  const [rirDone, setRirDone] = useState<number | null>(
    existing?.rir_done ?? null,
  );
  const [feeling, setFeeling] = useState<number | null>(
    existing?.feeling_1_10 ?? null,
  );
  const [restActualS, setRestActualS] = useState<number | null>(
    editor.suggestedRestS,
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const ghost = row.slot ? ghostLabel(row.slot, setIndex) : null;
  const rirFloor = row.slot
    ? rirFloorAt(parseRirFloors(row.slot.target_rir), setIndex)
    : null;

  function confirm() {
    // Il momento PR (run-12): la storia MENO il set che si sta
    // modificando è il "prima"; si celebra solo il battuto stretto.
    const pr = weightPrCheck(
      weightKg,
      history.filter((s) => s.id !== existing?.id),
    );
    void onConfirm({
      row,
      existing,
      weightKg,
      reps,
      rirDone,
      feeling,
      restActualS,
      prBeaten: pr.isPr ? pr.previousKg : null,
    });
  }

  // Deviazione attrezzatura: l'editor del profilo si apre DENTRO lo
  // sheet (swap di contenuto, mai sheet sopra sheet); gli stati del
  // form sopravvivono alla deviazione. Dopo tutti gli hook, per contratto.
  if (equipOpen && settings !== undefined) {
    return (
      <EquipmentEditor
        settings={settings}
        onDone={() => setEquipOpen(false)}
      />
    );
  }

  const plates = (() => {
    if (bodyweight || settings === undefined) return null;
    const bar = settings.gym_bar_kg;
    const owned = settings.gym_plates;
    if (bar === null || owned === null || owned.length === 0) {
      return "setup" as const;
    }
    if (weightKg === null || weightKg <= 0) return null;
    return plateBreakdown(weightKg, bar, owned);
  })();

  return (
    <div className="flex flex-col gap-4">
      {ghost !== null || lastTime !== undefined || plates !== null ? (
        <div className="flex flex-col gap-0.5">
          {ghost ? (
            <p className="em-body-sm text-[var(--em-text-3)]">
              Obiettivo: <span className="em-num">{ghost}</span>
            </p>
          ) : null}
          {/* Il ghost Hevy-style reso VISIBILE (run-10 P4, PROP-gym-02):
              il prefill "dall'ultima volta" c'era già — ora si vede anche
              il numero da battere, confermare è confrontare. */}
          {lastTime ? (
            <p className="em-body-sm text-[var(--em-text-3)]">
              Ultima volta:{" "}
              <span className="em-num text-[var(--em-text-2)]">
                {doneCellLabel(lastTime)}
              </span>
              {lastTime.rir_done !== null ? (
                <span className="em-num"> @RIR{lastTime.rir_done}</span>
              ) : null}
            </p>
          ) : null}
          {/* Plate calculator (run-12, PROP-gym-03): i dischi per lato,
              vivi sul peso corrente; tap = modifica del profilo. Senza
              profilo: solo il link quieto. */}
          {plates === "setup" ? (
            <button
              type="button"
              onClick={() => setEquipOpen(true)}
              className="em-body-sm min-h-11 text-left text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
            >
              Dischi per lato? Imposta bilanciere e dischi
            </button>
          ) : plates !== null ? (
            <button
              type="button"
              onClick={() => setEquipOpen(true)}
              aria-label={`${plateLineLabel(plates)} — modifica bilanciere e dischi`}
              className="em-body-sm min-h-11 text-left text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
            >
              <span className="em-num">{plateLineLabel(plates)}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {!bodyweight ? (
        <BigStepper
          label="Peso"
          display={
            weightKg === null ? "corpo" : `${formatKgShort(weightKg)} kg`
          }
          onMinus={() => setWeightKg((w) => stepWeight(w, -1))}
          onPlus={() => setWeightKg((w) => stepWeight(w, 1))}
        />
      ) : null}

      <BigStepper
        label="Reps"
        display={`× ${reps}`}
        onMinus={() => setReps((r) => stepReps(r, -1))}
        onPlus={() => setReps((r) => stepReps(r, 1))}
      />

      <div>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className="em-body-sm flex min-h-11 items-center gap-1.5 font-medium text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={cx(
              "h-4 w-4 transition-transform duration-[var(--em-dur-control)]",
              moreOpen && "rotate-90",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Altro · RIR, feeling, recupero{bodyweight ? ", zavorra" : ""}
        </button>

        {moreOpen ? (
          <div className="mt-3 flex flex-col gap-4">
            {bodyweight ? (
              <BigStepper
                label="Zavorra (facoltativa)"
                display={
                  weightKg === null ? "—" : `${formatKgShort(weightKg)} kg`
                }
                onMinus={() =>
                  setWeightKg((w) =>
                    w === null ? null : stepWeight(w, -1) || null,
                  )
                }
                onPlus={() => setWeightKg((w) => stepWeight(w, 1))}
              />
            ) : null}

            <ChipRow
              label={`RIR fatto${rirFloor !== null ? ` (obiettivo ≤ ${rirFloor})` : ""}`}
              options={[0, 1, 2, 3, 4, 5]}
              value={rirDone}
              onChange={setRirDone}
            />
            <ChipRow
              label="Feeling (1 pessimo · 10 perfetto)"
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              value={feeling}
              onChange={setFeeling}
            />
            <label className="flex flex-col gap-1.5">
              <span className="em-eyebrow">
                Recupero reale{" "}
                {existing === null && editor.suggestedRestS !== null ? (
                  <span className="normal-case text-[var(--em-text-3)]">
                    (suggerito dal trascorso)
                  </span>
                ) : null}
              </span>
              <Input
                key={`rest:${restActualS ?? ""}`}
                defaultValue={
                  restActualS === null ? "" : formatElapsed(restActualS).replace(":", "'")
                }
                placeholder="2'30"
                inputMode="numeric"
                maxLength={6}
                className="w-32"
                onBlur={(e) =>
                  setRestActualS(parseActualRestInput(e.target.value))
                }
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {existing ? (
          <Button type="button" variant="ghost" onClick={() => void onRemove(existing)}>
            Elimina serie
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="primary" size="lg" onClick={confirm}>
          {existing ? "Salva" : "Conferma serie"}
        </Button>
      </div>
    </div>
  );
}

function BigStepper({
  label,
  display,
  onMinus,
  onPlus,
}: {
  label: string;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="em-eyebrow">{label}</span>
      <div className="flex items-center gap-1">
        <StepBtn ariaLabel={`Meno ${label}`} onClick={onMinus}>
          −
        </StepBtn>
        <span className="em-body em-num w-24 text-center font-semibold text-[var(--em-text)]">
          {display}
        </span>
        <StepBtn ariaLabel={`Più ${label}`} onClick={onPlus}>
          +
        </StepBtn>
      </div>
    </div>
  );
}

function StepBtn({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface)] text-lg font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="em-eyebrow">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(value === opt ? null : opt)}
            className={cx(
              "em-body-sm em-num grid h-11 w-11 place-items-center rounded-full font-medium transition-colors duration-[var(--em-dur-tap)]",
              value === opt
                ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                : "bg-[var(--em-surface)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
