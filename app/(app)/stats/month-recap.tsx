"use client";

/**
 * "Il tuo mese" (run-12, WOW-03/PROP-stats-04) — il recap mensile
 * app-wide, casa naturale /stats: palestra (sessioni, volume, PR del
 * mese), abitudini tenute, minuti di focus, task chiusi, delta peso,
 * aderenza dieta. Tutto derivato dai selettori read-only; mesi passati
 * navigabili (deterministico: stesso mese, stessi numeri), guest-first.
 */

import { useState } from "react";
import { StatCard } from "@/ui";
import {
  useBodyRange,
  useCompletionByDay,
  useDietConsumedByDay,
  useFocusMinutesByDay,
  useGymPrCount,
  useGymVolume,
  useHabitCompletionByDay,
  useLatestBody,
  useSettings,
} from "@/data/hooks";
import { calorieTargetKcal } from "@/data/derived";
import type { IsoDay } from "@/data/schemas";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import { formatMin } from "../_components/format-min";
import { formatKg } from "../gym/logic";
import { monthLabel, monthShift } from "./recap-logic";

const KG_DELTA = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
  useGrouping: "always",
} as Intl.NumberFormatOptions);

export function MonthRecap({ today }: { today: IsoDay }) {
  const [offset, setOffset] = useState(0);
  const month = monthShift(today, offset);

  const gym = useGymVolume(month.from, month.to);
  const prCount = useGymPrCount(month.from, month.to);
  const habits = useHabitCompletionByDay(
    month.from,
    month.to,
    APP_TIME_ZONE,
  );
  const focus = useFocusMinutesByDay(month.from, month.to);
  const tasks = useCompletionByDay(month.from, month.to);
  const body = useBodyRange(month.from, month.to);
  const diet = useDietConsumedByDay(month.from, month.to);
  const settings = useSettings();
  const latest = useLatestBody();

  const loading =
    gym === undefined ||
    prCount === undefined ||
    habits === undefined ||
    focus === undefined ||
    tasks === undefined ||
    body === undefined ||
    diet === undefined;

  // Abitudini: previste e fatte nel mese (solo giorni con previste).
  const habitScheduled = (habits ?? []).reduce((s, d) => s + d.scheduled, 0);
  const habitDone = (habits ?? []).reduce((s, d) => s + d.done, 0);

  const focusMin = (focus ?? []).reduce((s, d) => s + d.minutes, 0);
  const tasksDone = (tasks ?? []).reduce((s, d) => s + d.done, 0);
  const tasksTotal = (tasks ?? []).reduce((s, d) => s + d.total, 0);

  // Peso: prima → ultima pesata del mese (serve più di una).
  const weightDelta =
    (body ?? []).length >= 2
      ? body![body!.length - 1].weight_kg - body![0].weight_kg
      : null;

  // Dieta: giorni nel ±10% del target CORRENTE sui giorni loggati
  // (semplificazione dichiarata: il target storico non si ricostruisce).
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
          Number(today.slice(0, 4)),
          "maintain",
        );
  const dietLogged = (diet ?? []).length;
  const dietAdherent =
    kcalTarget === null
      ? null
      : (diet ?? []).filter(
          (d) => Math.abs(d.kcal - kcalTarget) <= kcalTarget * 0.1,
        ).length;

  const empty =
    !loading &&
    (gym?.sessions ?? 0) === 0 &&
    habitScheduled === 0 &&
    focusMin === 0 &&
    tasksTotal === 0 &&
    (body ?? []).length === 0 &&
    dietLogged === 0;

  return (
    <section aria-label="Il tuo mese" className="lg:col-span-2">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div>
          <p className="em-eyebrow">Il tuo mese</p>
          <h2 className="em-title mt-0.5 capitalize text-[var(--em-text)]">
            {monthLabel(month.from)}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <MonthNavBtn
            label="Mese precedente"
            onClick={() => setOffset((o) => o - 1)}
          >
            ←
          </MonthNavBtn>
          <MonthNavBtn
            label="Mese successivo"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
          >
            →
          </MonthNavBtn>
        </div>
      </div>

      {empty ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessun dato in questo mese.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="Palestra"
            loading={loading}
            value={gym?.sessions}
            unit={gym?.sessions === 1 ? "sessione" : "sessioni"}
            hint={
              gym && gym.sessions > 0
                ? `${formatKg(gym.totalVolumeKg)} di volume${
                    (prCount ?? 0) > 0
                      ? ` · ${prCount} PR`
                      : ""
                  }`
                : "Nessuna seduta."
            }
          />
          <StatCard
            label="Abitudini"
            loading={loading}
            value={
              habitScheduled > 0
                ? `${Math.round((habitDone / habitScheduled) * 100)}%`
                : "—"
            }
            hint={
              habitScheduled > 0
                ? `${habitDone} su ${habitScheduled} previste`
                : "Nessuna abitudine prevista."
            }
          />
          <StatCard
            label="Focus"
            loading={loading}
            value={focusMin > 0 ? formatMin(focusMin) : "—"}
            hint={
              focusMin > 0
                ? "Fasi di lavoro concluse."
                : "Nessun pomodoro."
            }
          />
          <StatCard
            label="Task"
            loading={loading}
            value={tasksDone}
            unit={tasksDone === 1 ? "chiuso" : "chiusi"}
            hint={tasksTotal > 0 ? `su ${tasksTotal} del mese` : "Mese senza task."}
          />
          <StatCard
            label="Peso"
            loading={loading}
            value={
              weightDelta === null ? "—" : `${KG_DELTA.format(weightDelta)} kg`
            }
            hint={
              weightDelta === null
                ? "Servono almeno due pesate nel mese."
                : "Prima → ultima pesata del mese."
            }
          />
          <StatCard
            label="Dieta"
            loading={loading}
            value={
              dietLogged === 0
                ? "—"
                : dietAdherent === null
                  ? dietLogged
                  : `${dietAdherent}/${dietLogged}`
            }
            unit={
              dietLogged > 0 && dietAdherent === null
                ? dietLogged === 1
                  ? "giorno"
                  : "giorni"
                : undefined
            }
            hint={
              dietLogged === 0
                ? "Nessun giorno loggato."
                : dietAdherent === null
                  ? "Giorni loggati (senza profilo niente ±10%)."
                  : "Giorni nel ±10% del target, sui loggati."
            }
          />
        </div>
      )}
    </section>
  );
}

function MonthNavBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] disabled:opacity-40 disabled:hover:text-[var(--em-text-2)]"
    >
      {children}
    </button>
  );
}
