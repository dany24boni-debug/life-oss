"use client";

/**
 * Lista agenda condivisa (B2.4): rende gli AgendaItem del merge — all-day
 * in testa, poi le voci con orario. Ogni voce è source-linked: un task
 * apre la sua scheda, un evento locale la sua; gli eventi Google portano
 * il badge e restano read-only. Usata da /calendar (giorno selezionato)
 * e dalla sezione Agenda di Oggi.
 */

import { cx } from "@/ui";
import type { AgendaItem } from "../calendar/agenda";

export function AgendaList({
  items,
  onOpenEvent,
  onOpenTask,
}: {
  items: readonly AgendaItem[];
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.key}>
          <AgendaRow item={item} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />
        </li>
      ))}
    </ul>
  );
}

function AgendaRow({
  item,
  onOpenEvent,
  onOpenTask,
}: {
  item: AgendaItem;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const interactive = item.source !== "google";
  const timeLabel = item.allDay
    ? "giornata"
    : item.end
      ? `${item.start}–${item.end}`
      : (item.start ?? "");

  const body = (
    <>
      <span
        className={cx(
          "em-body-sm em-num w-[4.75rem] shrink-0 pt-0.5 text-left",
          item.allDay ? "text-[var(--em-text-3)]" : "text-[var(--em-text-2)]",
        )}
      >
        {timeLabel}
      </span>
      <span
        className={cx(
          "em-body min-w-0 flex-1 truncate text-left",
          item.done
            ? "text-[var(--em-text-3)] line-through decoration-[var(--em-hairline-strong)]"
            : "text-[var(--em-text)]",
        )}
      >
        {item.title}
      </span>
      {item.source === "google" ? (
        <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)]">
          Google
        </span>
      ) : null}
      {item.source === "task" ? (
        <span className="em-eyebrow shrink-0 text-[var(--em-text-3)]">
          task
        </span>
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <div className="flex min-h-11 items-start gap-3 border-b border-[var(--em-hairline)] py-2.5 last:border-b-0">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        item.source === "task" ? onOpenTask(item.id) : onOpenEvent(item.id)
      }
      aria-label={`Apri: ${item.title}`}
      className="flex min-h-11 w-full items-start gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
    >
      {body}
    </button>
  );
}
