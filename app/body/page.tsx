// /body — Pulse landing page introduced for the redesign.
//
// Two large tappable cards (Gym → /gym, Health → /health) each carrying a
// mini summary so the user gets a colpo d'occhio before tapping in. Visual
// language follows the Pulse handoff:
//   - module accent stripe along the top of each card + soft glow
//   - mono uppercase eyebrow with the module name
//   - one large tabular-nums lead value
//   - tiny mono micro-row of supporting stats (max 3)
//   - ChevronRight affordance bottom-right
//
// Active BottomNav tab: "Body".
//
// All data is read with the same auth/profile guard as /gym and /health.
// Mini summaries are best-effort: if a query fails or returns nothing,
// the card still renders with em-dashes — never blocks the page.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { todayInTimezone } from "@/lib/tasks/generator";
import { SectionHeader } from "@/components/ui/section-header";
import { TONE_VAR, TONE_TEXT, TONE_STRIPE } from "@/lib/tone-maps";
import type { ToneKey } from "@/lib/types";

const WATER_TARGET_ML = 2500;

export default async function BodyPage() {
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
  const weekStart = startOfIsoWeek(today);

  const [
    { data: lastWorkout },
    { data: weekWorkouts },
    { data: water },
    { data: sleepLast },
    { data: stackToday },
  ] = await Promise.all([
    supabase
      .from("gym_workouts")
      .select("date, exercise")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gym_workouts")
      .select("date, sets, reps, weight_kg")
      .eq("user_id", user.id)
      .gte("date", weekStart),
    supabase
      .from("health_water_log")
      .select("amount_ml")
      .eq("user_id", user.id)
      .eq("date", today),
    supabase
      .from("health_sleep_log")
      .select("date, hours")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("health_stack_days")
      .select("morning_done, lunch_done, evening_done")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  // Gym summary.
  const weekVolume = (weekWorkouts ?? []).reduce(
    (s, w) => s + Number(w.sets) * Number(w.reps) * Number(w.weight_kg),
    0,
  );
  const weekSessionCount = new Set(
    (weekWorkouts ?? []).map((w) => w.date),
  ).size;
  const lastWorkoutLabel = lastWorkout
    ? formatRelativeDay(lastWorkout.date, today)
    : "Mai";

  // Health summary.
  const waterTotal = (water ?? []).reduce(
    (s, r) => s + Number(r.amount_ml),
    0,
  );
  const waterPct = Math.min(
    100,
    Math.round((waterTotal / WATER_TARGET_ML) * 100),
  );
  const sleepLastHours = sleepLast?.hours
    ? Number(sleepLast.hours).toFixed(1)
    : null;
  const stack = stackToday ?? {
    morning_done: false,
    lunch_done: false,
    evening_done: false,
  };
  const stackDone =
    Number(Boolean(stack.morning_done)) +
    Number(Boolean(stack.lunch_done)) +
    Number(Boolean(stack.evening_done));

  return (
    <main className="flex min-h-screen flex-col gap-6 px-5 pt-6 pb-2">
      <SectionHeader eyebrow="MODULO · BODY" title="Corpo" meta={today} />

      <div className="grid grid-cols-1 gap-3">
        <ModuleCard
          href="/gym"
          eyebrow="GYM"
          tone="energy"
          headline={`${weekSessionCount} sessioni`}
          headlineUnit="settimana"
          micros={[
            { label: "VOLUME", value: formatVolume(weekVolume) },
            { label: "ULTIMA", value: lastWorkoutLabel },
          ]}
        />
        <ModuleCard
          href="/health"
          eyebrow="HEALTH"
          tone="info"
          headline={`${waterPct}%`}
          headlineUnit="acqua oggi"
          micros={[
            { label: "STACK", value: `${stackDone}/3` },
            {
              label: "SONNO",
              value: sleepLastHours ? `${sleepLastHours}h` : "—",
            },
          ]}
        />
      </div>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Body" />
    </main>
  );
}

function ModuleCard({
  href,
  eyebrow,
  tone,
  headline,
  headlineUnit,
  micros,
}: {
  href: string;
  eyebrow: string;
  tone: ToneKey;
  headline: string;
  headlineUnit: string;
  micros: { label: string; value: string }[];
}) {
  const toneVar = TONE_VAR[tone];
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface px-5 pb-4 pt-5 transition-transform active:scale-[0.99]"
      style={{ minHeight: 132 }}
      aria-label={`${eyebrow}: ${headline} ${headlineUnit}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: TONE_STRIPE[tone],
          boxShadow: `0 0 14px ${toneVar}80`,
        }}
      />

      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-semibold uppercase ${TONE_TEXT[tone]}`}
          style={{
            fontSize: 11,
            letterSpacing: "var(--tracking-mono-md, 0.12em)",
          }}
        >
          {eyebrow}
        </span>
        <span
          aria-hidden="true"
          className={`transition-transform group-hover:translate-x-0.5 ${TONE_TEXT[tone]}`}
        >
          ›
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="font-bold tabular-nums leading-none text-text-primary"
          style={{ fontSize: 32, letterSpacing: "-0.025em" }}
        >
          {headline}
        </span>
        <span className="text-sm text-text-muted">{headlineUnit}</span>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
        {micros.map((m) => (
          <li key={m.label} className="flex items-baseline gap-1.5">
            <span
              className="font-mono uppercase text-text-muted"
              style={{
                fontSize: 9,
                letterSpacing: "var(--tracking-mono-md, 0.12em)",
              }}
            >
              {m.label}
            </span>
            <span className="text-xs font-medium tabular-nums text-text-secondary">
              {m.value}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function startOfIsoWeek(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  const dow = d.getUTCDay() || 7; // ISO: Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function formatRelativeDay(date: string, today: string): string {
  if (date === today) return "Oggi";
  const d = new Date(date + "T00:00:00Z");
  const t = new Date(today + "T00:00:00Z");
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 1) return "Ieri";
  if (diff < 7) return `${diff}g fa`;
  if (diff < 30) return `${Math.floor(diff / 7)}sett fa`;
  return `${Math.floor(diff / 30)}m fa`;
}

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)}kg`;
}
