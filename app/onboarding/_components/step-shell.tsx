import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/status-pill";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<Step, string> = {
  1: "Profilo",
  2: "Energia",
  3: "Direzione",
  4: "Moduli",
  5: "Stato",
  6: "Targets",
};

const STEP_EMOJI: Record<Step, string> = {
  1: "👤",
  2: "🔋",
  3: "🎯",
  4: "🧩",
  5: "🎚️",
  6: "📈",
};

export function StepShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: Step;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-10">
      <div className="w-full max-w-md space-y-7">
        <header className="space-y-3">
          <ProgressDots step={step} />
          <div className="flex items-center justify-between">
            <StatusPill label={`${step} di 6`} variant="live" withDot={false} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {STEP_LABELS[step]}
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-2xl"
          >
            {STEP_EMOJI[step]}
          </span>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          ) : null}
        </div>

        {children}
      </div>
    </main>
  );
}

function ProgressDots({ step }: { step: Step }) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={6}
      aria-valuenow={step}
      aria-label={`Passo ${step} di 6`}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => {
        const reached = i <= step;
        const current = i === step;
        return (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              current
                ? "bg-text-primary"
                : reached
                  ? "bg-text-secondary/60"
                  : "bg-border"
            }`}
          />
        );
      })}
    </div>
  );
}
