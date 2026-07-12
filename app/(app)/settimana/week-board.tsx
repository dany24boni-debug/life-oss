"use client";

/**
 * La BOARD della settimana: lun->dom come card — snap-scroll
 * orizzontale su mobile (oggi centrato al mount), griglia a 7 colonne
 * da md in su. Ogni slot ha il check a un tocco (fatto) e il gesto
 * lungo (saltato); lo slot in corso porta l'ember dot; il fatto ha lo
 * strike quieto. Le settimane future sono anteprima del piano: check
 * spenti, mai finti.
 */

import { useEffect, useRef } from "react";
import { cx, useToast } from "@/ui";
import { appRepos } from "@/data/hooks";
import type { IsoWeek, WeekBoardDay, WeekSlotEntry } from "@/data/planner";
import type { SlotCheckState } from "@/data/schemas";
import { WEEKDAYS_IT } from "@/ui/calendar-core";
import { IconCheck } from "../_components/icons";
import { findNowSlot, nextStateOnLong, nextStateOnTap } from "./logic";

export function WeekBoard({
  board,
  isoWeek,
  today,
  nowHhmm,
  editable,
  onOpenSlot,
}: {
  board: WeekBoardDay[];
  isoWeek: IsoWeek;
  today: string;
  /** "HH:MM" adesso (Europe/Rome), per lo slot in corso. */
  nowHhmm: string;
  /** false = anteprima (settimane future): check spenti. */
  editable: boolean;
  onOpenSlot?: (entry: WeekSlotEntry) => void;
}) {
  const todayRef = useRef<HTMLElement | null>(null);

  // Oggi centrato al mount e al cambio settimana (solo mobile: su
  // desktop c'è tutta la griglia).
  useEffect(() => {
    void isoWeek;
    todayRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [isoWeek]);

  return (
    <div
      className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-7 md:gap-2 md:overflow-visible md:px-0"
      role="list"
      aria-label="Giorni della settimana"
    >
      {board.map((day) => {
        const isToday = day.date === today;
        const now = isToday ? findNowSlot(day.slots, nowHhmm) : null;
        return (
          <section
            key={day.date}
            role="listitem"
            ref={isToday ? todayRef : undefined}
            aria-label={`${WEEKDAY_LONG[day.weekday - 1]} ${day.date}`}
            className={cx(
              "em-card w-[78%] shrink-0 snap-center p-3 md:w-auto md:shrink",
              isToday && "shadow-[0_0_0_1.5px_var(--em-hairline-strong)]",
            )}
          >
            <header className="flex items-baseline justify-between gap-2 border-b border-[var(--em-hairline)] pb-2">
              <span
                className={cx(
                  "em-body-sm font-semibold",
                  isToday ? "text-[var(--em-text)]" : "text-[var(--em-text-2)]",
                )}
              >
                {WEEKDAYS_IT[day.weekday - 1]}
                <span className="em-num ml-1.5 font-normal text-[var(--em-text-3)]">
                  {Number(day.date.slice(8, 10))}
                </span>
              </span>
              {isToday ? (
                <span className="em-dot em-dot--live" aria-hidden="true" />
              ) : null}
            </header>
            {day.slots.length === 0 ? (
              <p className="em-body-sm py-3 text-[var(--em-text-3)]">
                Giorno libero.
              </p>
            ) : (
              <ul className="flex flex-col">
                {day.slots.map((entry) => (
                  <SlotRow
                    key={entry.slot.id}
                    entry={entry}
                    isoWeek={isoWeek}
                    current={now?.currentId === entry.slot.id}
                    editable={editable}
                    onOpen={onOpenSlot ? () => onOpenSlot(entry) : undefined}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const WEEKDAY_LONG = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

/* ── Riga slot con tap + gesto lungo ─────────────────────────────────── */

const LONG_PRESS_MS = 450;

export function SlotRow({
  entry,
  isoWeek,
  current,
  editable,
  onOpen,
}: {
  entry: WeekSlotEntry;
  isoWeek: IsoWeek;
  current: boolean;
  editable: boolean;
  onOpen?: () => void;
}) {
  const toast = useToast();
  const { slot, state } = entry;
  const longFired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function setState(next: SlotCheckState | null) {
    const r = await appRepos().planner.setCheck(slot.id, isoWeek, next);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  function pressStart() {
    if (!editable) return;
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      void setState(nextStateOnLong(state));
    }, LONG_PRESS_MS);
  }

  function pressEnd(commitTap: boolean) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (commitTap && !longFired.current && editable) {
      void setState(nextStateOnTap(state));
    }
  }

  return (
    <li className="flex items-center gap-2 border-b border-[var(--em-hairline)] py-1 last:border-b-0">
      {onOpen ? (
        <button
          type="button"
          aria-label={`Apri ${slot.title}`}
          onClick={onOpen}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <SlotLabel entry={entry} current={current} />
        </button>
      ) : (
        <span className="min-w-0 flex-1 py-1.5">
          <SlotLabel entry={entry} current={current} />
        </span>
      )}
      <button
        type="button"
        disabled={!editable}
        aria-label={
          state === "done"
            ? `${slot.title}: fatto — tocca per annullare`
            : `${slot.title}: segna come fatto (tieni premuto per saltato)`
        }
        aria-pressed={state === "done"}
        onPointerDown={pressStart}
        onPointerUp={() => pressEnd(true)}
        onPointerLeave={() => pressEnd(false)}
        onPointerCancel={() => pressEnd(false)}
        onKeyDown={(e) => {
          if (!editable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void setState(nextStateOnTap(state));
          }
          if (e.key.toLowerCase() === "s") {
            e.preventDefault();
            void setState(nextStateOnLong(state));
          }
        }}
        className={cx(
          "grid h-11 w-11 shrink-0 touch-none select-none place-items-center rounded-[var(--em-r-sm)] transition-colors duration-[var(--em-dur-tap)]",
          !editable && "opacity-35",
        )}
      >
        <span
          className={cx(
            "grid h-6 w-6 place-items-center rounded-full transition-colors duration-[var(--em-dur-tap)]",
            state === "done"
              ? "bg-[var(--em-ember)] text-[var(--em-on-ember)]"
              : state === "skipped"
                ? "border border-dashed border-[var(--em-hairline-strong)] text-[var(--em-text-3)]"
                : "border border-[var(--em-hairline-strong)] text-transparent",
          )}
          aria-hidden="true"
        >
          {state === "done" ? (
            <IconCheck className="h-3.5 w-3.5" />
          ) : state === "skipped" ? (
            <span className="text-[10px] font-semibold leading-none">–</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function SlotLabel({
  entry,
  current,
}: {
  entry: WeekSlotEntry;
  current: boolean;
}) {
  const { slot, state } = entry;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {current ? (
        <span
          className="em-dot em-dot--live shrink-0"
          aria-hidden="true"
          title="In corso adesso"
        />
      ) : null}
      <span
        className={cx(
          "em-body-sm em-num shrink-0",
          current ? "text-[var(--em-text)]" : "text-[var(--em-text-3)]",
        )}
      >
        {slot.start_hhmm}
      </span>
      <span
        className={cx(
          "em-body-sm min-w-0 truncate",
          state === "done"
            ? "text-[var(--em-text-3)] line-through decoration-[var(--em-hairline-strong)]"
            : state === "skipped"
              ? "text-[var(--em-text-3)]"
              : "font-medium text-[var(--em-text)]",
        )}
      >
        {slot.title}
      </span>
      {state === "skipped" ? (
        <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-1.5 py-0.5 text-[var(--em-text-3)]">
          saltato
        </span>
      ) : null}
    </span>
  );
}
