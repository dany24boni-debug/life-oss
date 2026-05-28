type Target = {
  id: string;
  module: string;
  metric: string;
  target_value: number;
  current_value: number;
};

const MODULE_LABEL: Record<string, string> = {
  gym: "Gym",
  health: "Health",
  finance: "Finance",
  chameleon_os: "Chameleon OS",
  studio: "Studio",
};

export function MonthlyTargets({ targets }: { targets: Target[] }) {
  if (targets.length === 0) {
    return (
      <article className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Targets del mese</p>
        <p className="mt-2 text-sm text-text-secondary">
          Imposta 1-3 numeri da chiudere questo mese da Impostazioni.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-text-muted">Targets del mese</p>
      <ul className="mt-3 space-y-3">
        {targets.map((t) => {
          const pct = t.target_value > 0 ? Math.min(100, (Number(t.current_value) / Number(t.target_value)) * 100) : 0;
          return (
            <li key={t.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="text-text-primary">{MODULE_LABEL[t.module] ?? t.module}</span>
                  <span className="ml-1 text-text-muted">{t.metric}</span>
                </span>
                <span className="tabular-nums text-text-secondary">
                  {Number(t.current_value).toLocaleString("it-IT")} / {Number(t.target_value).toLocaleString("it-IT")}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent-good transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
