type Goal = {
  id: string;
  category: string;
  text: string;
  target_date: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  financial: "Finanziario",
  business: "Business",
  education: "Studio",
  health: "Salute",
  life: "Vita",
};

export function WhyPanel({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <details className="rounded-xl border border-border bg-surface p-5">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-text-muted">
          Why Panel
        </summary>
        <p className="mt-3 text-sm text-text-secondary">
          Aggiungi i tuoi obiettivi a 24 mesi da Impostazioni.
        </p>
      </details>
    );
  }

  return (
    <details className="rounded-xl border border-border bg-surface p-5" open>
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-text-muted">
        Why Panel — i tuoi 24 mesi
      </summary>
      <ul className="mt-3 space-y-2.5">
        {goals.map((g) => (
          <li key={g.id} className="text-sm leading-snug">
            <span className="text-text-muted">{CATEGORY_LABEL[g.category] ?? g.category}:</span>{" "}
            <span className="text-text-primary">{g.text}</span>
            {g.target_date ? (
              <span className="ml-1 text-xs text-text-muted">— {formatItalianDate(g.target_date)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatItalianDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { month: "short", year: "numeric" });
}
