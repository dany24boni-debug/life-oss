"use client";

/**
 * Schermata /tasks (B2.1): quick-add persistente + quattro viste come Tabs
 * Ember — Oggi (scadenze di oggi con gli arretrati raccolti sotto "In
 * ritardo"), Prossimi (7 giorni raggruppati), Inbox (senza data), Fatti
 * (archivio paginato). Tutto passa da port/hook: qui non esiste Dexie.
 */

import { useEffect, useState } from "react";
import { Button, EmptyState, Skeleton, Tabs } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import {
  useDoneTasks,
  useInboxTasks,
  useOverdueTasks,
  useTasks,
  useUpcomingTasks,
} from "@/data/hooks";
import type { Task } from "@/data/schemas";
import {
  consumeQuickAddRequest,
  onQuickAddRequest,
} from "../_components/quick-add-bus";
import { useTaskActions, type TaskActions } from "../_components/tasks/actions";
import { dayHeading, groupTasksByDay, upcomingRange } from "../_components/tasks/logic";
import { QuickAdd } from "../_components/tasks/quick-add";
import { useToday } from "../_components/tasks/screen-hooks";
import { SnoozeMenu } from "../_components/tasks/snooze-menu";
import { TaskDetailSheet } from "../_components/tasks/task-detail";
import { TaskList } from "../_components/tasks/task-list";

const TAB_ITEMS = [
  { value: "oggi", label: "Oggi" },
  { value: "prossimi", label: "Prossimi" },
  { value: "inbox", label: "Inbox" },
  { value: "fatti", label: "Fatti" },
];

/** Prop comuni a ogni vista: azioni + apertura di scheda e snooze. */
type ViewCtx = {
  today: DayString;
  actions: TaskActions;
  onOpenDetail: (task: Task) => void;
  onOpenSnooze: (task: Task) => void;
};

// Il ToastProvider vive nel layout del gruppo (run-03 prompt 5).
export function TasksScreen() {
  return <Screen />;
}

function Screen() {
  const today = useToday();
  const actions = useTaskActions();
  const [tab, setTab] = useState("oggi");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [snoozeTask, setSnoozeTask] = useState<Task | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  // "Nuovo task…" (run-05 prompt 6): qui il quick-add è persistente, la
  // richiesta diventa un focus sull'input — anche se arrivata prima del
  // mount (navigazione dalla palette su un'altra schermata; consumo in
  // un callback differito, mai nel corpo dell'effect).
  useEffect(() => {
    const pending = setTimeout(() => {
      if (consumeQuickAddRequest()) setFocusToken((n) => n + 1);
    }, 0);
    const unsubscribe = onQuickAddRequest(() => {
      consumeQuickAddRequest();
      setFocusToken((n) => n + 1);
    });
    return () => {
      clearTimeout(pending);
      unsubscribe();
    };
  }, []);

  const ctx: ViewCtx = {
    today,
    actions,
    onOpenDetail: (t) => setDetailId(t.id),
    onOpenSnooze: (t) => setSnoozeTask(t),
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-2">
        <p className="em-eyebrow">Modulo</p>
        <h1 className="em-title-lg mt-1 text-[var(--em-text)]">Task</h1>
      </header>

      <QuickAdd
        today={today}
        defaultDate={tab === "oggi" ? today : undefined}
        focusToken={focusToken}
      />

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab}>
        {(active) =>
          active === "oggi" ? (
            <ViewOggi ctx={ctx} />
          ) : active === "prossimi" ? (
            <ViewProssimi ctx={ctx} />
          ) : active === "inbox" ? (
            <ViewInbox ctx={ctx} />
          ) : (
            <ViewFatti ctx={ctx} />
          )
        }
      </Tabs>

      <TaskDetailSheet
        taskId={detailId}
        today={today}
        actions={actions}
        onClose={() => setDetailId(null)}
      />
      <SnoozeMenu
        task={snoozeTask}
        today={today}
        actions={actions}
        onClose={() => setSnoozeTask(null)}
      />
    </div>
  );
}

/* ── Viste ─────────────────────────────────────────────────────────────── */

function ViewOggi({ ctx }: { ctx: ViewCtx }) {
  const todays = useTasks(ctx.today);
  const overdue = useOverdueTasks(ctx.today);
  if (todays === undefined || overdue === undefined) return <ListSkeleton />;

  const open = todays.filter((t) => t.status === "open");
  const done = todays
    .filter((t) => t.status === "done")
    .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      {overdue.length > 0 ? (
        <section aria-label="In ritardo" className="em-card overflow-hidden px-2 pb-1 pt-2">
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <p className="em-eyebrow">In ritardo · {overdue.length}</p>
            <Button
              size="sm"
              onClick={() => void ctx.actions.moveAllToToday(overdue, ctx.today)}
            >
              Sposta tutte a oggi
            </Button>
          </div>
          <TaskList
            tasks={overdue}
            today={ctx.today}
            actions={ctx.actions}
            onOpenDetail={ctx.onOpenDetail}
            onOpenSnooze={ctx.onOpenSnooze}
            showDate
          />
        </section>
      ) : null}

      {open.length > 0 ? (
        <section aria-label="Task di oggi" className="em-card overflow-hidden px-2 py-1">
          <TaskList
            tasks={open}
            today={ctx.today}
            actions={ctx.actions}
            onOpenDetail={ctx.onOpenDetail}
            onOpenSnooze={ctx.onOpenSnooze}
            reorderable
          />
        </section>
      ) : overdue.length === 0 ? (
        <section className="em-card p-5">
          <EmptyState
            heading={done.length > 0 ? "Tutto fatto per oggi" : "Niente per oggi"}
            text={
              done.length > 0
                ? `Hai completato ${done.length === 1 ? "1 task" : `${done.length} task`}. Il resto può aspettare domani.`
                : "Aggiungi un task qui sopra: capisco date, orari, priorità e tag al volo."
            }
          />
        </section>
      ) : null}

      {done.length > 0 ? (
        <section aria-label="Fatte oggi" className="em-card overflow-hidden px-2 pb-1 pt-2">
          <p className="em-eyebrow px-2 pb-1">Fatte · {done.length}</p>
          <TaskList
            tasks={done}
            today={ctx.today}
            actions={ctx.actions}
            onOpenDetail={ctx.onOpenDetail}
            onOpenSnooze={ctx.onOpenSnooze}
          />
        </section>
      ) : null}
    </div>
  );
}

function ViewProssimi({ ctx }: { ctx: ViewCtx }) {
  const range = upcomingRange(ctx.today);
  const tasks = useUpcomingTasks(range.from, range.to);
  if (tasks === undefined) return <ListSkeleton />;

  const open = tasks.filter((t) => t.status === "open");
  if (open.length === 0) {
    return (
      <section className="em-card p-5">
        <EmptyState
          heading="Nessun task nei prossimi 7 giorni"
          text="Scrivi una scadenza nel quick-add: domani, ven, tra 3 giorni, 15/08."
        />
      </section>
    );
  }

  const groups = groupTasksByDay(open);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section
          key={g.day}
          aria-label={dayHeading(g.day, ctx.today)}
          className="em-card overflow-hidden px-2 pb-1 pt-2"
        >
          <p className="em-eyebrow px-2 pb-1">{dayHeading(g.day, ctx.today)}</p>
          <TaskList
            tasks={g.tasks}
            today={ctx.today}
            actions={ctx.actions}
            onOpenDetail={ctx.onOpenDetail}
            onOpenSnooze={ctx.onOpenSnooze}
            reorderable
          />
        </section>
      ))}
    </div>
  );
}

function ViewInbox({ ctx }: { ctx: ViewCtx }) {
  const tasks = useInboxTasks();
  if (tasks === undefined) return <ListSkeleton />;

  const open = tasks.filter((t) => t.status === "open");
  if (open.length === 0) {
    return (
      <section className="em-card p-5">
        <EmptyState
          heading="Inbox vuota"
          text="I task senza data finiscono qui, in attesa di un giorno."
        />
      </section>
    );
  }

  return (
    <section aria-label="Inbox" className="em-card overflow-hidden px-2 py-1">
      <TaskList
        tasks={open}
        today={ctx.today}
        actions={ctx.actions}
        onOpenDetail={ctx.onOpenDetail}
        onOpenSnooze={ctx.onOpenSnooze}
        reorderable
      />
    </section>
  );
}

const DONE_PAGE = 50;

function ViewFatti({ ctx }: { ctx: ViewCtx }) {
  const [limit, setLimit] = useState(DONE_PAGE);
  const tasks = useDoneTasks(limit);
  if (tasks === undefined) return <ListSkeleton />;

  if (tasks.length === 0) {
    return (
      <section className="em-card p-5">
        <EmptyState
          heading="Ancora niente qui"
          text="I task completati arrivano in questo archivio, più recenti prima."
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Fatti" className="em-card overflow-hidden px-2 py-1">
        <TaskList
          tasks={tasks}
          today={ctx.today}
          actions={ctx.actions}
          onOpenDetail={ctx.onOpenDetail}
          onOpenSnooze={ctx.onOpenSnooze}
          showDate
        />
      </section>
      {tasks.length === limit ? (
        <Button onClick={() => setLimit((l) => l + DONE_PAGE)} className="self-center">
          Carica altri
        </Button>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-2/3" />
    </div>
  );
}
