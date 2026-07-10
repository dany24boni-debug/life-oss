"use client";

/**
 * Menu snooze "Sposta a…" (B2.1): opzioni rapide con anteprima del giorno
 * di destinazione + calendario Ember per la data libera. BottomSheet su
 * touch, Modal su desktop. Nessun controllo nativo.
 */

import { useState } from "react";
import { BottomSheet, Calendar, Modal, cx } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import type { Task } from "@/data/schemas";
import type { TaskActions } from "./actions";
import {
  dayHeading,
  SNOOZE_LABELS,
  snoozeDate,
  type SnoozeOption,
} from "./logic";
import { useIsDesktop } from "./screen-hooks";

const OPTIONS: SnoozeOption[] = [
  "stasera",
  "domani",
  "weekend",
  "prossima_settimana",
];

export function SnoozeMenu({
  task,
  today,
  actions,
  onClose,
}: {
  task: Task | null;
  today: DayString;
  actions: TaskActions;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [showCalendar, setShowCalendar] = useState(false);

  if (!task) return null;

  function close() {
    setShowCalendar(false);
    onClose();
  }

  function pick(option: SnoozeOption) {
    if (!task) return;
    void actions.snooze(task, option, today);
    close();
  }

  function pickDay(day: DayString | null) {
    if (!task || !day) return;
    void actions.snooze(task, { day }, today);
    close();
  }

  const body = (
    <div className="flex flex-col gap-1 pb-2">
      {OPTIONS.map((option) => {
        const target = snoozeDate(option, today);
        return (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            className="flex min-h-[var(--em-tap-min)] items-center justify-between gap-3 rounded-[var(--em-r-md)] px-3 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)]"
          >
            <span className="em-body text-[var(--em-text)]">
              {SNOOZE_LABELS[option]}
            </span>
            <span className="em-body-sm em-num text-[var(--em-text-3)]">
              {dayHeading(target, today).toLowerCase()}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        aria-expanded={showCalendar}
        onClick={() => setShowCalendar((s) => !s)}
        className={cx(
          "flex min-h-[var(--em-tap-min)] items-center justify-between gap-3 rounded-[var(--em-r-md)] px-3 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)]",
          showCalendar && "bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]",
        )}
      >
        <span className="em-body text-[var(--em-text)]">Scegli data</span>
        <span className="em-body-sm text-[var(--em-text-3)]">
          {showCalendar ? "chiudi" : "calendario"}
        </span>
      </button>

      {showCalendar ? (
        <div className="mt-1 rounded-[var(--em-r-lg)] bg-[var(--em-surface)] p-3">
          <Calendar value={task.date} min={today} onChange={pickDay} />
        </div>
      ) : null}
    </div>
  );

  const title = "Sposta a";

  return isDesktop ? (
    <Modal open onClose={close} title={title}>
      {body}
    </Modal>
  ) : (
    <BottomSheet open onClose={close} title={title}>
      {body}
    </BottomSheet>
  );
}
