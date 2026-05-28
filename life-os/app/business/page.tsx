import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/app/_components/bottom-nav";
import { getPrivateWhitelist, hasAnyPrivate } from "@/lib/auth/whitelist";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getRegisteredModules } from "@/lib/modules";
import { BusinessTabs } from "./_components/business-tabs";

export default async function BusinessOverviewPage() {
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

  const whitelist = await getPrivateWhitelist(supabase, user.id);
  if (!hasAnyPrivate(whitelist)) redirect("/dashboard");

  const [{ count: milestonesOpen }, { count: milestonesDone }] = await Promise.all([
    supabase
      .from("chameleon_milestones")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["todo", "in_progress"]),
    supabase
      .from("chameleon_milestones")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "done"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      <header>
        <p className="text-sm text-text-secondary">Layer privato</p>
        <h1 className="text-2xl font-semibold tracking-tight">Business</h1>
        <div className="mt-2">
          <StatusPill label="Whitelisted" variant="live" />
        </div>
      </header>

      <div className="mt-5">
        <BusinessTabs active="overview" />
      </div>

      {/* Top-line stat — Chameleon milestones */}
      <section className="mt-6">
        <StatGrid>
          <StatCard
            label="Chameleon"
            value={String(milestonesOpen ?? 0)}
            unit="aperte"
            subtitle={`${milestonesDone ?? 0} chiuse · ${(milestonesOpen ?? 0) + (milestonesDone ?? 0)} totali`}
            status={(milestonesOpen ?? 0) > 0 ? "warn" : (milestonesDone ?? 0) > 0 ? "good" : "neutral"}
          />
        </StatGrid>
      </section>

      {/* Module entries — count derives from the registry. Chameleon OS
          is the only private module registered on this branch. */}
      <section className="mt-7 space-y-2">
        <SectionHeader
          label="Moduli privati"
          meta={`${getRegisteredModules().filter((m) => m.businessTab).length} attivi`}
        />
        <Card
          href="/business/chameleon-os"
          emoji="🦎"
          title="Chameleon OS"
          stat={`${milestonesOpen ?? 0} milestones aperte`}
          sub={`${milestonesDone ?? 0} chiuse · partner sync log`}
        />
      </section>

      <div className="h-16" aria-hidden="true" />
      <BottomNav active="Business" />
    </main>
  );
}

function Card({
  title,
  href,
  stat,
  sub,
  emoji,
}: {
  title: string;
  href: string;
  stat: string;
  sub: string;
  emoji?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-text-muted"
    >
      {emoji ? (
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg text-xl"
        >
          {emoji}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-medium text-text-primary">{title}</p>
          <span aria-hidden className="text-text-muted">›</span>
        </div>
        <p className="mt-1 truncate text-xl font-semibold tabular-nums">{stat}</p>
        <p className="mt-1 truncate text-xs text-text-muted">{sub}</p>
      </div>
    </Link>
  );
}
