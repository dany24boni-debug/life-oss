import Link from "next/link";
import { StepShell } from "../_components/step-shell";
import { saveEnergy } from "../actions";

type Profile = {
  chronotype: string | null;
  wake_time: string | null;
  sleep_time: string | null;
  timezone: string | null;
};

export function EnergyStep({ profile }: { profile: Profile }) {
  const chronotype = profile.chronotype ?? "intermediate";
  const wake = (profile.wake_time ?? "09:00").slice(0, 5);
  const sleep = (profile.sleep_time ?? "01:00").slice(0, 5);
  const tz = profile.timezone ?? "Europe/Rome";

  return (
    <StepShell
      step={2}
      title="Quando hai energia?"
      subtitle="Servono per dosare i blocchi della giornata e capire la tua peak window."
    >
      <form action={saveEnergy} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm text-text-secondary">Cronotipo</legend>
          {[
            { v: "morning", l: "Mattutino — meglio prima delle 12" },
            { v: "intermediate", l: "Intermedio — bene tutto il giorno" },
            { v: "evening", l: "Serotino — sveglio meglio la sera" },
          ].map(({ v, l }) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm has-[:checked]:border-accent-info has-[:checked]:bg-accent-info/5"
            >
              <input
                type="radio"
                name="chronotype"
                value={v}
                defaultChecked={chronotype === v}
                className="accent-accent-info"
              />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm text-text-secondary">Sveglia</span>
            <input
              type="time"
              name="wake_time"
              defaultValue={wake}
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text-primary focus:border-accent-info focus:outline-none"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-text-secondary">Sonno</span>
            <input
              type="time"
              name="sleep_time"
              defaultValue={sleep}
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text-primary focus:border-accent-info focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-text-secondary">Fuso orario</span>
          <select
            name="timezone"
            defaultValue={tz}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text-primary focus:border-accent-info focus:outline-none"
          >
            <option value="Europe/Rome">Europe/Rome (IT)</option>
            <option value="Europe/London">Europe/London (UK)</option>
            <option value="Europe/Madrid">Europe/Madrid (ES)</option>
            <option value="America/New_York">America/New_York (US ET)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (US PT)</option>
          </select>
        </label>

        <div className="flex gap-3">
          <Link
            href="/onboarding?step=1"
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
