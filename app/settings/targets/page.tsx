import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { todayInTimezone } from "@/lib/tasks/generator";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { addTarget, updateCurrent, deleteTarget } from "./actions";

const MODULE_LABEL: Record<string, string> = {
  gym: "Gym",
  health: "Health",
  finance: "Finance",
  chameleon_os: "Chameleon OS",
  studio: "Studio",
};

export default async function TargetsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const timezone = profile.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);
  const currentMonth = today.slice(0, 7);

  const [{ data: targets }, { data: activeModulesRaw }] = await Promise.all([
    supabase
      .from("user_monthly_targets")
      .select("id, module, metric, target_value, current_value, month")
      .eq("user_id", user.id)
      .order("month", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("user_modules")
      .select("module_slug, modules_registry(name)")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  const activeModules = (activeModulesRaw ?? []).map((row) => {
    const reg = row.modules_registry as { name: string } | { name: string }[] | null;
    const moduleName = Array.isArray(reg) ? reg[0]?.name : reg?.name;
    return { slug: row.module_slug, name: moduleName ?? row.module_slug };
  });

  // Group targets by month string for tidy rendering.
  const byMonth = new Map<string, typeof targets>();
  for (const t of targets ?? []) {
    const arr = byMonth.get(t.month) ?? [];
    (arr as typeof targets)!.push(t);
    byMonth.set(t.month, arr as typeof targets);
  }

  // Render most-recent month first regardless of insertion order. The query
  // above already sorts ascending by created_at within a month and descending
  // by month, but never trust that — sort the entries explicitly here.
  const monthsDescending = [...byMonth.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  const currentMonthTargets = (targets ?? []).filter((t) => t.month.startsWith(currentMonth));
  const onTrack = currentMonthTargets.filter(
    (t) => Number(t.target_value) > 0 && Number(t.current_value ?? 0) / Number(t.target_value) >= 0.5,
  ).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Mese</p>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly targets</h1>
          <div className="mt-2">
            <StatusPill
              label={
                currentMonthTargets.length === 0
                  ? "Nessun target del mese"
                  : `${onTrack}/${currentMonthTargets.length} on-track`
              }
              variant={
                currentMonthTargets.length === 0
                  ? "neutral"
                  : onTrack === currentMonthTargets.length
                    ? "good"
                    : onTrack > 0
                      ? "warn"
                      : "bad"
              }
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

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Aggiungi / aggiorna target" meta="upsert" />
        <form action={addTarget} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <select
              name="module"
              required
              defaultValue={activeModules[0]?.slug ?? ""}
              aria-label="Modulo target"
              className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
            >
              <option value="">— modulo —</option>
              {activeModules.map((m) => (
                <option key={m.slug} value={m.slug}>{m.name}</option>
              ))}
              <option value="studio">Studio</option>
            </select>
            <input
              type="month"
              name="month"
              required
              defaultValue={currentMonth}
              aria-label="Mese di riferimento"
              className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              name="metric"
              required
              maxLength={40}
              aria-label="Nome metrica"
              placeholder="metrica (es. revenue_eur, sessions)"
              className="flex-1 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <input
              type="number"
              name="target_value"
              required
              min={0}
              step="0.01"
              aria-label="Valore target"
              placeholder="target"
              className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <input
              type="number"
              name="current_value"
              min={0}
              step="0.01"
              defaultValue={0}
              aria-label="Valore già raggiunto"
              placeholder="già fatto"
              className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Salva target
          </button>
        </form>
        <p className="mt-2 text-xs text-text-muted">
          Stesso modulo+metrica+mese sovrascrive il valore esistente (upsert).
        </p>
      </section>

      {targets && targets.length > 0 ? (
        <>
          {monthsDescending.map(([month, list]) => (
            <section key={month} className="mt-5 rounded-xl border border-border bg-surface p-5">
              <SectionHeader
                label={formatMonth(month)}
                meta={`${(list ?? []).length} target`}
              />
              <ul className="mt-3 divide-y divide-border">
                {(list ?? []).map((t) => {
                  const cur = Number(t.current_value ?? 0);
                  const tgt = Number(t.target_value);
                  const pct = tgt > 0 ? Math.min(100, (cur / tgt) * 100) : 0;
                  return (
                    <li key={t.id} className="space-y-2 py-3">
                      <div className="flex items-baseline justify-between text-sm">
                        <span>
                          <span className="text-text-primary">{MODULE_LABEL[t.module] ?? t.module}</span>
                          <span className="ml-1 text-text-muted">{t.metric}</span>
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {cur.toLocaleString("it-IT")} / {tgt.toLocaleString("it-IT")}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-accent-good transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <form action={updateCurrent} className="flex flex-1 items-center gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <input
                            type="number"
                            name="current_value"
                            defaultValue={cur}
                            min={0}
                            step="0.01"
                            aria-label={`Valore corrente per ${t.module} ${t.metric}`}
                            className="w-28 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text-primary focus:border-accent-info focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                          >
                            Aggiorna
                          </button>
                        </form>
                        <form action={deleteTarget}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            aria-label="Elimina"
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
            </section>
          ))}
        </>
      ) : (
        <p className="mt-4 text-sm text-text-secondary">
          Nessun target ancora. Aggiungine 1-3 sopra — appaiono in dashboard come progress bar.
        </p>
      )}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function formatMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}
