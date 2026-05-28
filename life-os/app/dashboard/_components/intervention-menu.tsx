import { chooseIntervention } from "../actions";

const OPTIONS = [
  {
    v: "recupero",
    title: "Modalità Recupero",
    desc: "Programma minimo, streak protetto. Solo non-negotiables.",
    tone: "border-accent-info/40 bg-accent-info/10 text-accent-info",
  },
  {
    v: "focus_one",
    title: "Focus monoprogetto",
    desc: "Solo un progetto prioritario, salta il resto della lista.",
    tone: "border-accent-energy/40 bg-accent-energy/10 text-accent-energy",
  },
  {
    v: "active_pause",
    title: "Pausa attiva",
    desc: "Musica + 30 min Claude Code, basta.",
    tone: "border-accent-good/40 bg-accent-good/10 text-accent-good",
  },
  {
    v: "force_all",
    title: "Forza tutto",
    desc: "Lista piena, niente sensi di colpa.",
    tone: "border-accent-warn/40 bg-accent-warn/10 text-accent-warn",
  },
] as const;

export function InterventionMenu({
  detectionId,
  reason,
}: {
  detectionId: string;
  reason: string;
}) {
  return (
    <article className="rounded-xl border border-accent-info/40 bg-accent-info/5 p-5">
      <p className="text-xs uppercase tracking-wide text-accent-info">
        Voglia Engine — slip rilevato
      </p>
      <p className="mt-2 text-sm text-text-primary">{reason}</p>
      <p className="mt-1 text-sm text-text-secondary">Cosa fai oggi?</p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map((o) => (
          <form key={o.v} action={chooseIntervention} className="block">
            <input type="hidden" name="detection_id" value={detectionId} />
            <input type="hidden" name="choice" value={o.v} />
            <button
              type="submit"
              className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${o.tone}`}
            >
              <span className="block text-sm font-medium text-text-primary">{o.title}</span>
              <span className="block text-xs text-text-secondary">{o.desc}</span>
            </button>
          </form>
        ))}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        La tua streak è protetta durante l&apos;intervento.
      </p>
    </article>
  );
}
