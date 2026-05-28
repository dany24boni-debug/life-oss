import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { addGoal, deleteGoal, toggleVisibility } from "./actions";

const CATEGORIES = [
  { v: "financial", l: "Finanziario", emoji: "💶" },
  { v: "business", l: "Business", emoji: "💼" },
  { v: "education", l: "Studio", emoji: "📚" },
  { v: "health", l: "Salute", emoji: "💪" },
  { v: "life", l: "Vita", emoji: "🌍" },
];

const CATEGORY_BY_KEY: Record<string, { l: string; emoji: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c.v, { l: c.l, emoji: c.emoji }]),
);

export default async function GoalsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const { data: goals } = await supabase
    .from("user_long_term_goals")
    .select("id, category, text, target_date, is_visible_in_why_panel")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const visibleCount = (goals ?? []).filter((g) => g.is_visible_in_why_panel).length;
  const totalCount = goals?.length ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Why Panel</p>
          <h1 className="text-2xl font-semibold tracking-tight">Long-term goals</h1>
          <div className="mt-2">
            <StatusPill
              label={`${visibleCount}/${totalCount} visibili`}
              variant={totalCount > 0 ? "good" : "neutral"}
            />
          </div>
        </div>
        <Link
          href="/settings"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Indietro
        </Link>
      </header>

      <section className="mt-7">
        <SectionHeader label="Aggiungi goal" meta="24 mesi" />
        <div className="mt-2 rounded-xl border border-border bg-surface p-5">
          <form action={addGoal} className="space-y-2">
            <div className="flex gap-2">
              <select
                name="category"
                defaultValue="life"
                aria-label="Categoria goal"
                className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.emoji} {c.l}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="target_date"
                aria-label="Data target (opzionale)"
                className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              />
            </div>
            <textarea
              name="text"
              required
              rows={2}
              maxLength={500}
              aria-label="Testo del goal"
              placeholder="es. Vivere bene nella città che amo, con vita sociale piena"
              className="w-full resize-none rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              + goal
            </button>
          </form>
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader
          label="I tuoi goal"
          meta={totalCount > 0 ? `${totalCount} totali` : "vuoto"}
        />
        {goals && goals.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {goals.map((g) => {
              const cat = CATEGORY_BY_KEY[g.category] ?? { l: g.category, emoji: "•" };
              const visible = g.is_visible_in_why_panel;
              return (
                <li
                  key={g.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    visible
                      ? "border-border bg-surface"
                      : "border-border/50 bg-surface/50 opacity-70"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base"
                  >
                    {cat.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {cat.l}
                    </p>
                    <p
                      className={`mt-0.5 text-sm leading-snug ${
                        visible ? "text-text-primary" : "text-text-muted line-through"
                      }`}
                    >
                      {g.text}
                    </p>
                    {g.target_date ? (
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        entro {formatItalianDate(g.target_date)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <form action={toggleVisibility}>
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="next" value={visible ? "false" : "true"} />
                      <button
                        type="submit"
                        aria-label={visible ? "Nascondi dal Why Panel" : "Mostra nel Why Panel"}
                        aria-pressed={visible}
                        title={visible ? "Nascondi dal Why Panel" : "Mostra nel Why Panel"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary"
                      >
                        {visible ? "👁" : "🙈"}
                      </button>
                    </form>
                    <form action={deleteGoal}>
                      <input type="hidden" name="id" value={g.id} />
                      <button
                        type="submit"
                        aria-label="Elimina goal"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:text-accent-bad"
                      >
                        ×
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Ancora nessun goal. Aggiungine uno sopra — finisce nel Why Panel del dashboard.
          </p>
        )}
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function formatItalianDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { month: "short", year: "numeric" });
}
