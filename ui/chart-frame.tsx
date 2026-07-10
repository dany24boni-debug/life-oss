"use client";

// ChartFrame — the chart wrapper: eyebrow+title, legend, and the four
// states every chart needs (loading / empty / error / ready). Children is
// any SVG or chart markup; the frame guarantees consistent chrome.

import { cx } from "./cx";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";

export function ChartFrame({
  label,
  title,
  legend,
  state = "ready",
  emptyText = "Ancora nessun dato qui.",
  errorText = "Non sono riuscito a caricare i dati. Riprova.",
  minHeight = 180,
  caption,
  children,
  className,
}: {
  label?: string;
  title: string;
  legend?: Array<{ label: string; tone: "ember" | "salvia" | "segnale" | "neutral" }>;
  state?: "ready" | "loading" | "empty" | "error";
  emptyText?: string;
  errorText?: string;
  minHeight?: number;
  caption?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const toneBg = {
    ember: "bg-[var(--em-ember)]",
    salvia: "bg-[var(--em-salvia)]",
    segnale: "bg-[var(--em-segnale)]",
    neutral: "bg-[var(--em-text-3)]",
  } as const;

  return (
    <figure className={cx("em-card p-4", className)}>
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label ? <p className="em-eyebrow mb-0.5">{label}</p> : null}
          <p className="em-title text-[var(--em-text)]">{title}</p>
        </div>
        {legend && legend.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            {legend.map((l) => (
              <li
                key={l.label}
                className="em-body-sm flex items-center gap-1.5 text-[var(--em-text-3)]"
              >
                <span
                  aria-hidden="true"
                  className={cx("h-2 w-2 rounded-full", toneBg[l.tone])}
                />
                {l.label}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>

      <div style={{ minHeight }} className="grid">
        {state === "loading" ? (
          <div className="flex flex-col justify-end gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : state === "empty" ? (
          <EmptyState compact heading="Nessun dato" text={emptyText} />
        ) : state === "error" ? (
          <EmptyState compact heading="Qualcosa non va" text={errorText} />
        ) : (
          <div className="min-w-0 overflow-x-auto">{children}</div>
        )}
      </div>

      {caption && state === "ready" ? (
        <p className="em-body-sm mt-2 text-[var(--em-text-3)]">{caption}</p>
      ) : null}
    </figure>
  );
}
