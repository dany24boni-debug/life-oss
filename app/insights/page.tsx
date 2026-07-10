// /insights — Pulse memory page rendering computed pattern insights.
//
// Insights are detected on-demand by lib/insights/run from the user's
// last 30 days of tasks/sleep/gym/finance/events and rendered as
// Pulse InsightToneCards. Cards are grouped by Pulse tone bucket
// (WIN / PUSH / WATCH / RECOVER / INFO) and sorted by confidence
// within each bucket.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { InsightToneCard } from "@/components/ui/insight-tone-card";
import { runInsights } from "@/lib/insights/run";
import type { InsightTone } from "@/lib/insights/compute";

export default async function InsightsPage() {
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
  const insights = await runInsights(supabase, user.id, timezone);

  // Sort by tone weight (good/energy first, then warn, then bad, then info)
  // and confidence within tone.
  const toneRank: Record<InsightTone, number> = {
    good: 0,
    energy: 1,
    warn: 2,
    bad: 3,
    info: 4,
  };
  const sorted = [...insights].sort((a, b) => {
    const t = toneRank[a.tone] - toneRank[b.tone];
    if (t !== 0) return t;
    return b.confidence - a.confidence;
  });

  // Group by tone for visual buckets.
  const byTone = new Map<InsightTone, typeof sorted>();
  for (const i of sorted) {
    const arr = byTone.get(i.tone) ?? [];
    arr.push(i);
    byTone.set(i.tone, arr);
  }

  // Pulse bucket eyebrows.
  const TONE_EYEBROW: Record<InsightTone, string> = {
    good: "WIN · VINCI QUA",
    energy: "PUSH · SPINTA",
    warn: "WATCH · ATTENZIONE",
    bad: "RECOVER · RECUPERA QUA",
    info: "INFO · LO SAPEVI",
  };

  const TONE_TITLE: Record<InsightTone, string> = {
    good: "Vinci qua",
    energy: "Spinta",
    warn: "Attenzione",
    bad: "Recupera qua",
    info: "Lo sapevi",
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <SectionHeader
        eyebrow={`MEMORIA · ${insights.length} PATTERN${insights.length === 1 ? "" : "S"}`}
        title="Insights"
        meta="ULTIMI 30 GIORNI"
      />

      <p className="mt-3 text-xs text-text-muted">
        Computati ora dai tuoi ultimi 30 giorni di task, sonno, gym,
        finanze, eventi. Più dati logghi → più affidabili diventano.
      </p>

      {insights.length === 0 ? (
        <section className="mt-7 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-text-secondary">
            Nessun pattern abbastanza forte da segnalarti. Logga almeno 2
            settimane di task + un po&apos; di sonno e gym e tornano qui.
          </p>
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {(["good", "energy", "warn", "bad", "info"] as const).map((tone) => {
            const list = byTone.get(tone);
            if (!list || list.length === 0) return null;
            return (
              <section key={tone}>
                <SectionHeader
                  eyebrow={`${TONE_EYEBROW[tone]} · ${list.length}`}
                  title={TONE_TITLE[tone]}
                />
                <ul className="mt-3 space-y-2.5">
                  {list.map((i) => (
                    <li key={`${i.kind}-${i.headline}`}>
                      <InsightToneCard
                        tone={i.tone}
                        headline={i.headline}
                        detail={i.detail}
                        confidence={i.confidence}
                        evidence={i.evidenceTyped}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Più" />
    </main>
  );
}
