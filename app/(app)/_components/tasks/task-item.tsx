"use client";

/**
 * Riga task (B2.1). Interazioni:
 *   - toggle di completamento ottimista (rollback locale se il port dice ko)
 *   - tap sulla riga -> scheda dettaglio
 *   - touch: swipe destro = completa, swipe sinistro = menu snooze
 *     (solo pointerType "touch"; il verticale resta del browser: pan-y)
 *   - desktop: azioni al passaggio del mouse
 *   - menu overflow: fallback tastiera/accessibilità per swipe e riordino
 * Nessun dialogo di conferma: le azioni reversibili passano dal toast undo.
 */

import { useEffect, useRef, useState } from "react";
import { cx } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import type { Task } from "@/data/schemas";
import {
  IconCheck,
  IconClock,
  IconDots,
  IconGrip,
  IconRepeat,
  IconTrash,
} from "../icons";
import type { TaskActions } from "./actions";
import { dayHeading } from "./logic";

const SWIPE_TRIGGER = 72; // px oltre cui il rilascio esegue l'azione
const SWIPE_MAX = 128;

export type TaskItemProps = {
  task: Task;
  today: DayString;
  actions: TaskActions;
  onOpenDetail: (task: Task) => void;
  onOpenSnooze: (task: Task) => void;
  /** Mostra il giorno nella riga (In ritardo, Fatti). */
  showDate?: boolean;
  /** Variante compatta (sezione Task di Oggi). */
  compact?: boolean;
  /** Fallback tastiera del riordino (menu overflow). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Handler pointer-down del drag (fornito dalla lista riordinabile). */
  dragHandleProps?: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  };
};

export function TaskItem({
  task,
  today,
  actions,
  onOpenDetail,
  onOpenSnooze,
  showDate = false,
  compact = false,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
}: TaskItemProps) {
  const [pendingDone, setPendingDone] = useState<boolean | null>(null);
  // Il liveQuery conferma (o smentisce) l'ottimismo: quando lo stato reale
  // cambia, quello locale si dimette (aggiustamento in render, non effect).
  const [seenStatus, setSeenStatus] = useState(task.status);
  if (task.status !== seenStatus) {
    setSeenStatus(task.status);
    setPendingDone(null);
  }
  const done = pendingDone ?? task.status === "done";

  async function toggleDone() {
    const target = !done;
    setPendingDone(target);
    const ok = target
      ? await actions.complete(task)
      : await actions.uncomplete(task);
    if (!ok) setPendingDone(null); // rollback visivo
  }

  // ── Swipe (solo touch, solo task aperti) ──────────────────────────────
  const [dx, setDx] = useState(0);
  const swipe = useRef<{
    id: number;
    startX: number;
    startY: number;
    locked: "h" | "v" | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const swipeEnabled = task.status === "open";

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!swipeEnabled || e.pointerType !== "touch") return;
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    swipe.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      locked: null,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    const ddx = e.clientX - s.startX;
    const ddy = e.clientY - s.startY;
    if (s.locked === null) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      s.locked = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      if (s.locked === "h") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        suppressClick.current = true;
      }
    }
    if (s.locked !== "h") return;
    setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, ddx)));
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    const wasH = s.locked === "h";
    swipe.current = null;
    if (wasH) {
      if (dx >= SWIPE_TRIGGER) void toggleDone();
      else if (dx <= -SWIPE_TRIGGER) onOpenSnooze(task);
      setDx(0);
      // Il click sintetico post-swipe non deve aprire il dettaglio.
      setTimeout(() => (suppressClick.current = false), 0);
    }
  }

  const meta: React.ReactNode[] = [];
  if (showDate && task.date) {
    meta.push(
      <span key="date" className="em-num">
        {dayHeading(task.date, today).toLowerCase()}
      </span>,
    );
  }
  if (task.time) {
    meta.push(
      <span key="time" className="em-num">
        {task.time}
      </span>,
    );
  }
  if (task.recurrence) {
    // Il glifo quieto dei ricorrenti (run-09): si ripete, senza parole.
    meta.push(
      <span key="rec" title="Si ripete" aria-label="si ripete">
        <IconRepeat className="h-3.5 w-3.5" />
      </span>,
    );
  }
  if (task.priority) {
    meta.push(
      <span
        key="prio"
        className={cx(
          "font-[family-name:var(--em-font-mono)]",
          task.priority === 1 && "text-[var(--em-ember-text)]",
          task.priority === 2 && "text-[var(--em-text-2)]",
        )}
      >
        P{task.priority}
      </span>,
    );
  }
  if (task.subtasks.length > 0) {
    meta.push(
      <span key="sub" className="em-num">
        {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
      </span>,
    );
  }
  if (!compact && task.tags.length > 0) {
    meta.push(
      <span key="tags" className="truncate">
        {task.tags.map((t) => `#${t}`).join(" ")}
      </span>,
    );
  }

  return (
    <div className="group relative overflow-hidden">
      {/* Sfondi rivelati dallo swipe */}
      {swipeEnabled ? (
        <div aria-hidden="true" className="absolute inset-0 flex">
          <div
            className={cx(
              "flex flex-1 items-center gap-2 bg-[var(--em-salvia-tint)] pl-5 text-[var(--em-salvia-text)] transition-opacity duration-[var(--em-dur-tap)]",
              dx > 0 ? "opacity-100" : "opacity-0",
            )}
          >
            <IconCheck className="h-5 w-5" />
            <span className="em-body-sm font-semibold">Fatto</span>
          </div>
          <div
            className={cx(
              "flex flex-1 items-center justify-end gap-2 bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)] pr-5 text-[var(--em-text-2)] transition-opacity duration-[var(--em-dur-tap)]",
              dx < 0 ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="em-body-sm font-semibold">Sposta</span>
            <IconClock className="h-5 w-5" />
          </div>
        </div>
      ) : null}

      {/* Contenuto della riga */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: dx !== 0 ? `translate3d(${dx}px,0,0)` : undefined,
          transition: dx !== 0 ? "none" : undefined,
        }}
        className={cx(
          "relative flex items-center gap-1 bg-[var(--em-surface)] pl-1 pr-1",
          "touch-pan-y transition-transform duration-[var(--em-dur-card)]",
        )}
      >
        <button
          type="button"
          data-no-swipe
          onClick={() => void toggleDone()}
          aria-label={done ? `Riapri: ${task.title}` : `Completa: ${task.title}`}
          aria-pressed={done}
          className="grid h-11 w-11 shrink-0 place-items-center"
        >
          <span
            className={cx(
              "grid h-6 w-6 place-items-center rounded-full transition-[background,box-shadow] duration-[var(--em-dur-tap)]",
              done
                ? "bg-[var(--em-ember)]"
                : "shadow-[inset_0_0_0_1.5px_var(--em-hairline-strong)] group-hover:shadow-[inset_0_0_0_1.5px_var(--em-text-3)]",
            )}
          >
            <IconCheck
              className={cx(
                "h-3.5 w-3.5 transition-opacity duration-[var(--em-dur-tap)]",
                done ? "stroke-[var(--em-on-ember)] opacity-100" : "opacity-0",
              )}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) return;
            onOpenDetail(task);
          }}
          className={cx(
            "min-w-0 flex-1 text-left",
            compact ? "py-2" : "py-2.5",
          )}
        >
          <span
            className={cx(
              "em-body block truncate",
              done
                ? "text-[var(--em-text-3)] line-through decoration-[var(--em-hairline-strong)]"
                : "text-[var(--em-text)]",
            )}
          >
            {task.title}
          </span>
          {meta.length > 0 ? (
            <span className="em-body-sm mt-0.5 flex flex-wrap items-center gap-x-2 text-[var(--em-text-3)]">
              {meta}
            </span>
          ) : null}
        </button>

        {/* Azioni desktop al passaggio del mouse */}
        {task.status === "open" ? (
          <span
            data-no-swipe
            className="hidden shrink-0 items-center opacity-0 transition-opacity duration-[var(--em-dur-control)] focus-within:opacity-100 group-hover:opacity-100 md:flex"
          >
            <IconButton
              label={`Sposta: ${task.title}`}
              onClick={() => onOpenSnooze(task)}
            >
              <IconClock className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Elimina: ${task.title}`}
              onClick={() => void actions.remove(task)}
            >
              <IconTrash className="h-4 w-4" />
            </IconButton>
          </span>
        ) : null}

        <RowMenu
          task={task}
          actions={actions}
          onOpenSnooze={onOpenSnooze}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />

        {dragHandleProps ? (
          <button
            type="button"
            data-no-swipe
            aria-hidden="true"
            tabIndex={-1}
            {...dragHandleProps}
            className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-[var(--em-text-3)] active:cursor-grabbing"
          >
            <IconGrip className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_9%,transparent)] hover:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}

/** Menu overflow della riga: fallback accessibile di swipe e riordino. */
function RowMenu({
  task,
  actions,
  onOpenSnooze,
  onMoveUp,
  onMoveDown,
}: {
  task: Task;
  actions: TaskActions;
  onOpenSnooze: (task: Task) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: Array<{ label: string; danger?: boolean; run: () => void }> = [];
  if (onMoveUp) items.push({ label: "Sposta su", run: onMoveUp });
  if (onMoveDown) items.push({ label: "Sposta giù", run: onMoveDown });
  if (task.status === "open") {
    items.push({ label: "Sposta a…", run: () => onOpenSnooze(task) });
  } else {
    items.push({ label: "Riapri", run: () => void actions.uncomplete(task) });
  }
  items.push({
    label: "Elimina",
    danger: true,
    run: () => void actions.remove(task),
  });

  return (
    <span ref={rootRef} data-no-swipe className="relative shrink-0">
      <button
        type="button"
        aria-label={`Altre azioni: ${task.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-9 place-items-center text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
      >
        <IconDots className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Azioni task"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-1 shadow-[var(--em-e3)] animate-[em-pop-in_var(--em-dur-control)_var(--em-ease-out)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className={cx(
                "em-body-sm block w-full rounded-[var(--em-r-sm)] px-3 py-2.5 text-left transition-colors duration-[var(--em-dur-tap)]",
                item.danger
                  ? "text-[var(--em-segnale-text)] hover:bg-[var(--em-segnale-tint)]"
                  : "text-[var(--em-text)] hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
