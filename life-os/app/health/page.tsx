import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { todayInTimezone } from "@/lib/tasks/generator";
import { HeroRing } from "@/components/ui/hero-ring";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ActionChip } from "@/components/ui/action-chip";
import { RoutineRow, Checkbox } from "@/components/ui/routine-row";
import { DateToggle } from "@/components/ui/date-toggle";
import { addWater, undoLastWater, toggleStackSlot, logSleep } from "./actions";

const WATER_TARGET_ML = 2500;

const SLOTS = [
  { v: "morning" as const, l: "Mattina", desc: "Stack post-sveglia" },
  { v: "lunch" as const, l: "Pranzo", desc: "Stack midday" },
  { v: "evening" as const, l: "Sera", desc: "Stack serale" },
];

export default async function HealthPage() {
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

  // Build last-7-days date list (oldest → newest) for the sleep sparkline.
  const last7 = (() => {
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  })();
  const sevenDaysAgo = last7[0];

  const [
    { data: water },
    { data: stack },
    { data: sleepRecent },
    { data: sleepToday },
    { data: sleepWeek },
  ] = await Promise.all([
    supabase
      .from("health_water_log")
      .select("amount_ml")
      .eq("user_id", user.id)
      .eq("date", today),
    supabase
      .from("health_stack_days")
      .select("morning_done, lunch_done, evening_done")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("health_sleep_log")
      .select("date, hours, quality")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(7),
    supabase
      .from("health_sleep_log")
      .select("hours, quality, notes")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("health_sleep_log")
      .select("date, hours")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo),
  ]);

  const waterTotal = (water ?? []).reduce((s, r) => s + Number(r.amount_ml), 0);
  const waterPct = Math.min(100, Math.round((waterTotal / WATER_TARGET_ML) * 100));

  const slotState = {
    morning: stack?.morning_done ?? false,
    lunch: stack?.lunch_done ?? false,
    evening: stack?.evening_done ?? false,
  };
  const stackDoneCount =
    (slotState.morning ? 1 : 0) + (slotState.lunch ? 1 : 0) + (slotState.evening ? 1 : 0);

  const avgSleep = (sleepRecent ?? []).length > 0
    ? (sleepRecent ?? []).reduce((s, r) => s + Number(r.hours), 0) / (sleepRecent ?? []).length
    : 0;

  // Sleep sparkline aligned to last7 dates; missing days fall back to avg or 0.
  const weekByDate = new Map<string, number>();
  for (const r of sleepWeek ?? []) weekByDate.set(r.date, Number(r.hours));
  const sleepTrend = last7.map((iso) => Math.round((weekByDate.get(iso) ?? 0) * 10) / 10);

  const lastSleep = sleepRecent?.[0];

  const ringTone =
    waterPct >= 80 ? "info" : waterPct >= 50 ? "warn" : waterPct === 0 ? "info" : "bad";
  const ringSubtitle = `${(waterTotal / 1000).toLocaleString("it-IT", {
    maximumFractionDigits: 2,
  })} L · target ${(WATER_TARGET_ML / 1000)} L`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header>
        <p className="text-sm text-text-secondary">Modulo</p>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
      </header>

      {/* Water HeroRing */}
      <section className="mt-7">
        <HeroRing
          value={waterPct}
          label="Acqua"
          subtitle={ringSubtitle}
          color={ringTone}
          size={240}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[200, 250, 500].map((ml) => (
            <form key={ml} action={addWater}>
              <input type="hidden" name="amount_ml" value={ml} />
              <ActionChip icon={<DropIcon />}>+ {ml} ml</ActionChip>
            </form>
          ))}
          <form action={undoLastWater}>
            <ActionChip icon={<UndoIcon />}>Undo</ActionChip>
          </form>
        </div>
      </section>

      {/* Stat row */}
      <section className="mt-7">
        <StatGrid>
          <StatCard
            label="Stack di oggi"
            value={`${stackDoneCount}/3`}
            subtitle={
              stackDoneCount === 3
                ? "completo"
                : stackDoneCount === 0
                  ? "ancora niente"
                  : "in corso"
            }
            status={
              stackDoneCount === 3 ? "good" : stackDoneCount === 0 ? "neutral" : "warn"
            }
          />
          <StatCard
            label="Sonno (avg 7d)"
            value={avgSleep > 0 ? avgSleep.toLocaleString("it-IT", { maximumFractionDigits: 1 }) : "—"}
            unit={avgSleep > 0 ? "h" : undefined}
            subtitle={
              lastSleep
                ? `ultimo: ${Number(lastSleep.hours).toLocaleString("it-IT", { maximumFractionDigits: 1 })}h${lastSleep.quality ? ` · q${lastSleep.quality}` : ""}`
                : "nessun log"
            }
            status={
              avgSleep === 0
                ? "neutral"
                : avgSleep >= 7
                  ? "good"
                  : avgSleep >= 6
                    ? "warn"
                    : "bad"
            }
            trend={sleepTrend.some((v) => v > 0) ? sleepTrend : undefined}
            trendColor="info"
          />
        </StatGrid>
      </section>

      {/* Daily Stack toggles */}
      <section className="mt-7">
        <SectionHeader label="Daily Stack" meta={`${stackDoneCount}/3 fatto`} />
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {SLOTS.map(({ v, l, desc }) => {
            const done = slotState[v];
            return (
              <li key={v}>
                <form action={toggleStackSlot} className="w-full">
                  <input type="hidden" name="slot" value={v} />
                  <input type="hidden" name="next" value={done ? "false" : "true"} />
                  <button type="submit" className="block w-full text-left">
                    <RoutineRow
                      emoji={v === "morning" ? "🌅" : v === "lunch" ? "🥗" : "🌙"}
                      text={
                        <span>
                          <span className={done ? "text-accent-good" : ""}>{l}</span>
                          <span className="ml-2 text-xs text-text-muted">{desc}</span>
                        </span>
                      }
                      checked={done}
                      trailing={<Checkbox checked={done} />}
                    />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Sleep log */}
      <section className="mt-7">
        <SectionHeader label="Sonno" meta={lastSleep ? `${Number(lastSleep.hours).toLocaleString("it-IT", { maximumFractionDigits: 1 })}h ultima notte` : "log vuoto"} />
        <div className="mt-2 rounded-xl border border-border bg-surface p-5">
          <form action={logSleep} className="space-y-2">
            <DateToggle name="date" defaultDate={today} />
            <div className="flex gap-2">
              <input
                type="number"
                name="hours"
                required
                min={0}
                max={24}
                step="0.25"
                defaultValue={sleepToday?.hours ?? 7.5}
                aria-label="Ore di sonno"
                placeholder="ore"
                className="w-20 rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              />
              <select
                name="quality"
                defaultValue={String(sleepToday?.quality ?? 3)}
                aria-label="Qualità sonno"
                className="rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:border-accent-info focus:outline-none"
              >
                <option value="">qualità</option>
                <option value="1">1 — male</option>
                <option value="2">2</option>
                <option value="3">3 — ok</option>
                <option value="4">4</option>
                <option value="5">5 — top</option>
              </select>
            </div>
            <input
              type="text"
              name="notes"
              maxLength={200}
              defaultValue={sleepToday?.notes ?? ""}
              aria-label="Note sonno"
              placeholder="note (opzionale)"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-info focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              Salva sonno
            </button>
          </form>

          {sleepRecent && sleepRecent.length > 0 ? (
            <ul className="mt-4 space-y-1 text-xs">
              {sleepRecent.map((s) => (
                <li key={s.date} className="flex justify-between text-text-secondary">
                  <span>{formatDate(s.date)}</span>
                  <span className="tabular-nums">
                    {Number(s.hours).toLocaleString("it-IT", { maximumFractionDigits: 1 })} h
                    {s.quality ? ` • q${s.quality}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Body" />
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function DropIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l5 7a5 5 0 11-10 0z" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10h12a5 5 0 010 10H10" />
      <path d="M7 6L3 10l4 4" />
    </svg>
  );
}
