// StatCard — dense card showing one metric with optional sparkline + status dot.

import { Sparkline } from "./sparkline";

type Status = "good" | "warn" | "bad" | "neutral";

const STATUS_DOT: Record<Status, string> = {
  good: "bg-accent-good",
  warn: "bg-accent-warn",
  bad: "bg-accent-bad",
  neutral: "bg-text-muted/50",
};

// Italian text equivalents of the colour-only dot, surfaced via sr-only span
// so AT users get the status (WCAG 1.4.1 Use of Color).
const STATUS_LABEL: Record<Status, string> = {
  good: "stato buono",
  warn: "attenzione",
  bad: "critico",
  neutral: "",
};

export function StatCard({
  label,
  value,
  unit,
  subtitle,
  status = "neutral",
  trend,
  trendColor = "good",
}: {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  status?: Status;
  trend?: number[];
  trendColor?: "good" | "warn" | "bad" | "info" | "energy";
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
          {label}
        </p>
        <span
          className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
          aria-hidden="true"
        />
        {status !== "neutral" ? (
          <span className="sr-only">{STATUS_LABEL[status]}</span>
        ) : null}
      </header>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums leading-none tracking-tight text-text-primary">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-text-muted">{unit}</span>
        ) : null}
      </div>

      {subtitle ? (
        <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
      ) : null}

      {trend && trend.length > 1 ? (
        <div className="mt-3 -mx-1">
          <Sparkline data={trend} width={140} height={28} color={trendColor} />
        </div>
      ) : null}
    </article>
  );
}
