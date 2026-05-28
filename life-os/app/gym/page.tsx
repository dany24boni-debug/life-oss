import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { RoutineRow } from "@/components/ui/routine-row";
import { DateToggle } from "@/components/ui/date-toggle";
import { ChipPicker } from "@/components/ui/chip-picker";
import { todayInTimezone } from "@/lib/tasks/generator";
import { MUSCLE_GROUPS } from "@/lib/validation/gym";
import {
  addGymSession,
  deleteGymSession,
  updateGymSession,
} from "./actions";

// Sprint U1 redesign — /gym
//
// Per-session model: una entry al giorno con muscle_groups +
// duration_minutes. Sostituisce il vecchio per-exercise model
// (gym_workouts), che resta intatto in DB ma non più visibile
// nella UI.
//
// Stat strip nuova: Sessioni settimana, Sessioni mese, Minuti
// mese. Calcoli puramente da gym_sessions (i widget HeroRing
// "Top 1RM", Volume kg, Top 5 1RM richiedevano per-exercise
// model — rimossi).
//
// Edit retroattivo via searchParams.edit=<uuid>:
//   /gym           → form add
//   /gym?edit=<id> → form pre-filled + action update + cancel/delete
//
// UNIQUE (user_id, session_date) gestita lato server action
// (vedi addGymSession/updateGymSession): un 23505 reindirizza a
// /gym?edit=<existing_id>.

type SessionRow = {
  id: string;
  session_date: string;
  muscle_groups: string[];
  duration_minutes: number;
  notes: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoMonthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

function startOfIsoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function formatDateIt(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// Chip options shown to the user. emoji omitted in U1 — per the
// approved plan we use a single 💪 on each history row instead
// of per-group emojis.
const CHIP_OPTIONS = MUSCLE_GROUPS.map((value) => ({
  value,
  label: value,
}));

export default async function GymPage(props: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const searchParams = await props.searchParams;
  const editIdRaw = typeof searchParams.edit === "string" ? searchParams.edit : null;
  const editId = editIdRaw && UUID_RE.test(editIdRaw) ? editIdRaw : null;

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
  const monthStart = isoMonthStart(today);

  // Pre-fill the form when editing an existing session.
  let editEntry: SessionRow | null = null;
  if (editId) {
    const { data } = await supabase
      .from("gym_sessions")
      .select("id, session_date, muscle_groups, duration_minutes, notes")
      .eq("id", editId)
      .eq("user_id", user.id)
      .maybeSingle<SessionRow>();
    editEntry = data ?? null;
    // If the id points nowhere (already deleted, RLS, malformed
    // after the regex passed somehow), drop back to add mode by
    // redirecting to /gym — keeps the URL honest.
    if (!editEntry) redirect("/gym");
  }

  // Recent 14 sessions for the list below the form.
  const { data: recentRaw } = await supabase
    .from("gym_sessions")
    .select("id, session_date, muscle_groups, duration_minutes, notes")
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .limit(14);
  const recent = (recentRaw ?? []) as SessionRow[];

  // Aggregates for the stat strip: week + month + monthly minutes.
  // One query for the month, derive week from session_date >= weekStart.
  const { data: monthRows } = await supabase
    .from("gym_sessions")
    .select("session_date, duration_minutes")
    .eq("user_id", user.id)
    .gte("session_date", monthStart);
  let weekSessions = 0;
  let monthSessions = 0;
  let monthMinutes = 0;
  for (const r of monthRows ?? []) {
    monthSessions += 1;
    monthMinutes += Number(r.duration_minutes ?? 0);
    if (r.session_date >= weekStart) weekSessions += 1;
  }

  const isEdit = editEntry !== null;
  const formAction = isEdit ? updateGymSession : addGymSession;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Modulo</p>
          <h1 className="text-2xl font-semibold tracking-tight">Gym</h1>
        </div>
        {isEdit ? (
          <Link
            href="/gym"
            className="inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Annulla
          </Link>
        ) : null}
      </header>

      {/* Stat strip */}
      <section className="mt-7">
        <StatGrid>
          <StatCard
            label="Sessioni settimana"
            value={String(weekSessions)}
            subtitle={`${weekStart} → oggi`}
            status={weekSessions >= 3 ? "good" : weekSessions >= 1 ? "warn" : "neutral"}
          />
          <StatCard
            label="Minuti mese"
            value={String(monthMinutes)}
            unit="min"
            subtitle={`${monthSessions} sessioni`}
            status={monthSessions >= 8 ? "good" : monthSessions >= 4 ? "warn" : "neutral"}
          />
        </StatGrid>
      </section>

      {/* Form (add or edit) */}
      <section className="mt-7">
        <SectionHeader
          label={isEdit ? "Modifica sessione" : "Nuova sessione"}
          meta={isEdit && editEntry ? formatDateIt(editEntry.session_date) : ""}
        />
        <div className="mt-2 rounded-xl border border-border bg-surface p-5">
          <form action={formAction} className="space-y-4">
            {isEdit && editEntry ? (
              <input type="hidden" name="id" value={editEntry.id} />
            ) : null}

            <div>
              <p
                id="gym-muscle-groups-label"
                className="mb-2 text-xs uppercase tracking-wider text-text-muted"
              >
                Cosa hai allenato?
              </p>
              <ChipPicker
                name="muscle_groups"
                mode="multi"
                options={CHIP_OPTIONS}
                defaultSelected={editEntry?.muscle_groups ?? []}
                ariaLabelledBy="gym-muscle-groups-label"
              />
            </div>

            <div>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
                  Quanto?
                </span>
                <input
                  type="number"
                  name="duration_minutes"
                  required
                  min={5}
                  max={300}
                  step={1}
                  defaultValue={editEntry?.duration_minutes ?? 60}
                  inputMode="numeric"
                  placeholder="60"
                  aria-describedby="duration-hint"
                  className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
                />
                <span
                  id="duration-hint"
                  className="mt-1 block text-[10px] text-text-muted"
                >
                  minuti (5–300)
                </span>
              </label>
            </div>

            <div>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
                  Note (opzionale)
                </span>
                <input
                  type="text"
                  name="notes"
                  maxLength={280}
                  defaultValue={editEntry?.notes ?? ""}
                  placeholder="es. panca + spinte, scarico"
                  className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
                />
              </label>
            </div>

            <div role="group" aria-labelledby="gym-date-label">
              <p
                id="gym-date-label"
                className="mb-2 text-xs uppercase tracking-wider text-text-muted"
              >
                Data
              </p>
              <DateToggle
                name="session_date"
                defaultDate={today}
                defaultValue={editEntry?.session_date}
              />
            </div>

            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-accent-energy px-4 text-sm font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {isEdit ? "Salva modifiche" : "+ Sessione"}
            </button>
          </form>

          {isEdit && editEntry ? (
            <form action={deleteGymSession} className="mt-3">
              <input type="hidden" name="id" value={editEntry.id} />
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-accent-bad/40 bg-bg px-4 text-sm text-accent-bad transition-colors hover:bg-accent-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Cancella sessione
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {/* Recent sessions */}
      <section className="mt-7">
        <SectionHeader
          label="Sessioni recenti"
          meta={recent.length > 0 ? `${recent.length}` : "vuoto"}
        />
        {recent.length > 0 ? (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {recent.map((s) => (
              <li key={s.id}>
                <RoutineRow
                  emoji="💪"
                  text={
                    <span>
                      <span className="font-medium">
                        {s.muscle_groups.join(" + ")}
                      </span>
                      <span className="ml-2 text-xs text-text-muted">
                        {s.duration_minutes} min · {formatDateIt(s.session_date)}
                      </span>
                      {s.notes ? (
                        <span className="mt-0.5 block text-xs text-text-secondary">
                          {s.notes}
                        </span>
                      ) : null}
                    </span>
                  }
                  trailing={
                    <Link
                      href={`/gym?edit=${s.id}`}
                      aria-label={`Modifica sessione del ${formatDateIt(s.session_date)}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <span aria-hidden="true">✏️</span>
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Nessuna sessione ancora. Logga la prima dal form sopra.
          </p>
        )}
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Body" />
    </main>
  );
}
