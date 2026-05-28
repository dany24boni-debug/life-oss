import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { DashboardClient } from "./_components/dashboard-client";
import { NextExamWidget } from "./_components/next-exam-widget";
import { CommuteBanner } from "./_components/commute-banner";
import { MOCK_HEADER } from "@/lib/mock-data";
import { stubTodaysCall } from "@/lib/voglia/today-call";
import { todayInTimezone } from "@/lib/tasks/generator";
import { isCommuteActive } from "@/lib/calendar/in-presence";
import type { ExternalAgendaEvent } from "@/lib/agenda/merge";

// Phase 1.5: dashboard is presentational with mock data per the visual
// polish pass. Pulse round adds the TodaysCallBanner — driven by
// stubTodaysCall (no LLM) per the override constraint. Only
// `display_name` is pulled from the DB.

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Perf-4 fix: parallelize profile + gAcc fetches. gAcc has no
  // dependency on profile so it joins the same Promise.all instead
  // of sequencing after it.
  const [{ data: profile }, { data: gAcc }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, onboarding_completed, timezone")
      .eq("id", user.id)
      .single(),
    supabase
      .from("external_calendar_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle(),
  ]);
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const displayName = profile.display_name ?? MOCK_HEADER.displayName;
  const timezone = profile.timezone ?? "Europe/Rome";

  // Server-side commute detection: read today's external_calendar_events
  // and run isCommuteActive(). The client banner combines this with the
  // localStorage manual override. If the user has no Google account
  // connected, autoActive stays false (no events to inspect).
  let autoCommute = false;
  if (gAcc) {
    const today = todayInTimezone(timezone);
    const { data: dayEvents } = await supabase
      .from("external_calendar_events")
      .select(
        "id, external_id, title, description, location, starts_at, ends_at, all_day, status, html_link",
      )
      .eq("user_id", user.id)
      .eq("account_id", gAcc.id)
      .gte("starts_at", `${today}T00:00:00.000Z`)
      .lte("starts_at", `${today}T23:59:59.999Z`);
    autoCommute = isCommuteActive(
      (dayEvents ?? []) as ExternalAgendaEvent[],
      timezone,
      new Date(),
    );
  }

  // Pulse: server-computes Today's Call from a deterministic stub. No LLM
  // hits during render. Phase 2 will swap MOCK inputs for live state.
  const call = stubTodaysCall({
    state: MOCK_HEADER.state,
    yesterdayCompletionPct: 75,
    streakDays: 12,
    topTargetGap: null,
    detectionFlag: null,
  });
  const todaysCall = {
    tone: call.color_tag,
    text: call.text,
    source: "Stub · oggi",
  };

  return (
    <>
      <DashboardClient displayName={displayName} todaysCall={todaysCall} />
      <CommuteBanner autoActive={autoCommute} />
      <NextExamWidget />
      <BottomNav active="Main" />
    </>
  );
}
