"use client";

/**
 * Lista agenda condivisa (B2.4): rende gli AgendaItem del merge — all-day
 * in testa (dal run-08 P5 anche i task datati senza orario), poi le voci
 * con orario. Ogni voce è source-linked: un task apre la sua scheda E si
 * completa dal check inline, un evento locale la sua; gli eventi Google
 * portano il badge e restano read-only. Usata da /calendar (giorno
 * selezionato) e dalla sezione Agenda di Oggi.
 */

import { cx, useToast } from "@/ui";
import { appRepos } from "@/data/hooks";
import type { AgendaItem } from "../calendar/agenda";
import { IconCheck } from "./icons";

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

  if (item.source === "task") {
    // Task: check inline a destra (run-08 P5, "completable from there")
    // + scheda al tap sulla riga — la colonna orario resta allineata.
    return (
      <div className="flex items-stretch gap-1 border-b border-[var(--em-hairline)] last:border-b-0">
        <button
          type="button"
          onClick={() => onOpenTask(item.id)}
          aria-label={`Apri: ${item.title}`}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-3 py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
        >
          {body}
        </button>
        <TaskCheck id={item.id} title={item.title} done={item.done} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenEvent(item.id)}
      aria-label={`Apri: ${item.title}`}
      className="flex min-h-11 w-full items-start gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
    >
      {body}
    </button>
  );
}

function TaskCheck({
  id,
  title,
  done,
}: {
  id: string;
  title: string;
  done: boolean;
}) {
  const toast = useToast();

  async function toggle() {
    const tasks = appRepos().tasks;
    const r = done ? await tasks.uncomplete(id) : await tasks.complete(id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  return (
    <button
      type="button"
      aria-label={
        done ? `${title}: fatto — tocca per riaprire` : `Completa: ${title}`
      }
      aria-pressed={done}
      onClick={() => void toggle()}
      className="grid w-11 shrink-0 place-items-center"
    >
      <span
        className={cx(
          "grid h-5 w-5 place-items-center rounded-full transition-colors duration-[var(--em-dur-tap)]",
          done
            ? "bg-[var(--em-ember)] text-[var(--em-on-ember)]"
            : "border border-[var(--em-hairline-strong)] text-transparent",
        )}
        aria-hidden="true"
      >
        {done ? <IconCheck className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}
