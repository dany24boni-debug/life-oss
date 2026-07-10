"use client";

/**
 * Sezione Agenda di Oggi (B2.4, "Today wiring"): la strip della settimana
 * (tap su un giorno = deep-link a /calendar?giorno=...) e l'agenda REALE
 * di oggi — eventi locali + task con orario + Google (dal server, vuoto
 * per gli ospiti). Le voci sono source-linked come su /calendar.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, Skeleton, WeekStrip } from "@/ui";
import { weekOf } from "@/ui/calendar-core";
import { useEventsRange, useTasks, useUpcomingTasks } from "@/data/hooks";
import {
  buildDayAgenda,
  buildDensityMap,
  type GoogleAgendaEvent,
} from "../calendar/agenda";
import { EventDetailSheet } from "../calendar/event-detail";
import { AgendaList } from "./agenda-list";
import { useTaskActions } from "./tasks/actions";
import { useToday } from "./tasks/screen-hooks";
import { TaskDetailSheet } from "./tasks/task-detail";

export function TodayAgenda({ google }: { google: GoogleAgendaEvent[] }) {
  const router = useRouter();
  const today = useToday();
  const actions = useTaskActions();

  const week = useMemo(() => weekOf(today), [today]);
  const weekEvents = useEventsRange(week[0], week[6]);
  const weekTasks = useUpcomingTasks(week[0], week[6]);
  const todayTasks = useTasks(today);

  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const density = useMemo(
    () =>
      buildDensityMap({
        events: weekEvents ?? [],
        tasks: weekTasks ?? [],
        google,
      }),
    [weekEvents, weekTasks, google],
  );

  const agenda = useMemo(
    () =>
      buildDayAgenda(today, {
        events: weekEvents ?? [],
        tasks: todayTasks ?? [],
        google,
      }),
    [today, weekEvents, todayTasks, google],
  );

  const loading = weekEvents === undefined || todayTasks === undefined;

  return (
    <section aria-label="Agenda" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Agenda</p>
        <Link
          href="/calendar"
          className="em-body-sm text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Calendario
        </Link>
      </div>

      <WeekStrip
        className="mt-3"
        value={today}
        markers={(day) => density.get(day) ?? 0}
        onChange={(day) => {
          if (day !== today) router.push(`/calendar?giorno=${day}`);
        }}
      />

      {loading ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : agenda.length > 0 ? (
        <div className="mt-2">
          <AgendaList
            items={agenda}
            onOpenEvent={setDetailEventId}
            onOpenTask={setDetailTaskId}
          />
        </div>
      ) : (
        <EmptyState
          compact
          heading="Niente in agenda oggi"
          text="Gli eventi si aggiungono dal Calendario; i task con orario compaiono qui."
        />
      )}

      <EventDetailSheet
        eventId={detailEventId}
        onClose={() => setDetailEventId(null)}
      />
      <TaskDetailSheet
        taskId={detailTaskId}
        today={today}
        actions={actions}
        onClose={() => setDetailTaskId(null)}
      />
    </section>
  );
}
