"use client";

// Modal — portal, overlay, focus trap, Esc/overlay close, scroll lock,
// focus restore. Centered card on all sizes (BottomSheet is the touch-first
// alternative for pickers/menus).
//
// run-13: exit is animated (em-pop-out/em-fade-out, shorter than the enter,
// --em-ease-in) with unmount on animationend + timeout fallback. Under
// prefers-reduced-motion the gate clamps it to 0.01ms — instant, as before.

import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import {
  Portal,
  useEscape,
  useFocusTrap,
  useLockBodyScroll,
} from "./internal";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Action row, typically Buttons. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const closing = shown && !open;

  useFocusTrap(panelRef, open);
  useLockBodyScroll(open);
  useEscape(onClose, open);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setShown(false), 400);
    return () => clearTimeout(t);
  }, [closing]);

  if (!shown) return null;

  return (
    <Portal>
      <div
        className={cx(
          "em-scope fixed inset-0 z-[90] bg-transparent",
          closing && "pointer-events-none",
        )}
      >
        <div
          aria-hidden="true"
          onClick={onClose}
          className={cx(
            "absolute inset-0 bg-[var(--em-overlay)] backdrop-blur-[2px]",
            closing
              ? "animate-[em-fade-out_var(--em-dur-control)_linear_forwards]"
              : "animate-[em-fade-in_var(--em-dur-control)_linear]",
          )}
        />
        <div className="absolute inset-0 grid place-items-center overflow-y-auto p-5">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            onAnimationEnd={(e) => {
              if (closing && e.target === panelRef.current) setShown(false);
            }}
            className={cx(
              "relative w-full max-w-md rounded-[var(--em-r-xl)] bg-[var(--em-surface-2)] p-6 shadow-[var(--em-e3)]",
              closing
                ? "animate-[em-pop-out_var(--em-dur-control)_var(--em-ease-in)_forwards]"
                : "animate-[em-pop-in_var(--em-dur-card)_var(--em-ease-out)]",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="em-title text-[var(--em-text)]">{title}</h2>
                {description ? (
                  <p className="em-body-sm mt-1 text-[var(--em-text-2)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={onClose}
                className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_9%,transparent)] hover:text-[var(--em-text)]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {children ? <div className="mt-4">{children}</div> : null}
            {footer ? (
              <div className="mt-6 flex justify-end gap-2">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}
