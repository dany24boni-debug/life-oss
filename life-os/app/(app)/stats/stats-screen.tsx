"use client";

/**
 * Schermata /stats (B2.5): numeri onesti dal port — streak con giorni
 * protetti, barre della settimana, strip mensile dei giorni attivi. Il
 * volume palestra resta un posto vuoto DICHIARATO finché il modulo Gym
 * (prompt 10) non esiste: mai numeri finti.
 */

import Link from "next/link";
import { ChartFrame, StatCard } from "@/ui";
import {
  useActivityDays,
  useCompletionByDay,
  useSettings,
  useStreak,
} from "@/data/hooks";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import { useToday } from "../_components/tasks/screen-hooks";
import { fillDays, monthBounds, weekBounds } from "./logic";
import { MonthHeat } from "./month-heat";
import { WeekBars } from "./week-bars";

export function StatsScreen() {
  const today = useToday();
  const streak = useStreak(today, APP_TIME_ZONE);

  const week = weekBounds(today);
  const weekDays = useCompletionByDay(week.from, week.to);

  const month = monthBounds(today);
  const activeDays = useActivityDays(month.from, month.to, APP_TIME_ZONE);
  const settings = useSettings();

  const weekFilled =
    weekDays === undefined ? undefined : fillDays(weekDays, week.from, week.to);
  const weekHasTasks = (weekFilled ?? []).some((d) => d.total > 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="em-eyebrow">Modulo</p>
          <h1 className="em-title-lg mt-1 text-[var(--em-text)]">
            Statistiche
          </h1>
        </div>
        <Link
          href="/stats/review"
          className="em-body-sm pb-1 text-[var(--em-text-3)] underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Riepilogo settimanale
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
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
          label="Record"
          loading={streak === undefined}
          value={streak?.best}
          unit={streak?.best === 1 ? "giorno" : "giorni"}
          hint="La catena più lunga di sempre."
        />
      </div>

      <ChartFrame
        label="Settimana"
        title="Task chiusi per giorno"
        legend={[
          { label: "Chiusi", tone: "ember" },
          { label: "Pianificati", tone: "neutral" },
        ]}
        state={
          weekFilled === undefined
            ? "loading"
            : weekHasTasks
              ? "ready"
              : "empty"
        }
        emptyText="Nessun task pianificato questa settimana."
      >
        {weekFilled ? <WeekBars days={weekFilled} today={today} /> : null}
      </ChartFrame>

      <ChartFrame
        label="Mese"
        title="Giorni attivi"
        legend={[
          { label: "Attivo", tone: "ember" },
          { label: "Protetto", tone: "neutral" },
        ]}
        state={
          activeDays === undefined || settings === undefined
            ? "loading"
            : "ready"
        }
        caption="Un giorno è attivo se hai completato un task o registrato un allenamento. I giorni protetti non spezzano la streak."
      >
        {activeDays !== undefined && settings !== undefined ? (
          <MonthHeat
            from={month.from}
            to={month.to}
            today={today}
            activeDays={new Set(activeDays)}
            protectedDays={new Set(settings.protected_days)}
          />
        ) : null}
      </ChartFrame>

      <ChartFrame
        label="Palestra"
        title="Volume settimanale"
        state="empty"
        emptyText="Arriva con il modulo Palestra: qui niente numeri finti."
        minHeight={120}
      />
    </div>
  );
}
