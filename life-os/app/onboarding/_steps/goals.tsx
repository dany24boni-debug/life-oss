import Link from "next/link";
import { StepShell } from "../_components/step-shell";
import { saveGoals } from "../actions";

type ExistingGoal = {
  category: string;
  text: string;
  target_date: string | null;
};

const CATEGORIES = [
  { v: "financial", l: "Finanziario" },
  { v: "business", l: "Business" },
  { v: "education", l: "Studio" },
  { v: "health", l: "Salute" },
  { v: "life", l: "Vita" },
];

const SLOTS = 5;

export function GoalsStep({ existing }: { existing: ExistingGoal[] }) {
  const rows = Array.from({ length: SLOTS }, (_, i) => existing[i] ?? null);

  return (
    <StepShell
      step={3}
      title="Dove stai andando?"
      subtitle="3-5 traguardi a 24 mesi. Questi finiscono nel Why Panel — il riferimento quando cala la voglia."
    >
      <form action={saveGoals} className="space-y-5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-2 rounded-md border border-border bg-surface p-3"
          >
            <div className="flex gap-2">
              <select
                name={`category_${i}`}
                defaultValue={row?.category ?? CATEGORIES[i % CATEGORIES.length].v}
                aria-label={`Categoria goal ${i + 1}`}
                className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.l}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name={`target_date_${i}`}
                defaultValue={row?.target_date ?? ""}
                aria-label={`Data target goal ${i + 1}`}
                className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              />
            </div>
            <textarea
              name={`text_${i}`}
              defaultValue={row?.text ?? ""}
              rows={2}
              maxLength={500}
              aria-label={`Testo goal ${i + 1}`}
              placeholder={
                i === 0
                  ? "es. reddito stabile da attività business + side projects"
                  : "Obiettivo a 24 mesi (lascia vuoto per saltare)"
              }
              className="w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
          </div>
        ))}

        <div className="flex gap-3">
          <Link
            href="/onboarding?step=2"
            className="flex-1 rounded-md border border-border bg-surface px-4 py-3 text-center text-base font-medium text-text-secondary transition-opacity hover:opacity-90"
          >
            Indietro
          </Link>
          <button
            type="submit"
            className="flex-1 rounded-md bg-text-primary px-4 py-3 text-base font-medium text-bg transition-opacity hover:opacity-90"
          >
            Continua
          </button>
        </div>
      </form>
    </StepShell>
  );
}
