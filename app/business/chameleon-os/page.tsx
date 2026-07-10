import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { getPrivateWhitelist } from "@/lib/auth/whitelist";
import { todayInTimezone } from "@/lib/tasks/generator";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DateToggle } from "@/components/ui/date-toggle";
import { BusinessTabs } from "../_components/business-tabs";
import { addMilestone, setMilestoneStatus, deleteMilestone, logSync } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  todo: "Todo",
  in_progress: "In corso",
  done: "Done",
  dropped: "Lasciato",
};

const STATUS_TONE: Record<string, string> = {
  todo: "text-text-secondary",
  in_progress: "text-accent-info",
  done: "text-accent-good",
  dropped: "text-text-muted line-through",
};

export default async function ChameleonOsPage() {
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

  const whitelist = await getPrivateWhitelist(supabase, user.id);
  if (!whitelist.has("chameleon_os")) redirect("/dashboard");

  const timezone = profile.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);

  const [{ data: milestones }, { data: syncs }] = await Promise.all([
    supabase
      .from("chameleon_milestones")
      .select("id, title, description, status, target_date, completed_at")
      .eq("user_id", user.id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("chameleon_partner_sync")
      .select("id, date, duration_minutes, topics, decisions, next_actions")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(10),
  ]);

  const open = (milestones ?? []).filter((m) => m.status === "todo" || m.status === "in_progress");
  const done = (milestones ?? []).filter((m) => m.status === "done");

  const inProgress = (milestones ?? []).filter((m) => m.status === "in_progress").length;
  const todo = (milestones ?? []).filter((m) => m.status === "todo").length;
  const lastSync = (syncs ?? [])[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header>
        <p className="text-sm text-text-secondary">Business</p>
        <h1 className="text-2xl font-semibold tracking-tight">Chameleon OS</h1>
      </header>

      <div className="mt-5">
        <BusinessTabs active="chameleon_os" />
      </div>

      <section className="mt-6">
        <StatGrid>
          <StatCard
            label="In corso"
            value={String(inProgress)}
            unit="milestone"
            subtitle={inProgress > 0 ? "lavoro attivo" : "nessuna in corso"}
            status={inProgress > 0 ? "good" : "neutral"}
          />
          <StatCard
            label="Todo"
            value={String(todo)}
            unit="milestone"
            subtitle="da iniziare"
            status={todo > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Done"
            value={String(done.length)}
            subtitle={`${done.length + open.length > 0 ? Math.round((done.length / (done.length + open.length)) * 100) : 0}% completati`}
            status={done.length > 0 ? "good" : "neutral"}
          />
          <StatCard
            label="Ultimo sync"
            value={lastSync ? formatDate(lastSync.date) : "—"}
            subtitle={
              lastSync?.duration_minutes
                ? `${lastSync.duration_minutes} min`
                : (syncs ?? []).length > 0
                  ? "log attivo"
                  : "nessun sync"
            }
            status={lastSync ? "good" : "neutral"}
          />
        </StatGrid>
      </section>

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Nuova milestone" />
        <form action={addMilestone} className="mt-3 space-y-2">
          <input
            type="text"
            name="title"
            required
            maxLength={100}
            aria-label="Titolo milestone"
            placeholder="es. v0.3 — auth + permessi"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            aria-label="Descrizione milestone"
            placeholder="cosa entra (opzionale)"
            className="w-full resize-none rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              name="target_date"
              aria-label="Data target"
              className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
            />
            <button
              type="submit"
              className="flex-1 rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              + milestone
            </button>
          </div>
        </form>
      </section>

      {milestones && milestones.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border bg-surface p-5">
          <SectionHeader label="Milestones" meta={`${milestones?.length ?? 0} totali`} />
          <ul className="mt-3 divide-y divide-border">
            {milestones.map((m) => (
              <li key={m.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`text-sm ${STATUS_TONE[m.status]}`}>{m.title}</p>
                    {m.description ? (
                      <p className="mt-0.5 text-xs text-text-muted">{m.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-text-muted">
                      {STATUS_LABEL[m.status]}
                      {m.target_date ? ` • target ${formatDate(m.target_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={setMilestoneStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="status"
                        defaultValue={m.status}
                        className="rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-text-secondary"
                      >
                        <option value="todo">todo</option>
                        <option value="in_progress">in corso</option>
                        <option value="done">done</option>
                        <option value="dropped">drop</option>
                      </select>
                      <button
                        type="submit"
                        aria-label="Salva stato"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary"
                      >
                        ✓
                      </button>
                    </form>
                    <form action={deleteMilestone}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" aria-label="Elimina" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:text-accent-bad">
                        ×
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Partner sync" meta={(syncs ?? []).length > 0 ? `${(syncs ?? []).length} ultimi` : "vuoto"} />
        <form action={logSync} className="mt-3 space-y-2">
          <DateToggle name="date" defaultDate={today} />
          <div className="flex gap-2">
            <input
              type="number"
              name="duration_minutes"
              min={0}
              aria-label="Durata sync in minuti"
              placeholder="min"
              className="w-20 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
          </div>
          <textarea
            name="topics"
            rows={2}
            aria-label="Argomenti del sync"
            placeholder="argomenti"
            className="w-full resize-none rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <textarea
            name="decisions"
            rows={2}
            aria-label="Decisioni prese"
            placeholder="decisioni"
            className="w-full resize-none rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <textarea
            name="next_actions"
            rows={2}
            aria-label="Prossime azioni"
            placeholder="next actions"
            className="w-full resize-none rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Salva sync
          </button>
        </form>
        {syncs && syncs.length > 0 ? (
          <ul className="mt-4 space-y-2 text-xs">
            {syncs.map((s) => (
              <li key={s.id} className="rounded-md border border-border bg-bg p-2">
                <p className="text-text-secondary">
                  {formatDate(s.date)}
                  {s.duration_minutes ? ` • ${s.duration_minutes} min` : ""}
                </p>
                {s.topics ? <p className="mt-1 text-text-primary">{s.topics}</p> : null}
                {s.decisions ? (
                  <p className="mt-1 text-text-secondary">→ {s.decisions}</p>
                ) : null}
                {s.next_actions ? (
                  <p className="mt-1 text-accent-info">⏭ {s.next_actions}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Business" />
    </main>
  );
}


function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
