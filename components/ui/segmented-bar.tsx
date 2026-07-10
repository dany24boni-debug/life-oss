// SegmentedBar — horizontal multi-segment breakdown bar with labels above.
//
// NOTE: the Pulse handoff (01-components.md §4) repurposes the name for a
// 7g/30g/Tutto filter control. That's a different component — it lives
// inline in /timeline (step 12). This file keeps the breakdown-chart use
// already wired across /recap (HEAVY/MEDIUM/LIGHT split) and /finance
// (entrate vs uscite). API unchanged. Pulse polish applied: filled
// segments now carry a soft drop-shadow per their tone via inline style.

type Segment = {
  label: string;
  value: number;
  color: string; // tailwind class on bg, e.g. "bg-accent-good"
};

export function SegmentedBar({
  segments,
  total,
  showLabels = true,
}: {
  segments: Segment[];
  total?: number;
  showLabels?: boolean;
}) {
  const sum = segments.reduce((a, b) => a + b.value, 0);
  const denom = total ?? sum;

  if (denom <= 0) {
    return (
      <div
        className="h-2 w-full rounded-full bg-border"
        role="img"
        aria-label="Segmented bar (empty)"
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {showLabels ? (
        <div className="flex justify-between gap-3 text-[10px] font-medium uppercase tracking-wider text-text-muted">
          <div className="flex flex-1 gap-3">
            {segments.map((s, i) => {
              const pct = (s.value / denom) * 100;
              return (
                <span
                  key={i}
                  style={{ flexGrow: pct }}
                  className="flex flex-col gap-0.5 text-text-secondary"
                >
                  <span className="text-text-primary">{s.label}</span>
                  <span className="tabular-nums text-text-muted">
                    {Math.round(pct)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-border">
        {segments.map((s, i) => {
          const pct = (s.value / denom) * 100;
          return (
            <div
              key={i}
              className={`h-full ${s.color} transition-all`}
              style={{
                width: `${pct}%`,
                marginRight: i < segments.length - 1 ? "2px" : 0,
              }}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
