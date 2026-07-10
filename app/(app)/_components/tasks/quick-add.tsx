"use client";

/**
 * Quick-add (B2.1): una riga di linguaggio naturale -> un task. A ogni
 * battuta il parser (lib/nlp-it, `now` iniettato, fuso Europe/Rome) produce
 * i frammenti riconosciuti, mostrati come chip dismissibili PRIMA del
 * submit: toccare un chip restituisce quel testo al titolo — l'utente
 * vince sempre sul parser. Submit ottimista: l'input si svuota subito e
 * viene ripristinato (con toast d'errore) se il Result è ko.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, cx, useToast } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { parse } from "@/lib/nlp-it";
import { appRepos } from "@/data/hooks";
import type { Task } from "@/data/schemas";
import { IconPlus } from "../icons";
import {
  APP_TIME_ZONE,
  applyDismissals,
  toTaskCreate,
  withDefaultDate,
  type Chip,
} from "./logic";

export function QuickAdd({
  today,
  defaultDate,
  autoFocus,
  focusToken,
  onCreated,
  className,
}: {
  today: DayString;
  /** Data implicita della vista (chip attenuato, dismissibile). */
  defaultDate?: DayString;
  autoFocus?: boolean;
  /**
   * Focus imperativo (run-05 prompt 6): quando cambia (e non è 0),
   * l'input prende il focus — la scorciatoia `n` e la palette passano
   * di qui su /tasks, dove il quick-add è persistente.
   */
  focusToken?: number;
  onCreated?: (task: Task) => void;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusToken !== undefined && focusToken > 0) {
      inputRef.current?.focus();
    }
  }, [focusToken]);
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [defaultDismissed, setDefaultDismissed] = useState(false);

  const effective = useMemo(() => {
    const text = value.trim();
    if (!text) return null;
    const result = parse(value, { now: new Date(), timeZone: APP_TIME_ZONE });
    return withDefaultDate(
      applyDismissals(value, result, dismissed),
      defaultDate,
      defaultDismissed,
      today,
    );
  }, [value, dismissed, defaultDate, defaultDismissed, today]);

  function reset() {
    setValue("");
    setDismissed(new Set());
    setDefaultDismissed(false);
  }

  function onChange(next: string) {
    setValue(next);
    if (next.trim() === "") {
      // Input ripartito da zero: i dismissal appartengono al testo di prima.
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

  async function submit() {
    if (!effective || effective.title === "") return;
    const snapshot = value;
    reset(); // ottimista: il campo si libera subito per il task successivo
    inputRef.current?.focus();
    const r = await appRepos().tasks.create(toTaskCreate(effective));
    if (!r.ok) {
      setValue(snapshot); // rollback: il testo digitato non si perde mai
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
          placeholder="Aggiungi un task — prova: domani alle 18 spesa #casa"
          aria-label="Aggiungi un task"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          autoFocus={autoFocus}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!effective || effective.title === ""}
          aria-label="Aggiungi il task"
          icon={<IconPlus className="h-4 w-4" />}
        >
          <span className="hidden sm:inline">Aggiungi</span>
        </Button>
      </form>

      {effective && effective.chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Elementi riconosciuti">
          {effective.chips.map((chip) => (
            <ParseChip key={chip.key} chip={chip} onDismiss={() => dismissChip(chip)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const KIND_LABEL: Record<Chip["kind"], string> = {
  date: "data",
  time: "orario",
  priority: "priorità",
  tag: "tag",
  module: "modulo",
};

function ParseChip({ chip, onDismiss }: { chip: Chip; onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Rimuovi ${KIND_LABEL[chip.kind]}: ${chip.label}`}
      className={cx(
        "group inline-flex h-8 items-center gap-1.5 rounded-full px-3",
        "bg-[var(--em-surface-2)] shadow-[0_0_0_1px_var(--em-hairline)]",
        "transition-[box-shadow,opacity] duration-[var(--em-dur-tap)]",
        "hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]",
        chip.muted && "opacity-70 shadow-[0_0_0_1px_var(--em-hairline)]",
      )}
    >
      <span className="em-eyebrow text-[var(--em-text-3)]">
        {KIND_LABEL[chip.kind]}
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
  );
}
