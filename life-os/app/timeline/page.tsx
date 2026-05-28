// /timeline — Pulse memory page.
//
// Shows the user_events memory layer grouped per day in TimelineDayCapsule
// cards. Pulse vocabulary: SectionHeader eyebrow + 24px title, mono filter
// chips for range (7g / 30g / Tutto) and module, dot-on-active styling.
//
// Active BottomNav: "Più".
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { TimelineDayCapsule } from "@/components/ui/timeline-day-capsule";
import { todayInTimezone } from "@/lib/tasks/generator";

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  all: null,
};

const MODULE_LABEL: Record<string, { label: string; emoji: string }> = {
  general: { label: "Generale", emoji: "✨" },
  studio: { label: "Studio", emoji: "📚" },
  gym: { label: "Gym", emoji: "💪" },
  health: { label: "Health", emoji: "💧" },
  finance: { label: "Finance", emoji: "💶" },
  chameleon_os: { label: "Chameleon OS", emoji: "🦎" },
  voglia: { label: "Voglia", emoji: "🎚️" },
  state: { label: "Stato", emoji: "🎚️" },
  mood: { label: "Mood", emoji: "🙂" },
  onboarding: { label: "Onboarding", emoji: "👤" },
};

function moduleMeta(slug: string): { label: string; emoji: string } {
  if (slug?.startsWith?.("custom:")) return { label: "Custom", emoji: "✨" };
  return MODULE_LABEL[slug] ?? { label: slug, emoji: "•" };
}

export default async function TimelinePage(props: {
  searchParams: Promise<{ range?: string; module?: string }>;
}) {
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

  const params = await props.searchParams;
  const range = params.range && params.range in RANGE_DAYS ? params.range : "7d";
  const moduleFilter = params.module ?? "";

  const timezone = profile.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);
  const days = RANGE_DAYS[range];
  const sinceDate = (() => {
    if (days === null) return null;
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - days + 1);
    return d.toISOString();
  })();

  // Don't fetch `payload` (jsonb, free-form, user-controlled) — the capsule
  // only renders summary/module/time. Including it here just keeps a copy
  // in server memory that a future caller might surface without auditing.
  let query = supabase
    .from("user_events")
    .select("id, occurred_at, module, kind, summary, ref_table, ref_id")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .limit(300);
  if (sinceDate) query = query.gte("occurred_at", sinceDate);
  if (moduleFilter) query = query.eq("module", moduleFilter);

  const { data: events } = await query;

  // Hoist the formatter — Intl.DateTimeFormat construction is ~10–30µs
  // each in V8, and on the "all" range we'd otherwise allocate ~300 of
  // them per render.
  const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const byDate = new Map<string, NonNullable<typeof events>>();
  for (const e of events ?? []) {
    const dateKey = dateKeyFormatter.format(new Date(e.occurred_at));
    const arr = byDate.get(dateKey) ?? [];
    arr.push(e);
    byDate.set(dateKey, arr);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  const distinctModules = Array.from(
    new Set((events ?? []).map((e) => e.module)),
  ).sort();

  const total = events?.length ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <SectionHeader
        eyebrow={`MEMORIA · ${total} EVENTI`}
        title="Timeline"
        meta={range === "all" ? "TUTTA LA STORIA" : `ULTIMI ${range}`}
      />

      {/* Range filter — Pulse mono chips */}
      <nav aria-label="Filtra periodo" className="mt-5 flex gap-2">
        {(["7d", "30d", "all"] as const).map((r) => {
          const active = range === r;
          const next = new URLSearchParams();
          next.set("range", r);
          if (moduleFilter) next.set("module", moduleFilter);
          return (
            <FilterChip
              key={r}
              href={`/timeline?${next.toString()}`}
              active={active}
              label={r === "7d" ? "7G" : r === "30d" ? "30G" : "TUTTO"}
            />
          );
        })}
      </nav>

      {/* Module filter */}
      {distinctModules.length > 1 ? (
        <nav aria-label="Filtra modulo" className="mt-3 -mx-5 overflow-x-auto px-5">
          <ul className="flex gap-2">
            <li>
              <FilterChip
                href={`/timeline?range=${range}`}
                active={!moduleFilter}
                label="TUTTI"
              />
            </li>
            {distinctModules.map((slug) => {
              const meta = moduleMeta(slug);
              const active = moduleFilter === slug;
              return (
                <li key={slug}>
                  <FilterChip
                    href={`/timeline?range=${range}&module=${encodeURIComponent(slug)}`}
                    active={active}
                    label={`${meta.emoji} ${meta.label}`}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {sortedDates.length === 0 ? (
        <p className="mt-7 rounded-xl border border-border bg-surface p-5 text-sm text-text-secondary">
          Nessun evento nel periodo selezionato. Logga qualcosa (un task,
          una sessione gym, una voce finance) e tornerà qui.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {sortedDates.map((dateKey) => {
            const list = byDate.get(dateKey) ?? [];
            return (
              <TimelineDayCapsule
                key={dateKey}
                dateLabel={formatDateHeader(dateKey, today)}
                events={list.map((e) => ({
                  id: e.id,
                  summary: e.summary,
                  module: e.module,
                  occurred_at: e.occurred_at,
                }))}
                timezone={timezone}
              />
            );
          })}
        </div>
      )}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
        active
          ? "bg-text-primary text-bg"
          : "border border-border bg-surface text-text-secondary hover:border-text-muted"
      }`}
      style={{
        fontSize: 10,
        letterSpacing: "var(--tracking-mono-md, 0.12em)",
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {label}
    </Link>
  );
}

function formatDateHeader(iso: string, today: string): string {
  if (iso === today) return "Oggi";
  // Anchor at UTC midnight so the locale-rendered weekday matches the
  // date bucket key (which itself comes from en-CA in the user's tz).
  // Using local time would drift by a day east of UTC if the runtime
  // happens to be in another zone.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).toUpperCase();
}
