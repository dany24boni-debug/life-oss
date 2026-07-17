"use client";

/**
 * Il recap della giornata su /sera (run-11 P4): Sera si de-siloizza —
 * il check-in si apre coi FATTI del giorno, tutti da selettori
 * read-only già esistenti: task fatti/pianificati, abitudini, minuti
 * focus, palestra (quale scheda, fatta o no, deep-link alla card),
 * aderenza dieta — `remainingVsTarget` FINALMENTE renderizzato fuori
 * da /dieta (il fantasma dell'audit P1). In coda "Prepara domani":
 * sposta i task aperti di oggi a domani (undo cumulativo) così il
 * rituale del mattino si apre già carico. Diario e Drive: intoccati.
 */

import Link from "next/link";
import { Button, useToast } from "@/ui";
import {
  appRepos,
  useDayDiet,
  useDayExtras,
  useFocusMinutesByDay,
  useGymSessionsByDay,
  useHabitBoard,
  useLatestBody,
  useProgramDay,
  useSettings,
  useTasks,
  useTasksSummary,
} from "@/data/hooks";
import { calorieTargetKcal, proteinTargetG } from "@/data/derived";
import { dayTotals, remainingVsTarget } from "@/data/diet";
import type { IsoDay } from "@/data/schemas";
import { formatMin } from "../_components/format-min";
import { snoozeDate } from "../_components/tasks/logic";
import { formatGramsFromDg, formatInt } from "../dieta/logic";
import { gymCardHref } from "../gym/card-history";

export function SeraRecap({ today }: { today: IsoDay }) {
  const summary = useTasksSummary(today);
  const habits = useHabitBoard(today);
  const focus = useFocusMinutesByDay(today, today);
  const gymSessions = useGymSessionsByDay(today);
  const doneGym = (gymSessions ?? []).find((s) => s.finished_at !== null);
  const doneDay = useProgramDay(doneGym?.program_day_id ?? null);

  const habitsDone = (habits ?? []).filter((e) => e.done).length;
  const focusMin = focus?.[0]?.minutes ?? 0;
  const gymActive = (gymSessions ?? []).some((s) => s.finished_at === null);

  return (
    <section aria-label="La giornata" className="em-card p-5">
      <p className="em-eyebrow">La giornata</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <RecapLine
          label="Task"
          value={
            summary === undefined ? "…" : `${summary.done} su ${summary.total}`
          }
        />
        <RecapLine
          label="Abitudini"
          value={
            habits === undefined
              ? "…"
              : habits.length === 0
                ? "—"
                : `${habitsDone} su ${habits.length}`
          }
        />
        <RecapLine
          label="Focus"
          value={focus === undefined ? "…" : focusMin > 0 ? formatMin(focusMin) : "—"}
        />
        <RecapLine
          label="Palestra"
          value={
            gymSessions === undefined
              ? "…"
              : doneGym !== undefined
                ? (doneDay?.name ?? "fatta")
                : gymActive
                  ? "in corso"
                  : "—"
          }
          href={
            doneGym !== undefined && doneGym.program_day_id !== null
              ? gymCardHref(doneGym.program_day_id)
              : undefined
          }
          done={doneGym !== undefined && doneDay?.name !== undefined}
        />
      </dl>
      <DietLine today={today} />
      <PreparaDomani today={today} />
    </section>
  );
}

function RecapLine({
  label,
  value,
  href,
  done,
}: {
  label: string;
  value: string;
  href?: string;
  done?: boolean;
}) {
  const text = (
    <>
      {value}
      {done === true ? (
        <span className="em-body-sm text-[var(--em-text-3)]"> · fatta</span>
      ) : null}
    </>
  );
  return (
    <div>
      <dt className="em-eyebrow text-[var(--em-text-3)]">{label}</dt>
      <dd className="em-body em-num mt-0.5 text-[var(--em-text)]">
        {href !== undefined ? (
          <Link
            href={href}
            className="underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text-2)]"
          >
            {text}
          </Link>
        ) : (
          text
        )}
      </dd>
    </div>
  );
}

/** L'aderenza dieta del giorno: consumato / obiettivo, e quanto resta
 *  (o di quanto si è sopra) — kcal e proteine, dagli stessi derivati
 *  del profilo usati da /dieta. Senza piano né extra: nessuna riga. */
function DietLine({ today }: { today: IsoDay }) {
  const day = useDayDiet(today);
  const extras = useDayExtras(today);
  const settings = useSettings();
  const latest = useLatestBody();

  if (day === undefined || extras === undefined) return null;
  if (day.meals.length === 0 && extras.length === 0) return null;

  const totals = dayTotals(day, extras);
  const todayYear = Number(today.slice(0, 4));
  const kcalTarget =
    settings === undefined || latest === undefined
      ? null
      : calorieTargetKcal(
          {
            weightKg: latest?.weight_kg ?? null,
            heightCm: settings.height_cm,
            birthYear: settings.birth_year,
            sex: settings.sex,
            activityLevel: settings.activity_level,
          },
          todayYear,
          "maintain",
        );
  const protTarget =
    latest === undefined ? null : proteinTargetG(latest?.weight_kg ?? null);
  const vs = remainingVsTarget(totals, kcalTarget, protTarget);

  const kcalText = vs.kcal
    ? `${formatInt(vs.kcal.consumed)} / ${formatInt(vs.kcal.target)} kcal${
        vs.kcal.remaining >= 0
          ? ` · ne restano ${formatInt(vs.kcal.remaining)}`
          : ` · ${formatInt(-vs.kcal.remaining)} oltre`
      }`
    : `${formatInt(totals.kcal)} kcal`;
  const protText = vs.protein_dg
    ? `${formatGramsFromDg(vs.protein_dg.consumed)} / ${formatGramsFromDg(vs.protein_dg.target)} g proteine`
    : `${formatGramsFromDg(totals.protein_dg)} g proteine`;

  return (
    <p className="em-body-sm mt-3 border-t border-[var(--em-hairline)] pt-3 text-[var(--em-text-2)]">
      Dieta: {kcalText} · {protText}
    </p>
  );
}

/** "Prepara domani": i task APERTI di oggi diventano i candidati del
 *  rituale di domani — spostamento di data puro (pattern
 *  moveAllToToday), un solo toast con undo cumulativo. */
function PreparaDomani({ today }: { today: IsoDay }) {
  const toast = useToast();
  const todays = useTasks(today);
  const open = (todays ?? []).filter((t) => t.status === "open");
  if (todays === undefined || open.length === 0) return null;

  const tomorrow = snoozeDate("domani", today);

  async function prepara() {
    const moved: Array<{ id: string; previous: IsoDay | null }> = [];
    let failed = false;
    for (const t of open) {
      const r = await appRepos().tasks.update(t.id, { date: tomorrow });
      if (r.ok) moved.push({ id: t.id, previous: t.date });
      else failed = true;
    }
    if (failed) {
      toast.show({
        message: "Non ho potuto spostare tutti i task. Riprova.",
        tone: "error",
      });
      return;
    }
    if (moved.length === 0) return;
    toast.show({
      message:
        moved.length === 1
          ? "1 task pronto per domani"
          : `${moved.length} task pronti per domani`,
      tone: "success",
      action: {
        label: "Annulla",
        onClick: () => {
          void (async () => {
            for (const m of moved) {
              await appRepos().tasks.update(m.id, { date: m.previous });
            }
          })();
        },
      },
    });
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--em-hairline)] pt-3">
      <p className="em-body-sm text-[var(--em-text-3)]">
        {open.length === 1
          ? "1 task aperto di oggi"
          : `${open.length} task aperti di oggi`}
        : domattina il rituale si apre già carico.
      </p>
      <Button size="sm" variant="secondary" onClick={() => void prepara()}>
        Prepara domani
      </Button>
    </div>
  );
}
