"use client";

// Toast — provider + useToast(). Stacks up to 3, auto-dismisses (5s,
// paused on hover/focus), supports an action slot (the undo pattern),
// aria-live polite region. Tones: neutral / success / error.
//
// run-13: dismissal is animated — the card plays em-toast-out and calls
// onDone on animationend (timeout fallback). Eviction by stack overflow
// (a 4th toast arriving) still removes the oldest instantly: that path
// unmounts from outside the card, declared and accepted.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cx } from "./cx";
import { Portal } from "./internal";

export type ToastInput = {
  message: string;
  tone?: "neutral" | "success" | "error";
  /** e.g. { label: "Annulla", onClick: restore } */
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastApi = {
  show: (t: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast richiede <ToastProvider> come antenato");
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: ToastInput) => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-2), { ...t, id }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <Portal>
        <div
          aria-live="polite"
          aria-label="Notifiche"
          className="em-scope pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-[100] flex flex-col items-center gap-2 bg-transparent px-4"
        >
          {items.map((t) => (
            <ToastCard key={t.id} item={t} onDone={() => dismiss(t.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

const TONE_BAR: Record<NonNullable<ToastInput["tone"]>, string> = {
  neutral: "bg-[var(--em-text-3)]",
  success: "bg-[var(--em-salvia)]",
  error: "bg-[var(--em-segnale)]",
};

function ToastCard({
  item,
  onDone,
}: {
  item: ToastItem;
  onDone: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const remaining = useRef(item.durationMs ?? 5000);
  const lastTick = useRef(0);

  useEffect(() => {
    if (leaving) return;
    lastTick.current = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      if (!paused) {
        remaining.current -= now - lastTick.current;
        if (remaining.current <= 0) {
          clearInterval(iv);
          setLeaving(true);
        }
      }
      lastTick.current = now;
    }, 100);
    return () => clearInterval(iv);
  }, [paused, leaving]);

  // Fallback if animationend never fires (reduced-motion clamps it to
  // 0.01ms, so this only covers pathological cases).
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 400);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div
      ref={cardRef}
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onAnimationEnd={(e) => {
        if (leaving && e.target === cardRef.current) onDone();
      }}
      className={cx(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden",
        "rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] py-3 pl-4 pr-2 shadow-[var(--em-e3)]",
        leaving
          ? "animate-[em-toast-out_var(--em-dur-control)_var(--em-ease-in)_forwards]"
          : "animate-[em-toast-in_var(--em-dur-card)_var(--em-ease-out)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-8 w-1 shrink-0 rounded-full",
          TONE_BAR[item.tone ?? "neutral"],
        )}
      />
      <p className="em-body-sm min-w-0 flex-1 text-[var(--em-text)]">
        {item.message}
      </p>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            setLeaving(true);
          }}
          className="em-body-sm shrink-0 rounded-[var(--em-r-sm)] px-2.5 py-1.5 font-semibold text-[var(--em-ember-text)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[var(--em-ember-tint)]"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Chiudi notifica"
        onClick={() => setLeaving(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_9%,transparent)] hover:text-[var(--em-text)]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
