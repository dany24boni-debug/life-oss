import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { todayInTimezone } from "@/lib/tasks/generator";
import {
  computePacing,
  STATUS_BADGE_IT,
  type ExamFull,
} from "@/lib/esami/pacing";
import { addExam, markChapter, deleteExam } from "./actions";

function formatDate(iso: string, timezone: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export default async function EsamiPage() {
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

  const { data: examsRaw } = await supabase
    .from("exams")
    .select("id, title, exam_date, total_chapters, completed_chapters, notes")
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true });
  const exams = (examsRaw ?? []) as ExamFull[];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Layer studio</p>
          <h1 className="text-2xl font-semibold tracking-tight">Esami</h1>
          <div className="mt-2">
            <StatusPill
              label={`${exams.length} ${exams.length === 1 ? "esame" : "esami"}`}
              variant={exams.length > 0 ? "live" : "neutral"}
            />
          </div>
        </div>
        <Link
          href="/more"
          className="inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Indietro
        </Link>
      </header>

      <section className="mt-7 rounded-xl border border-border bg-surface p-5">
        <SectionHeader label="Aggiungi esame" />
        <form action={addExam} className="mt-3 space-y-2">
          <label className="block">
            <span className="sr-only">Nome esame</span>
            <input
              type="text"
              name="title"
              required
              maxLength={80}
              placeholder="nome esame (es. Storia moderna)"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Data esame</span>
              <input
                type="date"
                name="exam_date"
                required
                defaultValue={today}
                className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
              />
            </label>
            <label className="w-24">
              <span className="sr-only">Numero capitoli totali</span>
              <input
                type="number"
                name="total_chapters"
                min={0}
                step={1}
                defaultValue={0}
                placeholder="capitoli"
                className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
              />
            </label>
          </div>
          <label className="block">
            <span className="sr-only">Note esame</span>
            <input
              type="text"
              name="notes"
              maxLength={280}
              placeholder="note (libro, capitoli, ecc.)"
              className="w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-text-primary px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            + esame
          </button>
        </form>
      </section>

      <section className="mt-7">
        <SectionHeader
          label="I tuoi esami"
          meta={exams.length > 0 ? "per data crescente" : ""}
        />
        {exams.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Nessun esame ancora. Aggiungine uno sopra.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {exams.map((e) => {
              const pacing = computePacing(
                {
                  exam_date: e.exam_date,
                  total_chapters: e.total_chapters,
                  completed_chapters: e.completed_chapters,
                },
                today,
              );
              const badge = STATUS_BADGE_IT[pacing.status];
              const progressPct = pct(e.completed_chapters, e.total_chapters);
              const daysLabel =
                pacing.daysRemaining < 0
                  ? `${Math.abs(pacing.daysRemaining)}g fa`
                  : pacing.daysRemaining === 0
                    ? "oggi"
                    : `${pacing.daysRemaining}g`;
              const dayWord =
                pacing.daysRemaining > 0
                  ? pacing.daysRemaining === 1
                    ? " giorno"
                    : " giorni"
                  : "";

              return (
                <li
                  key={e.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-text-primary">
                          {e.title}
                        </h2>
                        <StatusPill
                          label={badge.label}
                          variant={badge.variant}
                          size="xs"
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {formatDate(e.exam_date, timezone)} ·{" "}
                        <span className="tabular-nums">{daysLabel}</span>
                        {dayWord}
                      </p>
                      {e.notes ? (
                        <p className="mt-2 text-xs text-text-muted">{e.notes}</p>
                      ) : null}
                    </div>
                    <form action={deleteExam} className="shrink-0">
                      <input type="hidden" name="exam_id" value={e.id} />
                      <button
                        type="submit"
                        aria-label="Elimina esame"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:text-accent-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </form>
                  </div>

                  {e.total_chapters > 0 ? (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-xs text-text-secondary">
                        <span className="tabular-nums">
                          {e.completed_chapters}/{e.total_chapters} capitoli
                          {" · "}
                          <span className="text-text-muted">{progressPct}%</span>
                        </span>
                        {pacing.status !== "done" && pacing.status !== "past" ? (
                          <span className="text-[10px] uppercase tracking-wider text-text-muted">
                            target oggi:{" "}
                            <span className="tabular-nums text-text-secondary">
                              {pacing.chaptersPerDayNeeded}
                            </span>{" "}
                            / dì
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full rounded-full ${
                            pacing.status === "done"
                              ? "bg-accent-good"
                              : pacing.status === "under_pace" ||
                                  pacing.status === "past"
                                ? "bg-accent-bad"
                                : "bg-accent-info"
                          }`}
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {pacing.status !== "done" && e.total_chapters > 0 ? (
                    <form action={markChapter} className="mt-3">
                      <input type="hidden" name="exam_id" value={e.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-border bg-bg px-3 text-sm text-text-primary transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      >
                        + capitolo fatto
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}
