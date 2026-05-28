// Dev-only component showcase. Renders every primitive in components/ui/ with
// sample props for visual QA without needing to log in or seed data.
// Only mounted when NODE_ENV !== 'production' — production deploys 404.

import { notFound } from "next/navigation";
import { HeroRing } from "@/components/ui/hero-ring";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { Sparkline } from "@/components/ui/sparkline";
import { StreakDots } from "@/components/ui/streak-dots";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionChip } from "@/components/ui/action-chip";
import { SectionHeader } from "@/components/ui/section-header";
import { RoutineRow } from "@/components/ui/routine-row";

export default function ComponentShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-md space-y-10 px-5 pb-20 pt-7">
      <header>
        <p className="text-sm text-text-secondary">/dev</p>
        <h1 className="text-2xl font-semibold tracking-tight">Component showcase</h1>
        <p className="mt-1 text-xs text-text-muted">
          Visibile solo in NODE_ENV=development. 10 componenti di
          components/ui/ con sample props. Niente DB, niente auth.
        </p>
      </header>

      <Block label="HeroRing">
        <HeroRing value={81} label="OGGI" subtitle="Tieni il focus" color="good" size={220} />
      </Block>

      <Block label="StatGrid + StatCard">
        <StatGrid>
          <StatCard
            label="Mensile"
            value="380€"
            unit="/700€"
            subtitle="Business"
            status="warn"
            trend={[120, 160, 190, 220, 250, 280, 310, 320, 340, 350, 360, 370, 375, 380]}
            trendColor="energy"
          />
          <StatCard
            label="Settimana"
            value="18"
            unit="/24"
            subtitle="in linea"
            status="good"
            trend={[60, 65, 72, 70, 75, 80, 75]}
            trendColor="good"
          />
          <StatCard label="Esami" value="47" unit="giorni" subtitle="al prossimo esame" status="warn" />
          <StatCard label="Studio" value="4.5" unit="h" subtitle="obiettivo 6h" status="bad" />
        </StatGrid>
      </Block>

      <Block label="SegmentedBar">
        <div className="rounded-xl border border-border bg-surface p-5">
          <SegmentedBar
            segments={[
              { label: "HEAVY", value: 3, color: "bg-accent-bad" },
              { label: "MEDIUM", value: 4, color: "bg-accent-warn" },
              { label: "LIGHT", value: 5, color: "bg-accent-good" },
            ]}
          />
        </div>
      </Block>

      <Block label="Sparkline (good / warn / bad / info / energy)">
        <div className="grid grid-cols-2 gap-3">
          {(["good", "warn", "bad", "info", "energy"] as const).map((c) => (
            <div
              key={c}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="text-xs uppercase tracking-wider text-text-muted">{c}</span>
              <Sparkline
                data={[20, 45, 30, 60, 50, 75, 65, 90, 80, 95]}
                width={100}
                height={28}
                color={c}
              />
            </div>
          ))}
        </div>
      </Block>

      <Block label="StreakDots — last 14, 12 kept">
        <div className="rounded-xl border border-border bg-surface p-4">
          <StreakDots
            data={[true, true, true, false, true, true, true, true, true, false, true, true, true, true]}
            count={14}
          />
        </div>
      </Block>

      <Block label="StatusPill (live / good / warn / bad / neutral)">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="Live" variant="live" />
          <StatusPill label="On track" variant="good" />
          <StatusPill label="Warning" variant="warn" />
          <StatusPill label="Slip" variant="bad" />
          <StatusPill label="Default" variant="neutral" />
          <StatusPill label="No dot" variant="good" withDot={false} />
        </div>
      </Block>

      <Block label="ActionChip (link / button)">
        <div className="flex flex-wrap gap-2">
          <ActionChip href="#" icon={<DotIcon />}>Link chip</ActionChip>
          <ActionChip icon={<DotIcon />}>Button chip</ActionChip>
        </div>
      </Block>

      <Block label="SectionHeader">
        <SectionHeader label="Today's workout" meta="PULL DAY · 3 SETS" />
      </Block>

      <Block label="RoutineRow (presentational + interactive demo)">
        <div className="rounded-xl border border-border bg-surface px-4">
          <RoutineRow emoji="💧" text="2L acqua avviata" checked={false} />
          <RoutineRow emoji="💊" text="Creatina 5g" checked={true} />
          <RoutineRow emoji="📱" text="1 post sui canali" checked={false} />
          <RoutineRow
            emoji="📚"
            text="Studio → ripasso → esercizi"
            checked={false}
            italic
          />
        </div>
      </Block>
    </main>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeader label={label} />
      {children}
    </section>
  );
}

function DotIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx={5} cy={5} r={3} fill="currentColor" />
    </svg>
  );
}
