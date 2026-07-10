"use client";

// BottomSheet — the touch-first modal: slides from the bottom, drag handle
// to dismiss (pointer events, 96px threshold or fast flick), safe-area
// padding, focus trap, Esc/overlay close.

import { useRef, useState } from "react";
import { cx } from "./cx";
import {
  Portal,
  useEscape,
  useFocusTrap,
  useLockBodyScroll,
} from "./internal";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; startAt: number } | null>(null);

  useFocusTrap(panelRef, open);
  useLockBodyScroll(open);
  useEscape(onClose, open);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startAt: Date.now() };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.startY));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const dt = Date.now() - drag.current.startAt;
    const velocity = dy / Math.max(dt, 1);
    drag.current = null;
    if (dy > 96 || velocity > 0.5) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div className="em-scope fixed inset-0 z-[90] bg-transparent">
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 bg-[var(--em-overlay)] animate-[em-fade-in_var(--em-dur-control)_linear]"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          style={{
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: dragY ? "none" : undefined,
          }}
          className={cx(
            "absolute inset-x-0 bottom-0 mx-auto max-w-lg",
            "rounded-t-[var(--em-r-xl)] bg-[var(--em-surface-2)] shadow-[var(--em-e3)]",
            "pb-[max(env(safe-area-inset-bottom),16px)]",
            "animate-[em-sheet-in_var(--em-dur-screen)_var(--em-ease-out)]",
            "max-h-[85dvh] overflow-y-auto overscroll-contain",
            className,
          )}
        >
          {/* Drag handle */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="sticky top-0 z-10 flex cursor-grab touch-none justify-center bg-[var(--em-surface-2)] pb-2 pt-3 active:cursor-grabbing"
          >
            <span
              aria-hidden="true"
              className="h-1 w-10 rounded-full bg-[var(--em-hairline-strong)]"
            />
          </div>
          <div className="px-5 pb-2">
            <h2 className="em-title mb-3 text-[var(--em-text)]">{title}</h2>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}
