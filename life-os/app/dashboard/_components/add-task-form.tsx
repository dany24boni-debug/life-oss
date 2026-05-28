import { addManualTask } from "../actions";

type Module = { slug: string; name: string };

export function AddTaskForm({ activeModules }: { activeModules: Module[] }) {
  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-text-muted">
        + aggiungi task manuale
      </summary>
      <form action={addManualTask} className="mt-3 space-y-2">
        <input
          type="text"
          name="title"
          required
          maxLength={120}
          placeholder="es. Studio sessione 90 min"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
        />
        <div className="flex gap-2">
          <select
            name="module"
            defaultValue={activeModules[0]?.slug ?? "general"}
            className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
          >
            {activeModules.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
            <option value="general">Generale</option>
            <option value="studio">Studio</option>
          </select>
          <select
            name="weight"
            defaultValue="LIGHT"
            className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
          >
            <option value="HEAVY">HEAVY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LIGHT">LIGHT</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-text-primary px-3 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Aggiungi
          </button>
        </div>
      </form>
    </details>
  );
}
