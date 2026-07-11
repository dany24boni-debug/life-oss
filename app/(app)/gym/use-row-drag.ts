"use client";

/**
 * Drag-to-reorder pointer-based per liste verticali di righe uniformi —
 * la stessa meccanica del riordino task (task-list.tsx): parte SOLO
 * dalla maniglia, muove con transform (60fps, niente layout), al
 * rilascio consegna (from, to) al chiamante. Fallback tastiera a carico
 * del chiamante (frecce nel menu riga).
 */

import { useRef, useState } from "react";

type DragState = {
  from: number;
  over: number;
  dy: number;
  height: number;
  pointerId: number;
};

export function useRowDrag(
  count: number,
  onDrop: (from: number, to: number) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowRefs = useRef<Array<HTMLElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);

  function setRowRef(index: number) {
    return (el: HTMLElement | null) => {
      rowRefs.current[index] = el;
    };
  }

  function startDrag(index: number, e: React.PointerEvent<HTMLElement>) {
    if (count < 2) return;
    e.preventDefault();
    const height = rowRefs.current[index]?.offsetHeight ?? 48;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    // Punti medi delle righe misurati ALLA PARTENZA: il bersaglio del
    // drop è la riga col punto medio più vicino al dito. Regge anche
    // liste non uniformi (intestazioni di sezione tra le righe).
    const midpoints = rowRefs.current
      .slice(0, count)
      .map((el) =>
        el ? el.getBoundingClientRect().top + el.offsetHeight / 2 : Infinity,
      );
    const state: DragState = {
      from: index,
      over: index,
      dy: 0,
      height,
      pointerId,
    };
    dragRef.current = state;
    setDrag(state);

    function nearestRow(pointerY: number): number {
      let best = index;
      let bestDist = Infinity;
      midpoints.forEach((mid, i) => {
        const dist = Math.abs(pointerY - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    }

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId || !dragRef.current) return;
      const dy = ev.clientY - startY;
      const over = nearestRow(ev.clientY);
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
      if (final && final.over !== final.from) onDrop(final.from, final.over);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
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

  return { drag, startDrag, rowTransform, setRowRef };
}

/** Sposta un elemento da `from` a `to` (indici clampati). */
export function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (next.length === 0) return next;
  const a = Math.max(0, Math.min(next.length - 1, from));
  const b = Math.max(0, Math.min(next.length - 1, to));
  if (a === b) return next;
  const [moved] = next.splice(a, 1);
  next.splice(b, 0, moved);
  return next;
}
