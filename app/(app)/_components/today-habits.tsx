"use client";

/**
 * Strip Abitudini su Oggi (run-08 prompt 2): la fila di anelli tra i
 * tile e i task — un colpo d'occhio, un pollice. Tap = log rapido
 * (spunta per le boolean, +1 per i contatori, il chip di mezzo per le
 * quantità: per l'acqua 330 ml); l'acqua sempre per prima. Il resto —
 * chips, totali, gestione — vive su /abitudini.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ProgressRing, Skeleton, cx, useToast } from "@/ui";
import { getDb } from "@/data/db";
import { seedWaterHabit } from "@/data/habits";
import { appRepos, useHabitBoard } from "@/data/hooks";
import type { HabitBoardEntry } from "@/data/ports";
import {
  defaultQuickStep,
  formatHabitValue,
  ringProgress,
  waterFirst,
} from "../abitudini/logic";
import { HabitIcon, IconCheck, IconChevronRight } from "./icons";
import { useToday } from "./tasks/screen-hooks";

export function TodayHabits() {
  const today = useToday();
  const board = useHabitBoard(today);

  useEffect(() => {
    void seedWaterHabit(getDb());
  }, []);

  return (
    <section aria-label="Abitudini" className="em-card p-5">
      <Link
        href="/abitudini"
        className="group flex items-center justify-between gap-2"
      >
        <p className="em-eyebrow">Abitudini</p>
        <IconChevronRight className="text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] group-hover:text-[var(--em-text)]" />
      </Link>
      <div className="mt-3">
        {board === undefined ? (
          <div aria-busy="true" className="flex gap-4">
            <Skeleton className="h-16 w-14" />
            <Skeleton className="h-16 w-14" />
            <Skeleton className="h-16 w-14" />
          </div>
        ) : board.length === 0 ? (
          <p className="em-body-sm text-[var(--em-text-3)]">
            Oggi nessuna abitudine prevista.
          </p>
        ) : (
          <ul className="flex gap-4 overflow-x-auto pb-1">
            {waterFirst(board).map((entry) => (
              <li key={entry.habit.id} className="shrink-0">
                <StripRing entry={entry} today={today} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StripRing({
  entry,
  today,
}: {
  entry: HabitBoardEntry;
  today: string;
}) {
  const toast = useToast();
  const { habit, target, value, done } = entry;

  async function quickLog() {
    const habits = appRepos().habits;
    const r =
      habit.kind === "boolean"
        ? await habits.logDay(habit.id, today, done ? 0 : 1)
        : await habits.incrementDay(
            habit.id,
            today,
            habit.kind === "counter"
              ? 1
              : defaultQuickStep(habit.unit, target),
          );
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  const label =
    habit.kind === "boolean"
      ? done
        ? `${habit.name}: fatta — tocca per annullare`
        : `${habit.name}: segna come fatta`
      : habit.kind === "counter"
        ? `${habit.name}: più uno`
        : `${habit.name}: aggiungi ${formatHabitValue(
            defaultQuickStep(habit.unit, target),
          )}${habit.unit ? ` ${habit.unit}` : ""}`;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void quickLog()}
      className="flex w-14 flex-col items-center gap-1"
    >
      <ProgressRing
        value={ringProgress(value, target) * 100}
        size={48}
        strokeWidth={4.5}
        tone="ember"
        label={label}
      >
        <span
          key={done ? "done" : `v-${value}`}
          className={cx(
            "grid place-items-center animate-[em-pop-in_var(--em-dur-card)_var(--em-ease-out)]",
            done ? "text-[var(--em-ember)]" : "text-[var(--em-text-2)]",
          )}
        >
          {done ? (
            <IconCheck className="h-5 w-5" />
          ) : (
            <HabitIcon icon={habit.icon} className="h-4 w-4" />
          )}
        </span>
      </ProgressRing>
      <span className="em-body-sm w-full truncate text-center text-[var(--em-text-3)]">
        {habit.name}
      </span>
    </button>
  );
}
