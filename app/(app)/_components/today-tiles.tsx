"use client";

/**
 * Tile di Oggi (B2.5): query VERE sul port, mai numeri in cache o finti.
 * Quattro slot: task di oggi, streak (col flame dot vivo solo quando oggi
 * conta già), completamento della settimana in corso (parte trascorsa:
 * lun -> oggi), e il volume palestra della settimana — reale dal run-04
 * (prompt 10), sul port StatsRepo.gymVolumeInRange che aspettava da lì.
 */

import { StatCard } from "@/ui";
import {
  useBodyRecent,
  useCompletionByDay,
  useGymVolume,
  useStreak,
  useTasksSummary,
} from "@/data/hooks";
import { formatBodyDelta, formatBodyKg } from "../corpo/logic";
import { formatKg } from "../gym/logic";
import { completionPercent, fillDays, weekBounds } from "../stats/logic";
import { APP_TIME_ZONE } from "./tasks/logic";
import { useToday } from "./tasks/screen-hooks";

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

  // Peso corporeo (run-07 P4): tile compatto SOLO quando esistono dati.
  const weights = useBodyRecent(today, 2);
  const latestWeight = weights?.[0];
  const weightDelta =
    weights !== undefined && weights.length >= 2
      ? Math.round((weights[0].weight_kg - weights[1].weight_kg) * 10) / 10
      : null;

  return (
    <section aria-label="Statistiche di oggi" className="grid grid-cols-2 gap-3">
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
      />
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
      >
        {streak !== undefined && streak.current > 0 && streak.todayCounts ? (
          <span className="em-dot em-dot--live" aria-hidden="true" />
        ) : null}
      </StatCard>
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
      />
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
      />
      {latestWeight !== undefined && latestWeight !== null ? (
        <StatCard
          label="Peso"
          value={formatBodyKg(latestWeight.weight_kg)}
          hint={
            weightDelta !== null
              ? `${formatBodyDelta(weightDelta)} dall'ultima pesata.`
              : "Prima pesata registrata."
          }
        />
      ) : null}
    </section>
  );
}
