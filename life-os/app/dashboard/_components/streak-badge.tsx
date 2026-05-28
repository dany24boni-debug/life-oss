export function StreakBadge({ count, best }: { count: number; best: number }) {
  const color = count >= 3 ? "text-accent-good" : count >= 1 ? "text-accent-energy" : "text-text-muted";
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-text-muted">Streak</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold tabular-nums ${color}`}>{count}</span>
        <span className="text-xs text-text-muted">giorni</span>
      </div>
      {best > 0 ? (
        <p className="mt-1 text-xs text-text-muted">Record: {best}</p>
      ) : null}
    </article>
  );
}
