"use client";

/**
 * "La tua giornata" — la timeline unica di Oggi (run-11 P3, CROSS-05/
 * WOW-09): la sezione Agenda e la card "Adesso" CONVERGONO qui, come da
 * risoluzione della PROP — meno sezioni, più senso. In UNA colonna in
 * ordine d'ora: slot del piano (check nativo di SlotRow, tap/gesto
 * lungo), eventi locali e Google, task con orario (check con undo),
 * fasi focus concluse; in testa la fascia senza orario — marker
 * palestra (deep-link alla card della scheda), marker pasti, eventi
 * all-day e i task senza orario NELL'ORDINE PLAYLIST del rituale, con
 * la stima quieta quando c'è. Il cursore ember segna adesso. Ogni voce
 * conserva il SUO gesto: qui non si inventa nessuno stato nuovo.
 */

import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { cx, EmptyState, Skeleton, WeekStrip } from "@/ui";
import { weekOf } from "@/ui/calendar-core";
import {
  useDayDiet,
  useEventsRange,
  useFocusSessions,
  useGymSessionsByDay,
  useNextUpDay,
  useTasks,
  useUpcomingTasks,
} from "@/data/hooks";
import {
  buildDayAgenda,
  buildDensityMap,
  instantHhmmInZone,
  type GoogleAgendaEvent,
} from "../calendar/agenda";
import { EventDetailSheet } from "../calendar/event-detail";
import { gymCardHref } from "../gym/card-history";
import { findNowSlot, hhmmToMinutes } from "../settimana/logic";
import { SlotRow } from "../settimana/week-board";
import { AgendaRow } from "./agenda-list";
import { formatMin } from "./format-min";
import { APP_TIME_ZONE } from "./tasks/logic";
import { useTaskActions } from "./tasks/actions";
import { useToday } from "./tasks/screen-hooks";
import { TaskDetailSheet } from "./tasks/task-detail";
import {
  buildTimedStream,
  nowCursorIndex,
  orderBandTasks,
} from "./timeline-logic";
import { useNowHhmm, useTodayPlanSlots } from "./today-adesso";

export function TodayTimeline({ google }: { google: GoogleAgendaEvent[] }) {
  const router = useRouter();
  const today = useToday();
  const actions = useTaskActions();
  const nowHhmm = useNowHhmm();

  const week = useMemo(() => weekOf(today), [today]);
  const weekEvents = useEventsRange(week[0], week[6]);
  const weekTasks = useUpcomingTasks(week[0], week[6]);
  const todayTasks = useTasks(today);
  const { isoWeek, hasPlan, entries } = useTodayPlanSlots();
  const focusSessions = useFocusSessions(today);
  const dayDiet = useDayDiet(today);
  const nextUp = useNextUpDay();
  const gymSessions = useGymSessionsByDay(today);

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

  // Il merge d'agenda esistente + la decorazione run-11: la stima del
  // task come annotazione quieta ("30'"), dalla mappa dei task di oggi.
  const agenda = useMemo(() => {
    const items = buildDayAgenda(today, {
      events: weekEvents ?? [],
      tasks: todayTasks ?? [],
      google,
    });
    const byId = new Map((todayTasks ?? []).map((t) => [t.id, t]));
    return items.map((item) => {
      if (item.source !== "task") return item;
      const estimate = byId.get(item.id)?.estimate_min ?? null;
      return estimate !== null
        ? { ...item, meta: formatMin(estimate) }
        : item;
    });
  }, [today, weekEvents, todayTasks, google]);

  // Fascia senza orario: task in ordine playlist (sort_order di oggi).
  const band = useMemo(
    () =>
      orderBandTasks(
        agenda.filter((i) => i.allDay),
        (todayTasks ?? []).map((t) => t.id),
      ),
    [agenda, todayTasks],
  );

  const focusRows = useMemo(
    () =>
      (focusSessions ?? []).map((s) => ({
        id: s.id,
        hhmm: instantHhmmInZone(s.created_at, APP_TIME_ZONE),
        minutes: s.minutes,
      })),
    [focusSessions],
  );

  const timed = useMemo(
    () =>
      buildTimedStream({ items: agenda, slots: entries ?? [], focus: focusRows }),
    [agenda, entries, focusRows],
  );
  const nowMin = hhmmToMinutes(nowHhmm);
  const cursor = nowCursorIndex(timed, nowMin);
  const currentSlotId = findNowSlot(entries ?? [], nowHhmm).currentId;

  // Marker palestra: lo stato di oggi in UNA riga (la sezione Palestra
  // sotto resta il pannello coi numeri; qui è il posto nel flusso).
  const activeGym = (gymSessions ?? []).find((s) => s.finished_at === null);
  const doneGym = (gymSessions ?? []).find((s) => s.finished_at !== null);
  const gymMarker =
    gymSessions === undefined
      ? null
      : activeGym !== undefined
        ? {
            title: "Palestra · in corso",
            chip: "riprendi",
            done: false,
            href:
              activeGym.program_day_id !== null
                ? gymCardHref(activeGym.program_day_id)
                : "/gym",
          }
        : doneGym !== undefined
          ? {
              title: "Palestra · fatta",
              chip: null,
              done: true,
              href:
                doneGym.program_day_id !== null
                  ? gymCardHref(doneGym.program_day_id)
                  : "/gym",
            }
          : nextUp !== undefined && nextUp !== null
            ? {
                title: `Palestra · ${nextUp.name}`,
                chip: "suggerita",
                done: false,
                href: gymCardHref(nextUp.id),
              }
            : null;

  // Marker pasti: quanti dei pasti del piano di oggi sono fatti.
  const dietMarker =
    dayDiet === undefined || dayDiet.meals.length === 0
      ? null
      : {
          eaten: dayDiet.meals.filter((m) => m.eaten).length,
          total: dayDiet.meals.length,
        };

  const loading =
    weekEvents === undefined ||
    todayTasks === undefined ||
    hasPlan === undefined;
  const empty =
    !loading &&
    band.length === 0 &&
    timed.length === 0 &&
    gymMarker === null &&
    dietMarker === null;

  return (
    <section aria-label="La tua giornata" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">La tua giornata</p>
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
      ) : empty ? (
        <EmptyState
          compact
          heading="Giornata libera"
          text="Niente in agenda: eventi dal Calendario, task con la loro ora, slot dal piano della settimana."
        />
      ) : (
        <ul className="mt-2 flex flex-col">
          {gymMarker !== null ? (
            <MarkerRow
              href={gymMarker.href}
              title={gymMarker.title}
              chip={gymMarker.chip}
              done={gymMarker.done}
            />
          ) : null}
          {dietMarker !== null ? (
            <MarkerRow
              href="/dieta"
              title="Pasti"
              meta={`${dietMarker.eaten} di ${dietMarker.total}`}
              done={dietMarker.eaten === dietMarker.total}
            />
          ) : null}
          {band.map((item) => (
            <li key={item.key}>
              <AgendaRow
                item={item}
                onOpenEvent={setDetailEventId}
                onOpenTask={setDetailTaskId}
              />
            </li>
          ))}
          {timed.map((e, i) => {
            const rows: ReactElement[] = [];
            if (i === cursor && timed.length > 0) {
              rows.push(<NowCursor key="now" />);
            }
            if (e.kind === "slot") {
              rows.push(
                <SlotRow
                  key={`slot:${e.entry.slot.id}`}
                  entry={e.entry}
                  isoWeek={isoWeek}
                  current={e.entry.slot.id === currentSlotId}
                  editable
                />,
              );
            } else if (e.kind === "item") {
              rows.push(
                <li key={e.item.key}>
                  <AgendaRow
                    item={e.item}
                    onOpenEvent={setDetailEventId}
                    onOpenTask={setDetailTaskId}
                  />
                </li>,
              );
            } else {
              rows.push(
                <li
                  key={`focus:${e.id}`}
                  className="flex min-h-11 items-start gap-3 border-b border-[var(--em-hairline)] py-2.5 last:border-b-0"
                >
                  <span className="em-body-sm em-num w-[4.75rem] shrink-0 pt-0.5 text-left text-[var(--em-text-3)]">
                    {e.hhmm}
                  </span>
                  <span className="em-body min-w-0 flex-1 truncate text-[var(--em-text-3)]">
                    Focus
                  </span>
                  <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
                    {formatMin(e.minutes)}
                  </span>
                </li>,
              );
            }
            return rows;
          })}
          {timed.length > 0 && cursor === timed.length ? (
            <NowCursor key="now-end" />
          ) : null}
        </ul>
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

/** Il cursore "adesso": punto ember + filo, muto per gli screen reader
 *  (l'informazione vera è negli orari delle righe). */
function NowCursor() {
  return (
    <li aria-hidden="true" className="flex items-center gap-2 py-1">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--em-ember)]" />
      <span className="h-px flex-1 bg-[var(--em-hairline-strong)]" />
    </li>
  );
}

/** Riga-marker della fascia senza orario (palestra, pasti): un link
 *  quieto nella stessa griglia delle righe d'agenda. */
function MarkerRow({
  href,
  title,
  chip,
  meta,
  done,
}: {
  href: string;
  title: string;
  chip?: string | null;
  meta?: string;
  done: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-start gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
      >
        <span className="em-body-sm w-[4.75rem] shrink-0 pt-0.5 text-left text-[var(--em-text-3)]">
          giornata
        </span>
        <span
          className={cx(
            "em-body min-w-0 flex-1 truncate",
            done ? "text-[var(--em-text-3)]" : "text-[var(--em-text)]",
          )}
        >
          {title}
        </span>
        {meta !== undefined ? (
          <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
            {meta}
          </span>
        ) : null}
        {chip !== null && chip !== undefined ? (
          <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)]">
            {chip}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
