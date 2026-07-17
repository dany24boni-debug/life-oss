"use client";

/**
 * Lo schermo di /abitudini — la board del giorno:
 *   1. Navigazione giorno: ieri si modifica, il futuro è sola lettura.
 *   2. Board: una card per abitudine prevista, anello animato + gesto
 *      per specie (spunta / +1 / chips quantità).
 *   3. Starter: con la sola Acqua seminata, tre proposte one-tap.
 *   4. Gestione: crea, riordina (drag dalla maniglia + tastiera),
 *      archivio; la scheda della singola abitudine fa il resto.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Skeleton, cx, useToast } from "@/ui";
import { addDays, formatDayFull } from "@/ui/calendar-core";
import { getDb } from "@/data/db";
import {
  STARTER_HABITS,
  seedWaterHabit,
} from "@/data/habits";
import { appRepos, useHabitBoard, useHabits } from "@/data/hooks";
import type { Habit } from "@/data/schemas";
import {
  HabitIcon,
  IconChevronRight,
  IconGrip,
  IconPlus,
} from "../_components/icons";
import { useToday } from "../_components/tasks/screen-hooks";
import { moveIndex, useRowDrag } from "../gym/use-row-drag";
import { HabitCard } from "./habit-card";
import { CreateHabitSheet, HabitSheet } from "./habit-sheet";
import { canEditDay } from "./logic";

export function AbitudiniScreen() {
  const today = useToday();
  const [day, setDay] = useState<string | null>(null);
  const [openHabitId, setOpenHabitId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // La semina dell'acqua è idempotente e non risuscita: sicura al mount.
  useEffect(() => {
    void seedWaterHabit(getDb());
  }, []);

  const shownDay = day ?? today;
  const editable = canEditDay(shownDay, today);
  const habits = useHabits(true);
  const openHabit =
    habits?.find((h) => h.id === openHabitId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <DayNav day={shownDay} today={today} onChange={setDay} />
      <Board day={shownDay} editable={editable} onOpen={setOpenHabitId} />
      <StarterCard habits={habits} />
      <ManageCard
        habits={habits}
        onOpen={setOpenHabitId}
        onCreate={() => setCreating(true)}
      />
      <HabitSheet
        habit={openHabit}
        today={today}
        onClose={() => setOpenHabitId(null)}
      />
      <CreateHabitSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

/* ── Navigazione giorno ──────────────────────────────────────────────── */

function DayNav({
  day,
  today,
  onChange,
}: {
  day: string;
  today: string;
  onChange: (day: string | null) => void;
}) {
  const isToday = day === today;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Giorno precedente"
          onClick={() => onChange(addDays(day, -1))}
          className="grid h-11 w-11 place-items-center rounded-[var(--em-r-md)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          <IconChevronRight className="rotate-180" />
        </button>
        <button
          type="button"
          aria-label="Giorno successivo"
          onClick={() => onChange(addDays(day, 1))}
          className="grid h-11 w-11 place-items-center rounded-[var(--em-r-md)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          <IconChevronRight />
        </button>
      </div>
      <div className="min-w-0 text-right">
        <p className="em-body truncate font-medium text-[var(--em-text)]">
          {isToday ? "Oggi" : formatDayFull(day)}
        </p>
        {day > today ? (
          <p className="em-body-sm text-[var(--em-text-3)]">
            Giorno futuro: sola lettura.
          </p>
        ) : !isToday ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="em-body-sm text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
          >
            Torna a oggi
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Board del giorno ────────────────────────────────────────────────── */

function Board({
  day,
  editable,
  onOpen,
}: {
  day: string;
  editable: boolean;
  onOpen: (id: string) => void;
}) {
  const board = useHabitBoard(day);

  if (board === undefined) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (board.length === 0) {
    return (
      <EmptyState
        compact
        heading="Niente in programma questo giorno"
        text="Le abitudini previste in altri giorni feriali compariranno al loro turno."
      />
    );
  }
  return (
    <section aria-label="Abitudini del giorno" className="flex flex-col gap-3">
      {board.map((entry) => (
        <HabitCard
          key={entry.habit.id}
          entry={entry}
          date={day}
          editable={editable}
          onOpen={() => onOpen(entry.habit.id)}
        />
      ))}
    </section>
  );
}

/* ── Starter: le tre proposte one-tap ────────────────────────────────── */

function StarterCard({ habits }: { habits: Habit[] | undefined }) {
  const toast = useToast();
  if (habits === undefined) return null;
  // Compare finché la board è solo l'Acqua seminata.
  if (habits.filter((h) => h.archived_at === null).length > 1) return null;

  async function add(index: number) {
    const r = await appRepos().habits.create(STARTER_HABITS[index]);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else toast.show({ message: `"${r.data.name}" aggiunta.`, tone: "success" });
  }

  return (
    <section aria-label="Proposte" className="em-card p-5">
      <p className="em-eyebrow">Inizia da qui</p>
      <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
        L&apos;Acqua c&apos;è già. Un tocco per aggiungere le altre:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STARTER_HABITS.map((starter, i) => (
          <button
            key={starter.name}
            type="button"
            onClick={() => void add(i)}
            className="flex min-h-11 items-center gap-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] px-3 py-2 shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)]"
          >
            <HabitIcon
              icon={starter.icon ?? "spunta"}
              className="text-[var(--em-text-2)]"
            />
            <span className="em-body font-medium text-[var(--em-text)]">
              {starter.name}
            </span>
            <IconPlus className="h-4 w-4 text-[var(--em-text-3)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Gestione: crea, riordina, archivio ──────────────────────────────── */

function ManageCard({
  habits,
  onOpen,
  onCreate,
}: {
  habits: Habit[] | undefined;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const toast = useToast();
  const list = useMemo(() => habits ?? [], [habits]);
  function persistOrder(from: number, to: number) {
    const next = moveIndex(list, from, to).map((h) => h.id);
    void appRepos()
      .habits.reorder(next)
      .then((r) => {
        if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
      });
  }
  const { drag, startDrag, rowTransform, setRowRef } = useRowDrag(
    list.length,
    persistOrder,
  );
  // run-11 P6: la tastiera sulla maniglia ESISTE davvero (il docstring
  // la prometteva dal run-08; ora frecce su/giù = riordino).
  function moveByKey(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    persistOrder(index, to);
  }

  return (
    <section aria-label="Gestione abitudini" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Gestione</p>
        <Button type="button" variant="ghost" size="sm" onClick={onCreate}>
          + Nuova abitudine
        </Button>
      </div>
      {habits === undefined ? (
        <div aria-busy="true" className="mt-3">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          compact
          heading="Nessuna abitudine"
          text="Crea la prima: un nome basta, il resto si aggiusta dopo."
        />
      ) : (
        <ul className="mt-2 flex flex-col">
          {list.map((habit, index) => (
            <li
              key={habit.id}
              ref={setRowRef(index)}
              style={{ transform: rowTransform(index) }}
              className={cx(
                "flex items-center gap-2 border-b border-[var(--em-hairline)] last:border-b-0",
                drag && drag.from === index && "relative z-10",
                drag &&
                  drag.from !== index &&
                  "transition-transform duration-[var(--em-dur-control)]",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                aria-label={`Riordina ${habit.name}: trascina, o frecce su e giù`}
                onPointerDown={(e) => startDrag(index, e)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    moveByKey(index, -1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    moveByKey(index, 1);
                  }
                }}
                className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-[var(--em-text-3)]"
              >
                <IconGrip />
              </span>
              <button
                type="button"
                onClick={() => onOpen(habit.id)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
              >
                <HabitIcon
                  icon={habit.icon}
                  className="shrink-0 text-[var(--em-text-2)]"
                />
                <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
                  {habit.name}
                </span>
                {habit.archived_at !== null ? (
                  <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)]">
                    archiviata
                  </span>
                ) : null}
                <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
