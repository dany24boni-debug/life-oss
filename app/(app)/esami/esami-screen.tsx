"use client";

/**
 * Lo schermo di /esami (run-05 prompt 3): form "Nuovo esame", lista con
 * countdown e pacing per capitolo (lib pura legacy riusata), scheda
 * dettaglio CRUD con undo. Il pacing usa il giorno locale del dispositivo
 * (useToday, come il resto della shell).
 */

import { useState } from "react";
import { Button, DatePicker, EmptyState, Field, Input, Skeleton, useToast } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos, useEsami } from "@/data/hooks";
import type { Exam } from "@/data/schemas";
import {
  computePacing,
  STATUS_BADGE_IT,
  type PacingResult,
  type PacingStatus,
} from "@/lib/esami/pacing";
import { useToday } from "../_components/tasks/screen-hooks";
import { EsamiImportButton } from "./import-button";
import { ExamDetailSheet } from "./exam-detail";

export function EsamiScreen({ authed }: { authed: boolean }) {
  const today = useToday();
  const esami = useEsami();
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <NewExamForm defaultDate={today} />

      <section aria-label="I tuoi esami" className="em-card p-5">
        <p className="em-eyebrow">I tuoi esami</p>
        {esami === undefined ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-2/3" />
          </div>
        ) : esami.length === 0 ? (
          <div className="mt-1">
            <EmptyState
              compact
              heading="Nessun esame in vista"
              text="Aggiungi il prossimo qui sopra: data e capitoli bastano per il ritmo di studio."
            />
            {authed ? (
              <div className="mt-2 border-t border-[var(--em-hairline)] pt-4">
                <p className="em-body-sm text-[var(--em-text-3)]">
                  Gli esami del vecchio modulo non si perdono: importali
                  quando vuoi.
                </p>
                <div className="mt-3">
                  <EsamiImportButton compact />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {esami.map((exam) => (
              <ExamRow
                key={exam.id}
                exam={exam}
                today={today}
                onOpen={() => setDetailId(exam.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <ExamDetailSheet examId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

/* ── Nuovo esame ─────────────────────────────────────────────────────── */

function NewExamForm({ defaultDate }: { defaultDate: DayString }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<DayString | null>(null);
  const [chapters, setChapters] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed === "") return;
    setBusy(true);
    try {
      const r = await appRepos().esami.create({
        title: trimmed,
        date: date ?? defaultDate,
        total_chapters: parseChapters(chapters),
      });
      if (!r.ok) {
        toast.show({ message: r.error.message, tone: "error" });
        return;
      }
      setTitle("");
      setDate(null);
      setChapters("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="em-card p-5">
      <p className="em-eyebrow">Nuovo esame</p>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Nome" required>
          {(p) => (
            <Input
              {...p}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="es. Storia moderna"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" hint="Vuota = oggi">
            {(p) => (
              <DatePicker
                id={p.id}
                value={date}
                onChange={setDate}
                placeholder="Oggi"
              />
            )}
          </Field>
          <Field label="Capitoli" hint="0 = senza pacing">
            {(p) => (
              <Input
                {...p}
                value={chapters}
                onChange={(e) => setChapters(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            )}
          </Field>
        </div>
        <Button type="submit" loading={busy} disabled={title.trim() === ""}>
          Aggiungi esame
        </Button>
      </div>
    </form>
  );
}

/** "12" → 12, clampato 0..999; qualunque altra cosa → 0. */
function parseChapters(raw: string): number {
  if (!/^\d{1,3}$/.test(raw.trim())) return 0;
  return Math.min(999, Number(raw.trim()));
}

/* ── Riga esame con pacing ───────────────────────────────────────────── */

/** Tono Ember per ogni stato del pacing (etichette dalla lib legacy). */
const STATUS_TONE: Record<PacingStatus, string> = {
  done: "var(--em-salvia)",
  over_achieving: "var(--em-salvia)",
  in_line: "var(--em-ember)",
  under_pace: "var(--em-segnale)",
  past: "var(--em-segnale)",
};

function countdownLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}g fa`;
  if (days === 0) return "oggi";
  return days === 1 ? "1 giorno" : `${days} giorni`;
}

function formatDayIt(day: DayString): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function ExamRow({
  exam,
  today,
  onOpen,
}: {
  exam: Exam;
  today: DayString;
  onOpen: () => void;
}) {
  const toast = useToast();
  const pacing: PacingResult = computePacing(
    {
      exam_date: exam.date,
      total_chapters: exam.total_chapters,
      completed_chapters: exam.completed_chapters,
    },
    today,
  );
  const badge = STATUS_BADGE_IT[pacing.status];
  const tone = STATUS_TONE[pacing.status];
  const pct =
    exam.total_chapters > 0
      ? Math.min(
          100,
          Math.round((exam.completed_chapters / exam.total_chapters) * 100),
        )
      : 0;
  const canAdvance =
    exam.total_chapters > 0 && exam.completed_chapters < exam.total_chapters;

  async function advance() {
    const previous = exam.completed_chapters;
    const next = Math.min(exam.total_chapters, previous + 1);
    const r = await appRepos().esami.update(exam.id, {
      completed_chapters: next,
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    // Il log a un tocco parla e si annulla (run-10 P4, PROP-esami-01):
    // prima era muto — un +1 sbagliato si correggeva solo dalla scheda.
    toast.show({
      message: `Capitolo ${next} di ${exam.total_chapters}: fatto.`,
      tone: "success",
      action: {
        label: "Annulla",
        onClick: () =>
          void appRepos().esami.update(exam.id, {
            completed_chapters: previous,
          }),
      },
    });
  }

  return (
    <li className="rounded-[var(--em-r-lg)] border border-[var(--em-hairline)] p-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="em-body block truncate font-medium text-[var(--em-text)]">
            {exam.title}
          </span>
          <span className="em-body-sm mt-0.5 block text-[var(--em-text-3)]">
            {formatDayIt(exam.date)} ·{" "}
            <span className="tabular-nums">
              {countdownLabel(pacing.daysRemaining)}
            </span>
          </span>
        </span>
        <span
          className="em-eyebrow shrink-0 rounded-[var(--em-r-full)] px-2 py-1"
          style={{
            color: tone,
            backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
          }}
        >
          {badge.label}
        </span>
      </button>

      {exam.total_chapters > 0 ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="em-body-sm tabular-nums text-[var(--em-text-2)]">
              {exam.completed_chapters}/{exam.total_chapters} capitoli ·{" "}
              <span className="text-[var(--em-text-3)]">{pct}%</span>
            </span>
            {pacing.status !== "done" && pacing.status !== "past" ? (
              <span className="em-eyebrow text-[var(--em-text-3)]">
                target oggi:{" "}
                <span className="tabular-nums text-[var(--em-text-2)]">
                  {pacing.chaptersPerDayNeeded}
                </span>
                /dì
              </span>
            ) : null}
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--em-r-full)] bg-[var(--em-surface-2)]"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-[var(--em-r-full)] transition-[width] duration-[var(--em-dur-card)]"
              style={{ width: `${pct}%`, backgroundColor: tone }}
            />
          </div>
          {canAdvance ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void advance()}
              >
                Capitolo fatto
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
