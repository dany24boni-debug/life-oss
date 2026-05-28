import { saveMood } from "../actions";

export function MoodSlider({ todaysMood }: { todaysMood: number | null }) {
  if (todaysMood !== null) {
    return (
      <article className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-text-muted">Mood oggi</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-2xl">{MOOD_EMOJI[todaysMood]}</p>
          <p className="text-xs text-text-muted">
            {todaysMood}/5 — {MOOD_LABEL[todaysMood]}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">Mood di oggi</p>
      <p className="mt-1 text-xs text-text-secondary">Opzionale, salta pure.</p>
      <div className="mt-3 flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <form key={v} action={saveMood} className="flex-1">
            <input type="hidden" name="mood" value={v} />
            <button
              type="submit"
              aria-label={`Mood ${v} — ${MOOD_LABEL[v]}`}
              className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-bg py-2 text-xl transition-colors hover:border-accent-info"
            >
              <span>{MOOD_EMOJI[v]}</span>
              <span className="text-[10px] text-text-muted">{v}</span>
            </button>
          </form>
        ))}
      </div>
    </article>
  );
}

const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

const MOOD_LABEL: Record<number, string> = {
  1: "male",
  2: "fiacco",
  3: "ok",
  4: "bene",
  5: "carico",
};
