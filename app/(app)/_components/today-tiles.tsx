"use client";

/**
 * Tile di Oggi (B2.5): query VERE sul port, mai numeri in cache o finti.
 * Quattro slot: task di oggi, streak (col flame dot vivo solo quando oggi
 * conta già), completamento della settimana in corso (parte trascorsa:
 * lun -> oggi), e il volume palestra della settimana — reale dal run-04
 * (prompt 10), sul port StatsRepo.gymVolumeInRange che aspettava da lì.
 */

import Link from "next/link";
import { StatCard } from "@/ui";
import { dayTotals } from "@/data/diet";
import {
  useBodyRecent,
  useCompletionByDay,
  useDayDiet,
  useDayExtras,
  useGymVolume,
  useStreak,
  useTasksSummary,
} from "@/data/hooks";
import { formatBodyDelta, formatBodyKg } from "../corpo/logic";
import { formatInt } from "../dieta/logic";
import { formatKg } from "../gym/logic";
import { remainingCount } from "../settimana/logic";
import { completionPercent, fillDays, weekBounds } from "../stats/logic";
import { APP_TIME_ZONE } from "./tasks/logic";
import { useToday } from "./tasks/screen-hooks";
import { useTodayPlanSlots } from "./today-adesso";

export function TodayTiles() {
  const today = useToday();
  const summary = useTasksSummary(today);
  const streak = useStreak(today, APP_TIME_ZONE);

  // Completamento della parte già trascorsa della settimana (lun -> oggi):
  // i task futuri non ancora fatti non abbassano una percentuale di oggi.
  const week = weekBounds(today);
  const weekDays = useCompletionByDay(week.from, today);
  const weekPct =
    weekDays === undefined
      ? undefined
      : completionPercent(fillDays(weekDays, week.from, today));

  // Palestra della settimana in corso (lun -> oggi): sessioni e volume.
  const gym = useGymVolume(week.from, today);

  // Piano di oggi (run-08 P4): slot rimasti — SOLO con un piano attivo
  // che prevede qualcosa oggi.
  const todayPlan = useTodayPlanSlots();
  const planEntries = todayPlan.entries;

  // Pasti (run-09 P2): tile compatto SOLO quando il piano attivo prevede
  // pasti oggi — linka a /dieta. Solo dati e funzioni pure nel grafo.
  const dayDiet = useDayDiet(today);
  const dayExtras = useDayExtras(today);
  const mealsToday = dayDiet?.meals ?? [];
  const mealsEaten = mealsToday.filter((m) => m.eaten).length;
  const dietKcal =
    dayDiet !== undefined && dayExtras !== undefined
      ? dayTotals(dayDiet, dayExtras).kcal
      : null;

  // Peso corporeo (run-07 P4): tile compatto SOLO quando esistono dati.
  const weights = useBodyRecent(today, 2);
  const latestWeight = weights?.[0];
  const weightDelta =
    weights !== undefined && weights.length >= 2
      ? Math.round((weights[0].weight_kg - weights[1].weight_kg) * 10) / 10
      : null;

  return (
    <section aria-label="Statistiche di oggi" className="grid grid-cols-2 gap-3">
      {/* Ogni tile è un Link al suo modulo (run-10 P4, PROP-oggi-01):
          prima lo era solo Pasti — stessa incorniciatura per tutti. */}
      <TileLink href="/tasks" label="Task di oggi: apri Task">
        <StatCard
          label="Task oggi"
          loading={summary === undefined}
          value={
            summary === undefined
              ? undefined
              : summary.total === 0
                ? "—"
                : `${summary.done}/${summary.total}`
          }
          hint={
            summary === undefined
              ? undefined
              : summary.total === 0
                ? "Nessun task per oggi."
                : summary.done === summary.total
                  ? "Tutti chiusi."
                  : undefined
          }
          className="h-full"
        />
      </TileLink>
      <TileLink href="/stats" label="Streak: apri Statistiche">
        <StatCard
          label="Streak"
          loading={streak === undefined}
          value={streak?.current}
          unit={streak?.current === 1 ? "giorno" : "giorni"}
          hint={
            streak === undefined
              ? undefined
              : streak.todayCounts
                ? "Oggi conta già."
                : streak.current > 0
                  ? "Si tiene con un'azione oggi."
                  : "Riparti oggi: basta un task."
          }
          className="h-full"
        >
          {streak !== undefined && streak.current > 0 && streak.todayCounts ? (
            <span className="em-dot em-dot--live" aria-hidden="true" />
          ) : null}
        </StatCard>
      </TileLink>
      <TileLink href="/stats" label="Settimana: apri Statistiche">
        <StatCard
          label="Settimana"
          loading={weekPct === undefined}
          value={weekPct === null ? "—" : `${weekPct}%`}
          hint={
            weekPct === undefined
              ? undefined
              : weekPct === null
                ? "Nessun task da lunedì a oggi."
                : "Completamento da lunedì a oggi."
          }
          className="h-full"
        />
      </TileLink>
      <TileLink href="/gym" label="Palestra: apri il modulo">
        <StatCard
          label="Palestra"
          loading={gym === undefined}
          value={
            gym === undefined
              ? undefined
              : gym.sessions === 0
                ? "—"
                : gym.sessions
          }
          unit={
            gym === undefined || gym.sessions === 0
              ? undefined
              : gym.sessions === 1
                ? "sessione"
                : "sessioni"
          }
          hint={
            gym === undefined
              ? undefined
              : gym.sessions === 0
                ? "Nessun allenamento questa settimana."
                : gym.totalVolumeKg > 0
                  ? `${formatKg(gym.totalVolumeKg)} da lunedì.`
                  : "Da lunedì a oggi."
          }
          className="h-full"
        />
      </TileLink>
      {latestWeight !== undefined && latestWeight !== null ? (
        <TileLink href="/corpo" label="Peso: apri Corpo">
          <StatCard
            label="Peso"
            value={formatBodyKg(latestWeight.weight_kg)}
            hint={
              weightDelta !== null
                ? `${formatBodyDelta(weightDelta)} dall'ultima pesata.`
                : "Prima pesata registrata."
            }
            className="h-full"
          />
        </TileLink>
      ) : null}
      {planEntries !== undefined && planEntries.length > 0 ? (
        <TileLink href="/settimana" label="Piano di oggi: apri Settimana">
          <StatCard
            label="Piano di oggi"
            value={remainingCount(planEntries)}
            unit="slot"
            hint={
              remainingCount(planEntries) === 0
                ? "Tutto spuntato."
                : "Ancora senza esito."
            }
            className="h-full"
          />
        </TileLink>
      ) : null}
      {mealsToday.length > 0 ? (
        <TileLink href="/dieta" label="Pasti di oggi: apri Dieta">
          <StatCard
            label="Pasti"
            value={`${mealsEaten}/${mealsToday.length}`}
            unit="pasti"
            hint={
              dietKcal === null
                ? undefined
                : `${formatInt(dietKcal)} kcal finora.`
            }
            className="h-full"
          />
        </TileLink>
      ) : null}
    </section>
  );
}

/** La cornice-Link dei tile (il pattern nato col tile Pasti, run-09). */
function TileLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-[var(--em-r-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--em-ember)]"
    >
      {children}
    </Link>
  );
}
