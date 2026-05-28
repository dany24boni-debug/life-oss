type State = "Esami" | "Scaling" | "Manutenzione" | "Recupero" | "Vacanza" | null;

const STATE_TONE: Record<Exclude<State, null>, string> = {
  Esami: "text-accent-bad border-accent-bad/40 bg-accent-bad/10",
  Scaling: "text-accent-energy border-accent-energy/40 bg-accent-energy/10",
  Manutenzione: "text-accent-info border-accent-info/40 bg-accent-info/10",
  Recupero: "text-accent-warn border-accent-warn/40 bg-accent-warn/10",
  Vacanza: "text-accent-good border-accent-good/40 bg-accent-good/10",
};

export function StateBadge({ state }: { state: State }) {
  if (!state) {
    return (
      <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted">
        no state
      </span>
    );
  }
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATE_TONE[state]}`}>
      {state}
    </span>
  );
}
