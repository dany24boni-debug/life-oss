import Link from "next/link";
import { StepShell } from "../_components/step-shell";
import { saveModules } from "../actions";

type Module = {
  slug: string;
  name: string;
  description: string | null;
};

const SLUG_EMOJI: Record<string, string> = {
  gym: "💪",
  health: "💧",
  finance: "💶",
  chameleon_os: "🦎",
};

export function ModulesStep({
  available,
  activeSlugs,
}: {
  available: Module[];
  activeSlugs: Set<string>;
}) {
  const initiallyActive =
    activeSlugs.size > 0 ? activeSlugs : new Set(available.map((m) => m.slug));

  return (
    <StepShell
      step={4}
      title="Quali moduli attivi?"
      subtitle="Sceglierai cosa entra nelle giornate. Puoi cambiare in qualunque momento da Impostazioni."
    >
      <form action={saveModules} className="space-y-4">
        <fieldset>
          <legend className="sr-only">Moduli da attivare</legend>
        <ul className="space-y-2">
          {available.map((m) => (
            <li key={m.slug}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors has-[:checked]:border-accent-info has-[:checked]:bg-accent-info/5">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-lg"
                >
                  {SLUG_EMOJI[m.slug] ?? "✨"}
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-base font-medium text-text-primary">
                    {m.name}
                  </span>
                  {m.description ? (
                    <span className="block text-sm leading-snug text-text-secondary">
                      {m.description}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  name="modules"
                  value={m.slug}
                  defaultChecked={initiallyActive.has(m.slug)}
                  aria-label={`Attiva ${m.name}`}
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-accent-info"
                />
              </label>
            </li>
          ))}
        </ul>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <Link
            href="/onboarding?step=3"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-center text-base font-medium text-text-secondary transition-opacity hover:opacity-90"
          >
            Indietro
          </Link>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-text-primary px-4 py-3 text-base font-medium text-bg transition-opacity hover:opacity-90"
          >
            Continua
          </button>
        </div>
      </form>
    </StepShell>
  );
}
