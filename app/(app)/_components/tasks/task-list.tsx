"use client";

/**
 * Lista di task, opzionalmente riordinabile col drag (pointer-based, parte
 * SOLO dalla maniglia — così non litiga con lo swipe della riga) e con
 * fallback tastiera "Sposta su/giù" nel menu overflow. Al rilascio l'ordine
 * visivo diventa TasksRepo.reorder(orderedIds).
 */

import { useRef, useState } from "react";
import { cx } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import type { Task } from "@/data/schemas";
import type { TaskActions } from "./actions";
import { moveItem } from "./logic";
import { TaskItem } from "./task-item";

type DragState = {
  from: number;
  over: number;
  dy: number;
  height: number;
  pointerId: number;
};

export function TaskList({
  tasks,
  today,
  actions,
  onOpenDetail,
  onOpenSnooze,
  reorderable = false,
  showDate = false,
  compact = false,
}: {
  tasks: Task[];
  today: DayString;
  actions: TaskActions;
  onOpenDetail: (task: Task) => void;
  onOpenSnooze: (task: Task) => void;
  reorderable?: boolean;
  showDate?: boolean;
  compact?: boolean;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);

  function startDrag(index: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (!reorderable || tasks.length < 2) return;
    e.preventDefault();
    const height = rowRefs.current[index]?.offsetHeight ?? 48;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const state: DragState = { from: index, over: index, dy: 0, height, pointerId };
    dragRef.current = state;
    setDrag(state);

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId || !dragRef.current) return;
      const dy = ev.clientY - startY;
      const over = Math.max(
        0,
        Math.min(tasks.length - 1, index + Math.round(dy / height)),
      );
      const next = { ...dragRef.current, dy, over };
      dragRef.current = next;
      setDrag(next);
    }

    function onEnd(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      const final = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (final && final.over !== final.from) {
        const ids = moveItem(
          tasks.map((t) => t.id),
          final.from,
          final.over,
        );
        void actions.reorder(ids);
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
  }

  async function moveByKeyboard(index: number, delta: -1 | 1) {
    const ids = moveItem(
      tasks.map((t) => t.id),
      index,
      index + delta,
    );
    await actions.reorder(ids);
  }

  function rowTransform(index: number): string | undefined {
    if (!drag) return undefined;
    if (index === drag.from) return `translate3d(0,${drag.dy}px,0)`;
    if (drag.from < drag.over && index > drag.from && index <= drag.over) {
      return `translate3d(0,${-drag.height}px,0)`;
    }
    if (drag.from > drag.over && index >= drag.over && index < drag.from) {
      return `translate3d(0,${drag.height}px,0)`;
    }
    return undefined;
  }

  return (
    <ul className="divide-y divide-[var(--em-hairline)]">
      {tasks.map((task, i) => (
        <li
          key={task.id}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          style={{ transform: rowTransform(i) }}
          className={cx(
            drag && i === drag.from
              ? "relative z-10 shadow-[var(--em-e2)]"
              : "transition-transform duration-[var(--em-dur-control)]",
            drag && "select-none",
          )}
        >
          <TaskItem
            task={task}
            today={today}
            actions={actions}
            onOpenDetail={onOpenDetail}
            onOpenSnooze={onOpenSnooze}
            showDate={showDate}
            compact={compact}
            onMoveUp={reorderable && i > 0 ? () => void moveByKeyboard(i, -1) : undefined}
            onMoveDown={
              reorderable && i < tasks.length - 1
                ? () => void moveByKeyboard(i, 1)
                : undefined
            }
            dragHandleProps={
              reorderable && tasks.length > 1
                ? { onPointerDown: (e) => startDrag(i, e) }
                : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}
