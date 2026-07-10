"use client";

/**
 * Sezione Task di Oggi (B2.1, "Today wiring"): la lista compatta di oggi
 * sul port reale, il FAB col quick-add in sheet, e uno stato vuoto SOLO
 * quando è genuinamente vuoto — se hai già fatto tutto lo dice, non finge
 * il nulla. Righe complete di toggle/undo/swipe/scheda come su /tasks.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomSheet, Button, EmptyState, Modal, Skeleton } from "@/ui";
import { useOverdueTasks, useTasks } from "@/data/hooks";
import type { Task } from "@/data/schemas";
import { IconPlus } from "../icons";
import {
  consumeQuickAddRequest,
  onQuickAddRequest,
} from "../quick-add-bus";
import { useTaskActions } from "./actions";
import { QuickAdd } from "./quick-add";
import { useIsDesktop, useToday } from "./screen-hooks";
import { SnoozeMenu } from "./snooze-menu";
import { TaskDetailSheet } from "./task-detail";
import { TaskList } from "./task-list";

// Il ToastProvider vive nel layout del gruppo (run-03 prompt 5).
export function TodayTasks() {
  return <TodayTasksInner />;
}

function TodayTasksInner() {
  const today = useToday();
  const actions = useTaskActions();
  const isDesktop = useIsDesktop();
  const tasks = useTasks(today);
  const overdue = useOverdueTasks(today);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [snoozeTask, setSnoozeTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // "Nuovo task…" da palette o scorciatoia `n` (run-05 prompt 6): apre lo
  // sheet; una richiesta partita PRIMA del mount viene consumata subito
  // dopo (timeout 0: lo stato cambia in un callback, mai nel corpo
  // dell'effect — regola set-state-in-effect).
  useEffect(() => {
    const pending = setTimeout(() => {
      if (consumeQuickAddRequest()) setAddOpen(true);
    }, 0);
    const unsubscribe = onQuickAddRequest(() => {
      consumeQuickAddRequest();
      setAddOpen(true);
    });
    return () => {
      clearTimeout(pending);
      unsubscribe();
    };
  }, []);

  const loading = tasks === undefined || overdue === undefined;
  const open = (tasks ?? []).filter((t) => t.status === "open");
  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;

  const quickAddBody = (
    <div className="pb-3">
      <QuickAdd today={today} defaultDate={today} autoFocus />
      <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
        Capisco date, orari, priorità e tag: prova &ldquo;domani alle 18 spesa
        #casa !!&rdquo;.
      </p>
    </div>
  );

  return (
    <section aria-label="Task" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Task</p>
        <Link
          href="/tasks"
          className="em-body-sm text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Tutti i task
        </Link>
      </div>

      {loading ? (
        <div className="mt-3 flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : open.length > 0 ? (
        <div className="mt-1">
          <TaskList
            tasks={open}
            today={today}
            actions={actions}
            onOpenDetail={(t) => setDetailId(t.id)}
            onOpenSnooze={(t) => setSnoozeTask(t)}
            compact
          />
        </div>
      ) : doneCount > 0 ? (
        <p className="em-body mt-3 text-[var(--em-text-2)]">
          Tutto fatto per oggi ·{" "}
          <span className="em-num">{doneCount}</span>{" "}
          {doneCount === 1 ? "task completato" : "task completati"}
        </p>
      ) : (
        <EmptyState
          compact
          heading="Niente per oggi"
          text="Aggiungi il primo task della giornata."
          action={
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              Aggiungi task
            </Button>
          }
        />
      )}

      {!loading && overdue.length > 0 ? (
        <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
          <span className="em-num">{overdue.length}</span> in ritardo ·{" "}
          <Link
            href="/tasks"
            className="underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
          >
            sistemali nei Task
          </Link>
        </p>
      ) : null}
      {!loading && open.length > 0 && doneCount > 0 ? (
        <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
          <span className="em-num">{doneCount}</span>{" "}
          {doneCount === 1 ? "fatta oggi" : "fatte oggi"}
        </p>
      ) : null}

      {/* FAB: quick-add ovunque su Oggi */}
      <button
        type="button"
        aria-label="Aggiungi un task"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--em-ember)] text-[var(--em-on-ember)] shadow-[var(--em-e3)] transition-transform duration-[var(--em-dur-tap)] active:scale-95 md:bottom-8 md:right-8"
      >
        <IconPlus className="h-6 w-6" />
      </button>

      {isDesktop ? (
        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nuovo task">
          {addOpen ? quickAddBody : null}
        </Modal>
      ) : (
        <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Nuovo task">
          {quickAddBody}
        </BottomSheet>
      )}

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
    </section>
  );
}
