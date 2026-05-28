import Link from "next/link";
import { StepShell } from "../_components/step-shell";
import { saveTargetsAndComplete } from "../actions";

type Module = { slug: string; name: string };

type ExistingTarget = {
  module: string;
  metric: string;
  target_value: number;
};

const SLOTS = 3;

const METRIC_PRESETS: Record<string, string[]> = {
  gym: ["sessions", "volume_kg"],
  health: ["water_l_avg", "sleep_h_avg"],
  finance: ["revenue_eur", "expenses_eur"],
  chameleon_os: ["revenue_eur", "milestones"],
};

export function TargetsStep({
  activeModules,
  monthLabel,
  existing,
}: {
  activeModules: Module[];
  monthLabel: string;
  existing: ExistingTarget[];
}) {
  const rows = Array.from({ length: SLOTS }, (_, i) => existing[i] ?? null);

  return (
    <StepShell
      step={6}
      title={`Targets per ${monthLabel}`}
      subtitle="1-3 numeri che vuoi chiudere questo mese. Compaiono in dashboard come progress bar."
    >
      <form action={saveTargetsAndComplete} className="space-y-5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-2 rounded-md border border-border bg-surface p-3"
          >
            <div className="flex gap-2">
              <select
                name={`module_${i}`}
                defaultValue={row?.module ?? activeModules[0]?.slug ?? ""}
                aria-label={`Modulo target ${i + 1}`}
                className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              >
                <option value="">— modulo —</option>
                {activeModules.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name={`metric_${i}`}
                defaultValue={row?.metric ?? ""}
                list={`metrics-${i}`}
                aria-label={`Metrica target ${i + 1}`}
                placeholder="metrica"
                maxLength={40}
                className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
              />
              <datalist id={`metrics-${i}`}>
                {Object.values(METRIC_PRESETS)
                  .flat()
                  .map((m) => (
                    <option key={m} value={m} />
                  ))}
              </datalist>
              <input
                type="number"
                name={`target_value_${i}`}
                defaultValue={row?.target_value ?? ""}
                step="0.01"
                min="0"
                aria-label={`Valore target ${i + 1}`}
                placeholder="valore"
                className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
              />
            </div>
          </div>
        ))}

        <p className="text-xs text-text-muted">
          Lascia vuoto per saltare. Puoi aggiungere/modificare ogni mese da Impostazioni.
        </p>

        <div className="flex gap-3">
          <Link
            href="/onboarding?step=5"
            className="flex-1 rounded-md border border-border bg-surface px-4 py-3 text-center text-base font-medium text-text-secondary transition-opacity hover:opacity-90"
          >
            Indietro
          </Link>
          <button
            type="submit"
            className="flex-1 rounded-md bg-accent-good px-4 py-3 text-base font-medium text-bg transition-opacity hover:opacity-90"
          >
            Completa
          </button>
        </div>
      </form>
    </StepShell>
  );
}
