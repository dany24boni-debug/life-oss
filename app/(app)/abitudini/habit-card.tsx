"use client";

/**
 * La card di un'abitudine sulla board del giorno: anello animato +
 * controllo per specie — boolean = spunta grande (tap sull'intera
 * card), counter = tap card +1 con − esplicito, quantity = chips di
 * incremento + totale editabile al tap. L'anello non smonta mai (la
 * transizione CSS sull'arco vive lì); a cambiare con un pop è solo il
 * contenuto al centro. Reduced motion: collasso globale Ember.
 */

import { useState } from "react";
import { ProgressRing, cx, useToast } from "@/ui";
import { appRepos, useHabitStreak } from "@/data/hooks";
import type { HabitBoardEntry } from "@/data/ports";
import type { IsoDay } from "@/data/schemas";
import {
  HabitIcon,
  IconCheck,
  IconDots,
  IconFlame,
} from "../_components/icons";
import {
  formatHabitValue,
  formatValueLine,
  parseValueInput,
  quickSteps,
  ringProgress,
} from "./logic";

export function HabitCard({
  entry,
  date,
  editable,
  onOpen,
}: {
  entry: HabitBoardEntry;
  date: IsoDay;
  editable: boolean;
  onOpen: () => void;
}) {
  const toast = useToast();
  const { habit, target, value, done } = entry;
  const streak = useHabitStreak(habit.id, date);

  /** Annulla del toast: riporta il TOTALE del giorno al valore di prima. */
  function undoTo(previous: number) {
    void appRepos().habits.logDay(habit.id, date, previous);
  }

  async function increment(delta: number, opts?: { withUndo?: boolean }) {
    const previous = value;
    const r = await appRepos().habits.incrementDay(habit.id, date, delta);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    // Undo sui log a un tocco (run-10 P4, PROP-hab-01): il gesto che
    // AGGIUNGE porta l'Annulla; il "−" di correzione resta muto.
    if (opts?.withUndo) {
      toast.show({
        message: `${habit.name}: +${formatHabitValue(delta)}${habit.unit ? ` ${habit.unit}` : ""}.`,
        action: { label: "Annulla", onClick: () => undoTo(previous) },
      });
    }
  }

  async function setValue(next: number, opts?: { withUndo?: boolean }) {
    const previous = value;
    const r = await appRepos().habits.logDay(habit.id, date, next);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    if (opts?.withUndo) {
      toast.show({
        message: `Fatta: ${habit.name}.`,
        action: { label: "Annulla", onClick: () => undoTo(previous) },
      });
    }
  }

  const tapAction =
    !editable || habit.kind === "quantity"
      ? null
      : habit.kind === "boolean"
        ? // Il ri-tap che "s-fa" È l'annullamento: resta muto (pattern
          // del Fatto dieta, run-09).
          () => void setValue(done ? 0 : 1, { withUndo: !done })
        : () => void increment(1, { withUndo: true });

  const tapLabel =
    habit.kind === "boolean"
      ? done
        ? `Segna ${habit.name} come non fatta`
        : `Segna ${habit.name} come fatta`
      : `${habit.name}: più uno`;

  return (
    <div
      className={cx(
        "em-card relative flex items-center gap-4 p-4",
        done && "bg-[color-mix(in_srgb,var(--em-ember)_4%,var(--em-surface))]",
      )}
    >
      {/* Il gesto principale copre la card (boolean/counter). */}
      {tapAction ? (
        <button
          type="button"
          aria-label={tapLabel}
          onClick={tapAction}
          className="absolute inset-0 rounded-[inherit]"
        />
      ) : null}

      <Ring entry={entry} />

      <div className="pointer-events-none min-w-0 flex-1">
        <p className="em-body flex items-center gap-1.5 font-medium text-[var(--em-text)]">
          <span className="truncate">{habit.name}</span>
          {streak !== undefined && streak.current > 0 ? (
            <span
              className={cx(
                "em-body-sm em-num flex shrink-0 items-center gap-0.5",
                streak.todayCounts
                  ? "text-[var(--em-ember-text)]"
                  : "text-[var(--em-text-3)]",
              )}
              title={`Streak: ${streak.current} (migliore ${streak.best})`}
            >
              <IconFlame className="h-3.5 w-3.5" />
              {streak.current}
            </span>
          ) : null}
        </p>
        <p
          className={cx(
            "em-body-sm em-num mt-0.5",
            done ? "text-[var(--em-salvia-text)]" : "text-[var(--em-text-3)]",
          )}
        >
          {habit.kind === "boolean"
            ? done
              ? "Fatta"
              : "Da fare"
            : formatValueLine(value, target, habit.unit)}
        </p>
        {habit.kind === "quantity" && editable ? (
          <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-1.5">
            {quickSteps(habit.unit, target).map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => void increment(step, { withUndo: true })}
                className="em-hit em-body-sm em-num h-8 rounded-full bg-[var(--em-surface-2)] px-2.5 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
              >
                +{formatHabitValue(step)}
              </button>
            ))}
            <TotalEdit value={value} unit={habit.unit} onSet={setValue} />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative flex shrink-0 items-center gap-1">
        {habit.kind === "counter" && editable ? (
          <button
            type="button"
            aria-label={`${habit.name}: meno uno`}
            onClick={() => void increment(-1)}
            disabled={value <= 0}
            className="pointer-events-auto grid h-11 w-11 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)] disabled:opacity-40"
          >
            −
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`Apri ${habit.name}`}
          onClick={onOpen}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          <IconDots />
        </button>
      </div>
    </div>
  );
}

/** Anello 52px con pop del contenuto al centro (mai remount dell'arco). */
function Ring({ entry }: { entry: HabitBoardEntry }) {
  const { habit, target, value, done } = entry;
  return (
    <div className="pointer-events-none relative shrink-0">
      <ProgressRing
        value={ringProgress(value, target) * 100}
        size={52}
        strokeWidth={5}
        tone="ember"
        label={`${habit.name}: ${
          target === null
            ? done
              ? "fatta"
              : "da fare"
            : `${formatHabitValue(value)} su ${formatHabitValue(target)}`
        }`}
      >
        <span
          key={done ? "done" : `v-${value}`}
          className={cx(
            "grid place-items-center animate-[em-pop-in_var(--em-dur-card)_var(--em-ease-out)]",
            done ? "text-[var(--em-ember)]" : "text-[var(--em-text-2)]",
          )}
        >
          {done ? (
            <IconCheck className="h-6 w-6" />
          ) : (
            <HabitIcon icon={habit.icon} className="h-5 w-5" />
          )}
        </span>
      </ProgressRing>
    </div>
  );
}

/** Il totale del giorno, editabile al tap: Invio conferma, Esc annulla. */
function TotalEdit({
  value,
  unit,
  onSet,
}: {
  value: number;
  unit: string | null;
  onSet: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const parsed = parseValueInput(draft);
    setEditing(false);
    if (parsed !== null && parsed !== value) void onSet(parsed);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value === 0 ? "" : String(value).replace(".", ","));
          setEditing(true);
        }}
        className="em-hit em-body-sm h-8 rounded-full px-2 text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
      >
        totale…
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="decimal"
      value={draft}
      placeholder={unit ? `totale in ${unit}` : "totale"}
      aria-label={unit ? `Totale del giorno in ${unit}` : "Totale del giorno"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="em-body-sm em-num h-8 w-24 rounded-full bg-[var(--em-surface-2)] px-3 text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)] outline-none"
    />
  );
}
