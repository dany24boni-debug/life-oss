import Link from "next/link";
import { StepShell } from "../_components/step-shell";
import { saveInitialState } from "../actions";

type StateChoice = "Esami" | "Manutenzione";

const OPTIONS: { v: StateChoice; l: string; d: string; emoji: string }[] = [
  {
    v: "Esami",
    l: "Esami",
    d: "Hai esami nei prossimi 6 settimane. Studio prevale, business in pausa.",
    emoji: "📚",
  },
  {
    v: "Manutenzione",
    l: "Manutenzione",
    d: "Default. Rotazione bilanciata su tutti i moduli attivi.",
    emoji: "⚙️",
  },
];

export function StateStep({ current }: { current: StateChoice | null }) {
  return (
    <StepShell
      step={5}
      title="Da dove parti?"
      subtitle="Lo State Engine modula i task in base al tuo stato. Scaling / Recupero / Vacanza si attivano dopo, da Impostazioni."
    >
      <form action={saveInitialState} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="sr-only">Stato iniziale</legend>
          {OPTIONS.map(({ v, l, d, emoji }) => (
            <label
              key={v}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors has-[:checked]:border-accent-info has-[:checked]:bg-accent-info/5"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-lg"
              >
                {emoji}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-base font-medium text-text-primary">{l}</span>
                <span className="block text-sm leading-snug text-text-secondary">{d}</span>
              </span>
              <input
                type="radio"
                name="state"
                value={v}
                defaultChecked={current === v || (current === null && v === "Manutenzione")}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-accent-info"
              />
            </label>
          ))}
        </fieldset>

        <p className="rounded-md border border-border bg-bg/40 px-3 py-2 text-xs text-text-muted">
          Gli altri 3 stati (Scaling, Recupero, Vacanza) si attivano dopo, da
          Impostazioni o dal Voglia Engine quando rileva uno slip.
        </p>

        <div className="flex gap-3 pt-2">
          <Link
            href="/onboarding?step=4"
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
