import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { switchState } from "./actions";

type State = "Esami" | "Scaling" | "Manutenzione" | "Recupero" | "Vacanza";

const STATES: {
  v: State;
  l: string;
  d: string;
  emoji: string;
  pill: "good" | "warn" | "bad" | "live" | "neutral";
}[] = [
  { v: "Esami", l: "Esami", d: "Studio prevale, business in pausa.", emoji: "📚", pill: "warn" },
  { v: "Scaling", l: "Scaling", d: "Crescita aggressiva, deep block sui progetti.", emoji: "🚀", pill: "good" },
  { v: "Manutenzione", l: "Manutenzione", d: "Default. Rotazione bilanciata su tutti i moduli.", emoji: "⚙️", pill: "live" },
  { v: "Recupero", l: "Recupero", d: "Solo non-negotiables. Streak protetto.", emoji: "🛟", pill: "warn" },
  { v: "Vacanza", l: "Vacanza", d: "Pausa totale tranne post programmati.", emoji: "🏝️", pill: "good" },
];

export default async function SettingsPage() {
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

  const { data: stateRow } = await supabase
    .from("user_states")
    .select("state, started_at")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current = (stateRow?.state ?? "Manutenzione") as State;
  const startedAt = stateRow?.started_at ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">Life OS</p>
          <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
          <div className="mt-2">
            <StatusPill
              label={`Ora: ${current}`}
              variant={STATES.find((s) => s.v === current)?.pill ?? "neutral"}
            />
            {startedAt ? (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-text-muted">
                da {startedAt.slice(0, 10)}
              </span>
            ) : null}
          </div>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Indietro
        </Link>
      </header>

      <section className="mt-7">
        <SectionHeader label="Stato corrente" meta="State Engine · 5 stati" />
        <form action={switchState} className="mt-3 space-y-2">
          <fieldset className="space-y-2">
            <legend className="sr-only">Cambia stato</legend>
          {STATES.map(({ v, l, d, emoji }) => {
            const isCurrent = current === v;
            return (
              <label
                key={v}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isCurrent
                    ? "border-accent-info/60 bg-accent-info/10"
                    : "border-border bg-surface hover:border-text-muted has-[:checked]:border-accent-info has-[:checked]:bg-accent-info/5"
                }`}
              >
                <input
                  type="radio"
                  name="state"
                  value={v}
                  defaultChecked={isCurrent}
                  className="mt-1 accent-accent-info"
                />
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base"
                >
                  {emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-base font-medium">{l}</span>
                  <span className="block text-sm text-text-secondary">{d}</span>
                </span>
                {isCurrent ? (
                  <span className="self-center text-[10px] uppercase tracking-wider text-accent-info">
                    attivo
                  </span>
                ) : null}
              </label>
            );
          })}
          </fieldset>
          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-text-primary px-4 py-3 text-base font-medium text-bg transition-opacity hover:opacity-90"
          >
            Applica stato
          </button>
        </form>
      </section>

      <section className="mt-8">
        <SectionHeader label="Goals e targets" meta="CRUD pieno" />
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Link
            href="/settings/goals"
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-text-muted"
          >
            <span className="flex items-center gap-3">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-base">🎯</span>
              <span>
                <span className="block text-sm font-medium">Long-term goals</span>
                <span className="block text-xs text-text-muted">Why Panel — 24 mesi</span>
              </span>
            </span>
            <span aria-hidden className="text-text-muted">›</span>
          </Link>
          <Link
            href="/settings/targets"
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-text-muted"
          >
            <span className="flex items-center gap-3">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-base">📈</span>
              <span>
                <span className="block text-sm font-medium">Monthly targets</span>
                <span className="block text-xs text-text-muted">Progress bar in dashboard</span>
              </span>
            </span>
            <span aria-hidden className="text-text-muted">›</span>
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader label="Onboarding" />
        <p className="mt-2 text-sm text-text-secondary">
          Riapri il wizard a 6 step per modificare profilo, energia, goals, moduli o targets.
        </p>
        <Link
          href="/onboarding?step=1"
          className="mt-2 inline-block rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors hover:border-text-muted"
        >
          Riapri onboarding
        </Link>
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}
