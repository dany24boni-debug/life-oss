import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { todayInTimezone, isDayKept } from "@/lib/tasks/generator";
import { HeroRing } from "@/components/ui/hero-ring";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { RoutineRow } from "@/components/ui/routine-row";
import { emojiForModule } from "@/lib/mock-data";

export default async function RecapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, onboarding_completed")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const timezone = profile.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);

  const [{ data: tasks }, { data: stateRow }, { data: streak }] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("module, title, weight, completed")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_states")
      .select("state")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_streaks")
      .select("current_count, best_count")
      .eq("user_id", user.id)
      .eq("scope", "daily")
      .maybeSingle(),
  ]);

  const total = tasks?.length ?? 0;
  const done = (tasks ?? []).filter((t) => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const kept = isDayKept(
    (tasks ?? []).map((t) => ({ weight: t.weight, completed: t.completed })),
  );

  const byWeight = {
    HEAVY: (tasks ?? []).filter((t) => t.weight === "HEAVY"),
    MEDIUM: (tasks ?? []).filter((t) => t.weight === "MEDIUM"),
    LIGHT: (tasks ?? []).filter((t) => t.weight === "LIGHT"),
  };
  const heavyDone = byWeight.HEAVY.filter((t) => t.completed).length;
  const mediumDone = byWeight.MEDIUM.filter((t) => t.completed).length;
  const lightDone = byWeight.LIGHT.filter((t) => t.completed).length;

  const ringTone = pct >= 80 ? "good" : pct >= 50 ? "warn" : pct === 0 && total === 0 ? "info" : "bad";
  const ringSubtitle =
    total === 0
      ? "Nessun task generato"
      : pct >= 80
        ? "Giornata tenuta"
        : pct >= 50
          ? "Sopra metà"
          : "Sotto soglia";

  const dateLabel = formatItalianDate(today);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Recap</p>
          <h1 className="text-2xl font-semibold tracking-tight">{dateLabel}</h1>
          <div className="mt-2">
            <StatusPill
              label={stateRow?.state ?? "Manutenzione"}
              variant={
                stateRow?.state === "Esami"
                  ? "warn"
                  : stateRow?.state === "Recupero"
                    ? "warn"
                    : stateRow?.state === "Vacanza"
                      ? "good"
                      : stateRow?.state === "Scaling"
                        ? "good"
                        : "live"
              }
            />
          </div>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Indietro
        </Link>
      </header>

      {/* Hero ring — today's completion */}
      <section className="mt-7">
        <HeroRing
          value={pct}
          label="Completion"
          subtitle={ringSubtitle}
          color={ringTone}
          size={240}
        />
      </section>

      {/* Stat grid */}
      <section className="mt-6">
        <StatGrid>
          <StatCard
            label="Completati"
            value={`${done}/${total}`}
            subtitle={total === 0 ? "Nessun task" : "task chiusi oggi"}
            status={total === 0 ? "neutral" : pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad"}
          />
          <StatCard
            label="Streak"
            value={String(streak?.current_count ?? 0)}
            unit="giorni"
            subtitle={
              streak?.best_count
                ? `record ${streak.best_count}`
                : kept
                  ? "tenuta"
                  : "in attesa"
            }
            status={(streak?.current_count ?? 0) >= 3 ? "good" : (streak?.current_count ?? 0) >= 1 ? "warn" : "neutral"}
          />
          <StatCard
            label="Kept day"
            value={kept ? "Sì" : "No"}
            subtitle={
              kept
                ? "Soglia LIGHT raggiunta"
                : "Riprendi dal LIGHT più piccolo"
            }
            status={kept ? "good" : "warn"}
          />
          <StatCard
            label="Stato"
            value={stateRow?.state ?? "Manutenzione"}
            subtitle="durante questa giornata"
          />
        </StatGrid>
      </section>

      {/* Breakdown by weight */}
      {total > 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <SectionHeader label="Breakdown" meta={`${done}/${total} totali`} />
          <div className="mt-4">
            <SegmentedBar
              segments={[
                { label: "HEAVY", value: byWeight.HEAVY.length, color: "bg-accent-bad" },
                { label: "MEDIUM", value: byWeight.MEDIUM.length, color: "bg-accent-warn" },
                { label: "LIGHT", value: byWeight.LIGHT.length, color: "bg-accent-good" },
              ]}
            />
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
            <li className="rounded-md border border-accent-bad/30 bg-accent-bad/5 px-2 py-1.5 text-center">
              <span className="block text-accent-bad font-semibold">{heavyDone}/{byWeight.HEAVY.length}</span>
              <span className="block text-text-muted uppercase tracking-wider">heavy</span>
            </li>
            <li className="rounded-md border border-accent-warn/30 bg-accent-warn/5 px-2 py-1.5 text-center">
              <span className="block text-accent-warn font-semibold">{mediumDone}/{byWeight.MEDIUM.length}</span>
              <span className="block text-text-muted uppercase tracking-wider">medium</span>
            </li>
            <li className="rounded-md border border-accent-good/30 bg-accent-good/5 px-2 py-1.5 text-center">
              <span className="block text-accent-good font-semibold">{lightDone}/{byWeight.LIGHT.length}</span>
              <span className="block text-text-muted uppercase tracking-wider">light</span>
            </li>
          </ul>
        </section>
      ) : null}

      {/* Detail per weight */}
      {(["HEAVY", "MEDIUM", "LIGHT"] as const).map((w) => {
        const list = byWeight[w];
        if (list.length === 0) return null;
        const wDone = list.filter((t) => t.completed).length;
        return (
          <section key={w} className="mt-5">
            <SectionHeader label={w} meta={`${wDone}/${list.length}`} />
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
              {list.map((t, i) => (
                <li key={i}>
                  <RoutineRow
                    emoji={emojiForModule(t.module)}
                    text={t.title}
                    checked={t.completed}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {total === 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-text-secondary">
            Nessun task per oggi. Genera la lista dal dashboard.
          </p>
        </section>
      ) : null}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function formatItalianDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}
