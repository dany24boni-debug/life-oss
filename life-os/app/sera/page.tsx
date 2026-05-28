import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { todayInTimezone } from "@/lib/tasks/generator";
import { submitEveningCheckin, toggleCarryover } from "./actions";
import { JournalEditor } from "./_components/journal-editor";
import {
  getJournalEntry,
  listRecentJournalEntries,
} from "@/lib/google/drive-journal";
import { hasDriveFileScope } from "@/lib/google/scope-check";

type DailyTaskRow = {
  id: string;
  title: string;
  weight: "HEAVY" | "MEDIUM" | "LIGHT" | string;
  completed: boolean;
  carryover_to_next_day: boolean;
  module: string;
};

type CheckinRow = {
  energy_1_5: number | null;
  mood: string | null;
  notes: string | null;
};

export default async function SeraPage(props: {
  searchParams: Promise<{ date?: string }>;
}) {
  const searchParams = await props.searchParams;

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

  // viewDate = date param when valid YYYY-MM-DD AND not in the future,
  // else today. Future dates fall back so a forged URL can't trigger
  // a Drive lookup for a nonexistent day.
  const rawDate =
    typeof searchParams.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : null;
  const viewDate = rawDate && rawDate <= today ? rawDate : today;

  // Perf-3 fix: parallelize tasks + checkin + gAccount fetches.
  // gAccount has no dependency on tasks/checkin so it joins the same
  // Promise.all instead of waiting for them to complete.
  const [{ data: tasksRaw }, { data: checkinRaw }, { data: gAccount }] =
    await Promise.all([
      supabase
        .from("daily_tasks")
        .select("id, title, weight, completed, carryover_to_next_day, module")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: true }),
      supabase
        .from("evening_checkins")
        .select("energy_1_5, mood, notes")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("external_calendar_accounts")
        .select("scope")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle<{ scope: string | null }>(),
    ]);

  const tasks = (tasksRaw ?? []) as DailyTaskRow[];
  const checkin = (checkinRaw ?? null) as CheckinRow | null;

  // ── Diary data — best-effort, soft-fails so the rest of /sera
  //    keeps rendering when Drive is misbehaving.
  let accountConnected = false;
  let scopeMissing = false;
  let journalContent = "";
  let recentEntries: { date: string; fileId: string }[] = [];

  if (gAccount) {
    accountConnected = true;
    if (!hasDriveFileScope(gAccount.scope)) {
      scopeMissing = true;
    } else {
      try {
        const [entry, recent] = await Promise.all([
          getJournalEntry(supabase, user.id, viewDate),
          listRecentJournalEntries(supabase, user.id, 30),
        ]);
        if (entry) journalContent = entry.content;
        recentEntries = recent;
      } catch (err) {
        // Log but render: the editor still mounts with empty content
        // and saveDiaryEntry will surface the specific error if the
        // user tries to write.
        console.error("[sera] diary fetch failed:", err);
      }
    }
  }

  const completed = tasks.filter((t) => t.completed);
  const open = tasks.filter((t) => !t.completed);
  const carryoverCount = open.filter((t) => t.carryover_to_next_day).length;
  const lights = tasks.filter((t) => t.weight === "LIGHT");
  const lightsDone = lights.filter((t) => t.completed).length;
  const lightsPct = lights.length > 0 ? Math.round((lightsDone / lights.length) * 100) : 100;

  // Status pill: kept-day vs short.
  const dayLabel = lightsPct >= 80 ? "kept day" : "sotto soglia";
  const dayVariant: "good" | "warn" | "bad" =
    lightsPct >= 80 ? "good" : lightsPct >= 50 ? "warn" : "bad";

  const checkinExists = checkin?.energy_1_5 != null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Layer sera</p>
          <h1 className="text-2xl font-semibold tracking-tight">Sera</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill
              label={`${completed.length}/${tasks.length} chiusi · ${dayLabel}`}
              variant={dayVariant}
            />
            {checkinExists ? (
              <StatusPill label="check-in salvato" variant="good" />
            ) : (
              <StatusPill label="check-in da fare" variant="neutral" />
            )}
          </div>
        </div>
        <Link
          href="/more"
          className="inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Indietro
        </Link>
      </header>

      <section className="mt-7">
        <SectionHeader label="Recap del giorno" meta={`${tasks.length} task`} />
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">Nessun task generato per oggi.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    t.completed ? "bg-accent-good text-bg" : "border border-border"
                  }`}
                >
                  {t.completed ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-primary">{t.title}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {t.weight} · {t.module}
                  </div>
                </div>
                {!t.completed ? (
                  <form action={toggleCarryover} className="shrink-0">
                    <input type="hidden" name="task_id" value={t.id} />
                    <input
                      type="hidden"
                      name="carryover"
                      value={t.carryover_to_next_day ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      aria-label={
                        t.carryover_to_next_day
                          ? "Togli da domani"
                          : "Porta a domani con priorità"
                      }
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-md border px-3 text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                        t.carryover_to_next_day
                          ? "border-accent-energy/50 bg-accent-energy/10 text-accent-energy"
                          : "border-border text-text-muted hover:border-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t.carryover_to_next_day ? "↪ domani" : "+ domani"}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Come è andata?" meta="energia · mood · note" />
        <form action={submitEveningCheckin} className="mt-3 space-y-3">
          <fieldset>
            <legend className="mb-2 text-xs uppercase tracking-wider text-text-muted">
              Energia 1-5
            </legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-md border border-border bg-bg text-sm text-text-primary has-[:checked]:border-accent-energy has-[:checked]:bg-accent-energy/10 has-[:checked]:text-accent-energy has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-info has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg"
                >
                  <input
                    type="radio"
                    name="energy_1_5"
                    value={n}
                    defaultChecked={checkin?.energy_1_5 === n}
                    required
                    aria-label={`Energia ${n}`}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>

          <input
            type="text"
            name="mood"
            maxLength={80}
            aria-label="Mood"
            defaultValue={checkin?.mood ?? ""}
            placeholder="mood (es. stanco ma ok, stressato esame, in flow)"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
          />

          <textarea
            name="notes"
            maxLength={280}
            rows={2}
            aria-label="Note"
            defaultValue={checkin?.notes ?? ""}
            placeholder="note opzionali per domani (es. saltato pranzo, lezione mattina)"
            className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
          />

          <button
            type="submit"
            className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Salva check-in
          </button>
        </form>
      </section>

      <section className="mt-7">
        <SectionHeader label="Diario" meta={viewDate === today ? "oggi" : viewDate} />
        <div className="mt-2">
          <JournalEditor
            viewDate={viewDate}
            today={today}
            initialContent={journalContent}
            initialMood={viewDate === today ? checkin?.mood ?? null : null}
            scopeMissing={scopeMissing}
            accountConnected={accountConnected}
          />
        </div>
        {accountConnected && !scopeMissing ? (
          <RecentJournalLinks
            today={today}
            recentEntries={recentEntries}
          />
        ) : null}
      </section>

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader
          label="Domani"
          meta={`${carryoverCount} carry-over`}
        />
        <p className="mt-3 text-sm text-text-secondary">
          {carryoverCount === 0
            ? "Nessun task in carry-over. Domani parte pulito col piano dello stato."
            : `${carryoverCount} task da chiudere domani come priorità HEAVY.`}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Pianificazione automatica del giorno dopo: in arrivo (smart bumping nel
          generator).
        </p>
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}

function ymdAddDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatItalianDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function RecentJournalLinks({
  today,
  recentEntries,
}: {
  today: string;
  recentEntries: { date: string; fileId: string }[];
}) {
  const haveDates = new Set(recentEntries.map((r) => r.date));
  const yesterday = ymdAddDays(today, -1);
  const weekAgo = ymdAddDays(today, -7);

  const hasYesterday = haveDates.has(yesterday);
  const hasWeekAgo = haveDates.has(weekAgo);

  if (!hasYesterday && !hasWeekAgo && recentEntries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {hasYesterday ? (
        <Link
          href={`/sera?date=${yesterday}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-surface px-3 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Vedi ieri ({formatItalianDate(yesterday)})
        </Link>
      ) : null}
      {hasWeekAgo ? (
        <Link
          href={`/sera?date=${weekAgo}`}
          className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-surface px-3 text-xs text-text-secondary hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Vedi 7 giorni fa ({formatItalianDate(weekAgo)})
        </Link>
      ) : null}
    </div>
  );
}
