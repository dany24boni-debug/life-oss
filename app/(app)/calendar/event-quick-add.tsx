"use client";

/**
 * Quick-add eventi (B2.4): stesso parser italiano e stessi chip
 * dismissibili del quick-add task. La logica è in event-parse.ts (pura,
 * testata); qui solo lo stato del campo e il submit ottimista.
 */

import { useMemo, useRef, useState } from "react";
import { Button, Input, cx, useToast } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos } from "@/data/hooks";
import type { LocalEvent } from "@/data/schemas";
import type { Chip } from "../_components/tasks/logic";
import { eventParse, toEventCreate } from "./event-parse";

export function EventQuickAdd({
  today,
  defaultDate,
  autoFocus,
  onCreated,
  className,
}: {
  today: DayString;
  /** Giorno selezionato nella vista: data implicita del nuovo evento. */
  defaultDate: DayString;
  autoFocus?: boolean;
  onCreated?: (event: LocalEvent) => void;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [defaultDismissed, setDefaultDismissed] = useState(false);

  const effective = useMemo(
    () =>
      eventParse(
        value,
        new Date(),
        dismissed,
        defaultDate,
        defaultDismissed,
        today,
      ),
    [value, dismissed, defaultDate, defaultDismissed, today],
  );

  function reset() {
    setValue("");
    setDismissed(new Set());
    setDefaultDismissed(false);
  }

  function onChange(next: string) {
    setValue(next);
    if (next.trim() === "") {
      setDismissed(new Set());
      setDefaultDismissed(false);
    }
  }

  function dismissChip(chip: Chip) {
    if (chip.muted) {
      setDefaultDismissed(true);
      return;
    }
    setDismissed((prev) => new Set(prev).add(chip.key));
  }

  const ready =
    effective !== null &&
    effective.title !== "" &&
    effective.date !== undefined;

  async function submit() {
    if (!effective || !ready || effective.date === undefined) return;
    const snapshot = value;
    reset(); // ottimista, come il quick-add dei task
    inputRef.current?.focus();
    const r = await appRepos().events.create(
      toEventCreate({ ...effective, date: effective.date }),
    );
    if (!r.ok) {
      setValue(snapshot);
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onCreated?.(r.data);
  }

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Aggiungi un evento — prova: cena con Marco ven 20:30"
          aria-label="Aggiungi un evento"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          autoFocus={autoFocus}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!ready}
          aria-label="Aggiungi l'evento"
        >
          Aggiungi
        </Button>
      </form>

      {effective && effective.chips.length > 0 ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          aria-label="Elementi riconosciuti"
        >
          {effective.chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => dismissChip(chip)}
              aria-label={`Rimuovi ${chip.kind === "date" ? "data" : "orario"}: ${chip.label}`}
              className={cx(
                "group inline-flex h-8 items-center gap-1.5 rounded-full px-3",
                "bg-[var(--em-surface-2)] shadow-[0_0_0_1px_var(--em-hairline)]",
                "transition-[box-shadow,opacity] duration-[var(--em-dur-tap)]",
                "hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]",
                chip.muted && "opacity-70",
              )}
            >
              <span className="em-eyebrow text-[var(--em-text-3)]">
                {chip.kind === "date" ? "data" : "orario"}
              </span>
              <span className="em-body-sm em-num font-medium text-[var(--em-text)]">
                {chip.label}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-3 w-3 stroke-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] group-hover:stroke-[var(--em-text)]"
                fill="none"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
