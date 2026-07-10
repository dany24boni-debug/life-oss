// Evidence — typed-union dispatcher for InsightEvidence.
//
// InsightToneCard hands this an `InsightEvidence` (5 kinds) plus a tone,
// and gets back the right Pulse mini-visual. Exhaustive over `kind` —
// adding a new evidence kind in lib/types.ts will produce a TS error here
// until handled.
import type { InsightEvidence, ToneKey } from "@/lib/types";

import { StreakBars } from "./streak-bars";
import { ProgressDots } from "./progress-dots";
import { WeekdayBars } from "./weekday-bars";
import { SleepDots } from "./sleep-dots";
import { ScatterMini } from "./scatter-mini";

export function Evidence({
  evidence,
  tone = "info",
}: {
  evidence: InsightEvidence;
  tone?: ToneKey;
}) {
  switch (evidence.kind) {
    case "streakBars":
      return <StreakBars values={evidence.values} tone={tone} />;
    case "progressDots":
      return (
        <ProgressDots
          current={evidence.current}
          target={evidence.target}
          tone={tone}
        />
      );
    case "weekdayBars":
      return <WeekdayBars days={evidence.days} tone={tone} />;
    case "sleepDots":
      return <SleepDots nights={evidence.nights} tone={tone} />;
    case "scatter":
      return (
        <ScatterMini
          points={evidence.points}
          threshold={evidence.threshold}
          tone={tone}
        />
      );
  }
}

export { StreakBars, ProgressDots, WeekdayBars, SleepDots, ScatterMini };
