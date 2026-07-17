"use client";

/**
 * Il CORPO del rituale del mattino (run-11 P2, CROSS-03/WOW-10) —
 * caricato on-demand dalla shell `today-ritual.tsx` SOLO quando la card
 * va mostrata (budget chunk di Oggi: una giornata già pianificata o
 * congedata non paga questi byte). Quattro passi Sunsama-lite in una
 * card: rollover (arretrati → Oggi / Più avanti / lascia, tutto
 * undoabile) → stime rapide (15/30/60/90, mai obbligatorie) → ordine
 * (drag + frecce + tastiera sulla maniglia) → capacità (stime vs tempo
 * libero dall'agenda, riga gentile mai bloccante). Ogni passo è
 * saltabile con "Avanti"; chiusa a metà tiene ciò che è già fatto. Lo
 * stamp "giornata pianificata" alimenta la riga del brief (P5c).
 */

import { useState } from "react";
import { Button, cx, Skeleton, useToast } from "@/ui";
import { useEventsRange, useOverdueTasks, useTasks } from "@/data/hooks";
import type { Task } from "@/data/schemas";
import { buildDayAgenda, type GoogleAgendaEvent } from "../../calendar/agenda";
import { hhmmToMinutes } from "../../settimana/logic";
import { moveIndex, useRowDrag } from "../../gym/use-row-drag";
import { useTaskActions } from "../tasks/actions";
import { dayHeading, laterRange } from "../tasks/logic";
import { useNowHhmm } from "../today-adesso";
import { formatMin } from "../format-min";
import {
  busyBlocksFromAgenda,
  capacityLine,
  freeMinutes,
  RITUAL_ESTIMATE_CHOICES,
  ritualSteps,
  sumEstimates,
  visibleRollover,
  type RitualStepKey,
} from "./ritual-logic";
import { updateRitualDay } from "./ritual-store";

const STEP_TITLES: Record<RitualStepKey, string> = {
  rollover: "Da ieri",
  lista: "La lista di oggi",
  ordine: "In che ordine",
  capacita: "Capacità",
};

export default function RitualBody({
  today,
  google,
}: {
  today: string;
  google: readonly GoogleAgendaEvent[];
}) {
  const overdue = useOverdueTasks(today);
  const todays = useTasks(today);
  const events = useEventsRange(today, today);
  const nowHhmm = useNowHhmm();
  const toast = useToast();

  const [stepChoice, setStepChoice] = useState<RitualStepKey | null>(null);
  const [leftIds, setLeftIds] = useState<ReadonlySet<string>>(new Set());
  // "Toccato" = almeno una mutazione vera (spostamento, stima, ordine):
  // chiudere dopo aver agito è un piano parziale e vale lo stamp.
  const [touched, setTouched] = useState(false);

  // La visibilità (congedo/pianificato/idratazione) è della shell; qui
  // resta il gate sui dati non ancora pronti — skeleton nella cornice
  // della card, mai un pop-in (run-11 P6).
  if (overdue === undefined || todays === undefined || events === undefined) {
    return (
      <section
        aria-label="Pianifica la giornata"
        aria-busy="true"
        className="em-card p-5"
      >
        <p className="em-eyebrow">Pianifica la giornata</p>
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      </section>
    );
  }

  const openToday = todays.filter((t) => t.status === "open");
  const rollover = visibleRollover(overdue, leftIds);
  const steps = ritualSteps(rollover.length, openToday.length);
  // Il passo scelto vale finché esiste; sparito (es. ultimo arretrato
  // deciso), si scivola avanti sul primo disponibile — mai un vicolo.
  const step =
    stepChoice !== null && steps.includes(stepChoice) ? stepChoice : steps[0];
  const stepIx = steps.indexOf(step);

  const busy = busyBlocksFromAgenda(
    buildDayAgenda(today, { events, tasks: [], google }),
  );
  const free = freeMinutes(hhmmToMinutes(nowHhmm), busy);
  const estimated = sumEstimates(openToday);

  function markTouched(): void {
    if (!touched) setTouched(true);
  }

  function stampPlanned(): void {
    updateRitualDay(today, {
      planned_at: new Date().toISOString(),
      tasks_planned: openToday.length,
      estimated_min: estimated,
      free_min: free,
    });
  }

  function finish(): void {
    stampPlanned();
    toast.show({
      message: "Giornata pianificata.",
      tone: "success",
      action: {
        label: "Annulla",
        onClick: () =>
          updateRitualDay(today, {
            planned_at: undefined,
            tasks_planned: undefined,
            estimated_min: undefined,
            free_min: undefined,
          }),
      },
    });
  }

  function dismiss(): void {
    // "Non oggi" dopo aver agito = piano parziale: vale lo stamp (il
    // brief lo dirà comunque); senza aver toccato nulla è solo congedo.
    if (touched) stampPlanned();
    updateRitualDay(today, { dismissed: true });
  }

  function advance(): void {
    const next = steps[stepIx + 1];
    if (next !== undefined) setStepChoice(next);
    else finish();
  }

  return (
    <section aria-label="Pianifica la giornata" className="em-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="em-eyebrow">Pianifica la giornata</p>
        <button
          type="button"
          onClick={dismiss}
          className="em-body-sm min-h-11 text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Non oggi
        </button>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="em-body font-medium text-[var(--em-text)]">
          {STEP_TITLES[step]}
        </h2>
        <p className="em-body-sm text-[var(--em-text-3)]">
          {stepIx + 1} di {steps.length}
        </p>
      </div>

      <div className="mt-3">
        {step === "rollover" ? (
          <RolloverStep
            tasks={rollover}
            today={today}
            onLeave={(id) => {
              setLeftIds(new Set([...leftIds, id]));
            }}
            onAct={markTouched}
          />
        ) : null}
        {step === "lista" ? (
          <ListaStep tasks={openToday} onAct={markTouched} />
        ) : null}
        {step === "ordine" ? (
          <OrdineStep tasks={openToday} onAct={markTouched} />
        ) : null}
        {step === "capacita" ? (
          <CapacitaStep
            openCount={openToday.length}
            busyCount={busy.length}
            estimatedMin={estimated}
            freeMin={free}
          />
        ) : null}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant={stepIx === steps.length - 1 ? "primary" : "secondary"}
          size="sm"
          onClick={advance}
        >
          {stepIx === steps.length - 1 ? "Fatto" : "Avanti"}
        </Button>
      </div>
    </section>
  );
}

/* ── Passo 1 · Rollover ──────────────────────────────────────────────── */

function RolloverStep({
  tasks,
  today,
  onLeave,
  onAct,
}: {
  tasks: readonly Task[];
  today: string;
  onLeave: (id: string) => void;
  onAct: () => void;
}) {
  const actions = useTaskActions();
  const laterDay = laterRange(today).from;
  return (
    <div>
      <p className="em-body-sm text-[var(--em-text-3)]">
        {tasks.length === 1
          ? "1 task rimasto indietro: decidi tu."
          : `${tasks.length} task rimasti indietro: decidi tu.`}
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-[var(--em-hairline)]">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="em-body-sm truncate text-[var(--em-text)]">
                {t.title}
              </p>
              {t.date !== null ? (
                <p className="em-body-sm text-[var(--em-text-3)]">
                  {dayHeading(t.date, today)}
                </p>
              ) : null}
            </div>
            <RolloverAction
              label="Oggi"
              onClick={() => {
                onAct();
                void actions.snooze(t, { day: today }, today);
              }}
            />
            <RolloverAction
              label="Più avanti"
              onClick={() => {
                onAct();
                void actions.snooze(t, { day: laterDay }, today);
              }}
            />
            <RolloverAction label="Lascia" onClick={() => onLeave(t.id)} />
          </li>
        ))}
      </ul>
      {tasks.length > 1 ? (
        <button
          type="button"
          onClick={() => {
            onAct();
            void actions.moveAllToToday([...tasks], today);
          }}
          className="em-body-sm mt-2 min-h-11 font-medium text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Porta tutte a oggi
        </button>
      ) : null}
    </div>
  );
}

function RolloverAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="em-body-sm min-h-11 shrink-0 rounded-full bg-[var(--em-surface-2)] px-2.5 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
    >
      {label}
    </button>
  );
}

/* ── Passo 2 · Lista + stime ─────────────────────────────────────────── */

function ListaStep({
  tasks,
  onAct,
}: {
  tasks: readonly Task[];
  onAct: () => void;
}) {
  const actions = useTaskActions();
  const total = sumEstimates(tasks);
  if (tasks.length === 0) {
    return (
      <p className="em-body-sm text-[var(--em-text-3)]">
        Nessun task per oggi. Aggiungine uno dal FAB qui sotto, o goditi il
        vuoto.
      </p>
    );
  }
  return (
    <div>
      <p className="em-body-sm text-[var(--em-text-3)]">
        Quanto tempo vuoi dargli? Le stime sono facoltative.
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-[var(--em-hairline)]">
        {tasks.map((t) => (
          <li key={t.id} className="py-2">
            <p className="em-body-sm truncate text-[var(--em-text)]">
              {t.title}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {RITUAL_ESTIMATE_CHOICES.map((v) => {
                const active = t.estimate_min === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onAct();
                      // Tap sulla stima attiva = toglierla (il chip è il
                      // proprio undo, come l'EnergyPicker di Sera).
                      void actions.patch(t.id, {
                        estimate_min: active ? null : v,
                      });
                    }}
                    className={cx(
                      "em-body-sm h-11 rounded-full px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
                      active
                        ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                        : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
                    )}
                  >
                    {formatMin(v)}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {total > 0 ? (
        <p className="em-body-sm mt-2 text-[var(--em-text-2)]">
          Stimati: {formatMin(total)}
        </p>
      ) : null}
    </div>
  );
}

/* ── Passo 3 · Ordine (playlist) ─────────────────────────────────────── */

function OrdineStep({
  tasks,
  onAct,
}: {
  tasks: readonly Task[];
  onAct: () => void;
}) {
  const actions = useTaskActions();
  const { drag, startDrag, rowTransform, setRowRef } = useRowDrag(
    tasks.length,
    (from, to) => {
      onAct();
      void actions.reorder(moveIndex(tasks.map((t) => t.id), from, to));
    },
  );

  function move(index: number, delta: -1 | 1): void {
    const to = index + delta;
    if (to < 0 || to >= tasks.length) return;
    onAct();
    void actions.reorder(moveIndex(tasks.map((t) => t.id), index, to));
  }

  return (
    <div>
      <p className="em-body-sm text-[var(--em-text-3)]">
        Nell&apos;ordine in cui li farai: trascina dalla maniglia o usa le
        frecce.
      </p>
      <ul className="mt-2 flex flex-col">
        {tasks.map((t, i) => (
          <li
            key={t.id}
            ref={setRowRef(i)}
            style={{ transform: rowTransform(i) }}
            className={cx(
              "flex items-center gap-1 border-b border-[var(--em-hairline)] py-1.5 last:border-b-0",
              drag !== null && drag.from === i
                ? "relative z-10 bg-[var(--em-surface)]"
                : drag !== null
                  ? "transition-transform duration-[var(--em-dur-control)]"
                  : undefined,
            )}
          >
            <span
              role="button"
              tabIndex={0}
              aria-label={`Riordina ${t.title}: trascina, o frecce su e giù`}
              onPointerDown={(e) => startDrag(i, e)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, -1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, 1);
                }
              }}
              className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-[var(--em-text-3)]"
            >
              <GripDots />
            </span>
            <p className="em-body-sm min-w-0 flex-1 truncate text-[var(--em-text)]">
              {t.title}
            </p>
            {t.estimate_min !== null ? (
              <span className="em-body-sm shrink-0 text-[var(--em-text-3)]">
                {formatMin(t.estimate_min)}
              </span>
            ) : null}
            <ArrowNudge
              label={`Sposta su ${t.title}`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              dir="up"
            />
            <ArrowNudge
              label={`Sposta giù ${t.title}`}
              disabled={i === tasks.length - 1}
              onClick={() => move(i, 1)}
              dir="down"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GripDots() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      {[2, 8].map((x) =>
        [2, 8, 14].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

function ArrowNudge({
  label,
  disabled,
  onClick,
  dir,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  dir: "up" | "down";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-8 shrink-0 place-items-center text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] disabled:opacity-35"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d={dir === "up" ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ── Passo 4 · Capacità ──────────────────────────────────────────────── */

function CapacitaStep({
  openCount,
  busyCount,
  estimatedMin,
  freeMin,
}: {
  openCount: number;
  busyCount: number;
  estimatedMin: number;
  freeMin: number;
}) {
  const line = capacityLine(estimatedMin, freeMin);
  return (
    <div>
      <p className="em-body-sm text-[var(--em-text-2)]">
        Oggi: {openCount === 1 ? "1 task" : `${openCount} task`} ·{" "}
        {busyCount === 1 ? "1 evento con orario" : `${busyCount} eventi con orario`}
        .
      </p>
      {line !== null ? (
        <p
          className={cx(
            "em-body mt-1",
            line.over ? "text-[var(--em-text)]" : "text-[var(--em-text-2)]",
          )}
        >
          {line.text}
          {line.over ? " Qualcosa può aspettare domani." : ""}
        </p>
      ) : (
        <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
          Senza stime il conto resta a task: ~{formatMin(freeMin)} libere da
          adesso.
        </p>
      )}
    </div>
  );
}
