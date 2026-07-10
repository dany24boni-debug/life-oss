import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { createCustom, deleteCustom } from "./actions";

const KIND: Record<string, { label: string; emoji: string }> = {
  counter: { label: "Counter", emoji: "🔢" },
  streak: { label: "Streak", emoji: "🔥" },
  numeric: { label: "Numeric tracker", emoji: "📊" },
  calendar: { label: "Calendar", emoji: "📅" },
};

export default async function CustomIndexPage() {
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

  const { data: modules } = await supabase
    .from("custom_modules")
    .select("id, name, kind, config, include_in_daily_tasks")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const dailyCount = (modules ?? []).filter((m) => m.include_in_daily_tasks).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Layer custom</p>
          <h1 className="text-2xl font-semibold tracking-tight">Custom modules</h1>
          <div className="mt-2">
            <StatusPill
              label={
                (modules?.length ?? 0) === 0
                  ? "Nessun modulo"
                  : `${dailyCount}/${modules?.length} nei daily`
              }
              variant={(modules?.length ?? 0) > 0 ? "good" : "neutral"}
            />
          </div>
        </div>
        <Link
          href="/more"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Indietro
        </Link>
      </header>

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Crea modulo" />
        <form action={createCustom} className="mt-3 space-y-2">
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            aria-label="Nome modulo"
            placeholder="es. Pattinaggio sessions"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <select
            name="kind"
            defaultValue="counter"
            aria-label="Tipo di modulo"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
          >
            <option value="counter">Counter — quanti X totali</option>
            <option value="streak">Streak — azione giornaliera</option>
            <option value="numeric">Numeric — log con data + valore</option>
            <option value="calendar">Calendar — eventi datati</option>
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              name="unit"
              maxLength={20}
              aria-label="Unità di misura"
              placeholder="unit (es. libri, sessioni)"
              className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <input
              type="number"
              name="target"
              min={0}
              step="0.01"
              aria-label="Valore target"
              placeholder="target"
              className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
          </div>
          <input
            type="text"
            name="daily_action"
            maxLength={80}
            aria-label="Azione giornaliera per streak"
            placeholder="azione giornaliera (per streak)"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" name="include_in_daily" value="true" className="accent-accent-info" />
            <span>Includi nei daily tasks generati</span>
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Crea
          </button>
        </form>
      </section>

      {modules && modules.length > 0 ? (
        <section className="mt-7">
          <SectionHeader
            label="I tuoi moduli"
            meta={`${modules.length} totali`}
          />
          <ul className="mt-2 space-y-2">
            {modules.map((m) => {
              const kind = KIND[m.kind] ?? { label: m.kind, emoji: "✨" };
              const cfg = (m.config ?? {}) as { unit?: string; target?: number };
              const meta = [
                kind.label,
                m.include_in_daily_tasks ? "daily" : null,
                cfg.unit,
                cfg.target !== undefined ? `target ${cfg.target}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-text-muted"
                >
                  <Link
                    href={`/custom/${m.id}`}
                    className="flex flex-1 min-w-0 items-center gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base"
                    >
                      {kind.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-text-muted">{meta}</span>
                    </span>
                    <span aria-hidden className="text-text-muted">›</span>
                  </Link>
                  <form action={deleteCustom}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      aria-label="Elimina"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:text-accent-bad"
                    >
                      ×
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="mt-7 text-sm text-text-secondary">
          Nessun modulo custom ancora. Aggiungine uno sopra.
        </p>
      )}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Custom" />
    </main>
  );
}
