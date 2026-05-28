import { StepShell } from "../_components/step-shell";
import { saveProfile } from "../actions";

export function ProfileStep({ defaultDisplayName }: { defaultDisplayName: string }) {
  return (
    <StepShell
      step={1}
      title="Benvenuto"
      subtitle="Come ti chiamiamo? Useremo questo nome ovunque nell'app."
    >
      <form action={saveProfile} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm text-text-secondary">Il tuo nome</span>
          <input
            type="text"
            name="display_name"
            required
            minLength={1}
            maxLength={60}
            defaultValue={defaultDisplayName}
            placeholder="Il tuo nome"
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-text-primary px-4 py-3 text-base font-medium text-bg transition-opacity hover:opacity-90"
        >
          Continua
        </button>
      </form>
    </StepShell>
  );
}
