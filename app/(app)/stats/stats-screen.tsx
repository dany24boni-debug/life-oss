"use client";

/**
 * Schermata /stats (B2.5): numeri onesti dal port — streak con giorni
 * protetti, barre della settimana, strip mensile dei giorni attivi, e il
 * volume palestra della settimana (reale dal run-04, prompt 10 — il
 * riquadro che era rimasto dichiaratamente vuoto).
 */

import Link from "next/link";
import { ChartFrame, StatCard } from "@/ui";
import {
  useActivityDays,
  useCompletionByDay,
  useFocusMinutesByDay,
  useGymVolume,
  useSettings,
  useStreak,
} from "@/data/hooks";
import { APP_TIME_ZONE } from "../_components/tasks/logic";
import { useToday } from "../_components/tasks/screen-hooks";
import { formatKg } from "../gym/logic";
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

  // Volume palestra della settimana (run-04 prompt 10): port reale.
  const gym = useGymVolume(week.from, week.to);

  // Minuti di focus della settimana (run-08 prompt 5): registro vero.
  const focus = useFocusMinutesByDay(week.from, week.to);
  const focusToday =
    focus?.find((d) => d.date === today)?.minutes ?? (focus ? 0 : undefined);
  const focusWeek = focus?.reduce((sum, d) => sum + d.minutes, 0);

  const weekFilled =
    weekDays === undefined ? undefined : fillDays(weekDays, week.from, week.to);
  const weekHasTasks = (weekFilled ?? []).some((d) => d.total > 0);

  return (
    // Superficie "wide" (run-10 P3): da lg i riquadri vanno a due
    // colonne — la larghezza si spende, non si lascia vuota.
    <div
      className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start"
      data-page-width="wide"
    >
      <header className="flex items-end justify-between gap-3 pt-2 lg:col-span-2">
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

      <div className="grid grid-cols-2 gap-3 lg:self-stretch">
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
        caption="Un giorno è attivo se hai completato un task, un allenamento, un'abitudine o un pomodoro di focus. I giorni protetti non spezzano la streak."
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
        state={
          gym === undefined ? "loading" : gym.sessions === 0 ? "empty" : "ready"
        }
        emptyText="Nessun allenamento questa settimana. Il primo accende questo riquadro."
        minHeight={120}
        caption="Settimana in corso (lun -> dom): sessioni registrate e volume totale sollevato."
      >
        {gym !== undefined && gym.sessions > 0 ? (
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="em-eyebrow">Sessioni</dt>
              <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
                {gym.sessions}
              </dd>
            </div>
            <div>
              <dt className="em-eyebrow">Volume</dt>
              <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
                {formatKg(gym.totalVolumeKg)}
              </dd>
            </div>
          </dl>
        ) : null}
      </ChartFrame>

      {/* Minuti di focus (run-08 prompt 5): dal registro FocusSession. */}
      <ChartFrame
        label="Focus"
        title="Minuti di focus"
        state={
          focus === undefined
            ? "loading"
            : (focusWeek ?? 0) === 0
              ? "empty"
              : "ready"
        }
        emptyText="Nessun pomodoro questa settimana. Il primo accende questo riquadro."
        minHeight={120}
        caption="Settimana in corso (lun -> dom): fasi di lavoro concluse dal timer."
      >
        {focus !== undefined && (focusWeek ?? 0) > 0 ? (
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="em-eyebrow">Oggi</dt>
              <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
                {focusToday ?? 0} min
              </dd>
            </div>
            <div>
              <dt className="em-eyebrow">Settimana</dt>
              <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
                {focusWeek} min
              </dd>
            </div>
          </dl>
        ) : null}
      </ChartFrame>
    </div>
  );
}
