import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { computePacing, STATUS_BADGE_IT } from "@/lib/esami/pacing";
import { StatusPill } from "@/components/ui/status-pill";

// "Next exam" card rendered just below the main dashboard surface.
// Server component: fetches its own data so the parent page stays
// presentational. Renders null when the user has no upcoming exam
// (incl. past-only history) — keeps the dashboard lean for users
// who don't track exams.

export async function NextExamWidget() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Rome";
  const today = todayInTimezone(timezone);

  // Only forward-looking exams: an exam whose date has passed
  // doesn't belong on the dashboard widget (the user will see it
  // on /esami with the "past" badge if they need to clean up).
  const { data: row } = await supabase
    .from("exams")
    .select("id, title, exam_date, total_chapters, completed_chapters")
    .eq("user_id", user.id)
    .gte("exam_date", today)
    .order("exam_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const pacing = computePacing(
    {
      exam_date: row.exam_date,
      total_chapters: row.total_chapters,
      completed_chapters: row.completed_chapters,
    },
    today,
  );
  const badge = STATUS_BADGE_IT[pacing.status];

  const daysLabel =
    pacing.daysRemaining === 0
      ? "oggi"
      : `${pacing.daysRemaining}${pacing.daysRemaining === 1 ? "g (domani)" : "g"}`;

  return (
    <section className="mx-auto mt-4 max-w-md px-5">
      <Link
        href="/esami"
        className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-text-muted"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              Prossimo esame
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-text-primary">
                {row.title}
              </h3>
              <StatusPill label={badge.label} variant={badge.variant} size="xs" />
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              <span className="tabular-nums">{daysLabel}</span>
              {row.total_chapters > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">
                    {row.completed_chapters}/{row.total_chapters}
                  </span>
                  {pacing.status !== "done" ? (
                    <>
                      {" · "}
                      <span className="text-text-muted">
                        target oggi:{" "}
                        <span className="tabular-nums text-text-secondary">
                          {pacing.chaptersPerDayNeeded}
                        </span>
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="text-text-muted transition-colors group-hover:text-text-secondary"
          >
            ›
          </span>
        </div>
      </Link>
    </section>
  );
}
