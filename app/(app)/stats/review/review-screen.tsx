"use client";

/**
 * Riepilogo settimanale (B2.5): gli ultimi 7 giorni — barre, chiusi
 * totali, giorno migliore, UNA osservazione gentile rule-based. Nessun
 * LLM, nessun giudizio: i numeri più una frase.
 */

import Link from "next/link";
import { ChartFrame, StatCard } from "@/ui";
import { formatDayShort } from "@/ui/calendar-core";
import { useCompletionByDay } from "@/data/hooks";
import { useToday } from "../../_components/tasks/screen-hooks";
import {
  bestDay,
  completionPercent,
  fillDays,
  lastSevenDays,
  weeklyObservation,
} from "../logic";
import { WeekBars } from "../week-bars";

export function ReviewScreen() {
  const today = useToday();
  const range = lastSevenDays(today);
  const days = useCompletionByDay(range.from, range.to);

  const filled =
    days === undefined ? undefined : fillDays(days, range.from, range.to);
  const loading = filled === undefined;

  const totalDone = (filled ?? []).reduce((s, d) => s + d.done, 0);
  const pct = filled ? completionPercent(filled) : null;
  const top = filled ? bestDay(filled) : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-2">
        <p className="em-eyebrow">Statistiche</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">
          Riepilogo settimanale
        </h1>
        <p className="mt-2">
          <Link
            href="/stats"
            className="em-body-sm text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
          >
            Tutte le statistiche
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Chiusi"
          loading={loading}
          value={totalDone}
          unit="task"
        />
        <StatCard
          label="Completamento"
          loading={loading}
          value={pct === null ? "—" : `${pct}%`}
          hint={pct === null ? "Nessun task pianificato." : undefined}
        />
        <StatCard
          label="Giorno migliore"
          loading={loading}
          value={top ? formatDayShort(top.date) : "—"}
          hint={top ? `${top.done} task chiusi` : undefined}
        />
      </div>

      <ChartFrame
        label="Ultimi 7 giorni"
        title="Task chiusi per giorno"
        legend={[
          { label: "Chiusi", tone: "ember" },
          { label: "Pianificati", tone: "neutral" },
        ]}
        state={loading ? "loading" : "ready"}
      >
        {filled ? <WeekBars days={filled} today={today} /> : null}
      </ChartFrame>

      {!loading && filled ? (
        <section className="em-card p-5" aria-label="Osservazione">
          <p className="em-eyebrow">Una nota</p>
          <p className="em-body mt-2 text-[var(--em-text)]">
            {weeklyObservation(filled)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
