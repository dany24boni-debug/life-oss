"use client";

import { useState } from "react";
import { signOut } from "../actions";
import { HeroRing } from "@/components/ui/hero-ring";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatCard } from "@/components/ui/stat-card";
import { StreakDots } from "@/components/ui/streak-dots";
import { ActionChip } from "@/components/ui/action-chip";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { RoutineRow } from "@/components/ui/routine-row";
import { TodaysCallBanner } from "@/components/ui/todays-call-banner";
import type { CallTone } from "@/lib/types";
import { Avatar } from "./avatar";
import {
  MOCK_HEADER,
  MOCK_HERO,
  MOCK_STREAK,
  MOCK_STATS,
  MOCK_DAILY_STACK,
  MOCK_HEAVY_TASKS,
  MOCK_WHY,
} from "@/lib/mock-data";

type StackKey = "morning" | "lunch" | "evening";

export function DashboardClient({
  displayName,
  todaysCall,
}: {
  displayName: string;
  todaysCall?: { tone: CallTone; text: string; source?: string };
}) {
  // Local state per item in each stack slot.
  const [stack, setStack] = useState<Record<StackKey, boolean[]>>({
    morning: [...MOCK_DAILY_STACK.morning.initiallyChecked],
    lunch: [...MOCK_DAILY_STACK.lunch.initiallyChecked],
    evening: [...MOCK_DAILY_STACK.evening.initiallyChecked],
  });

  const [heavyChecked, setHeavyChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(MOCK_HEAVY_TASKS.map((t) => [t.id, false])),
  );

  const toggleStackItem = (slot: StackKey, idx: number) => {
    setStack((prev) => {
      const next = { ...prev, [slot]: [...prev[slot]] };
      next[slot][idx] = !next[slot][idx];
      return next;
    });
  };
  const toggleHeavy = (id: string) => {
    setHeavyChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-7">
      {/* === Header === */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-text-primary">
              {displayName}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs leading-tight text-text-muted">
              <span>{MOCK_HEADER.dateLabel}</span>
              <span aria-hidden="true">·</span>
              <StatusPill label={MOCK_HEADER.stateLabel} variant="bad" />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionChip href="/recap" icon={<EndDayIcon />}>
            Chiudi giornata
          </ActionChip>
          <ActionChip href="/settings/targets" icon={<ScheduleIcon />}>
            Agenda
          </ActionChip>
          <ActionChip href="/settings" icon={<SettingsIcon />}>
            Impostazioni
          </ActionChip>
          <form action={signOut}>
            <ActionChip icon={<LogoutIcon />}>Esci</ActionChip>
          </form>
        </div>
      </header>

      {/* === Today's Call (Pulse) === */}
      {todaysCall ? (
        <section className="mt-6">
          <TodaysCallBanner
            tone={todaysCall.tone}
            text={todaysCall.text}
            source={todaysCall.source}
          />
        </section>
      ) : null}

      {/* === Hero ring === */}
      <section className="mt-8">
        <HeroRing
          value={MOCK_HERO.value}
          label={MOCK_HERO.label}
          subtitle={MOCK_HERO.subtitle}
          color={MOCK_HERO.color}
          size={260}
        />
      </section>

      {/* === Streak === */}
      <section className="mt-8">
        <SectionHeader label="Streak" meta={`${MOCK_STREAK.count} GIORNI · BEST ${MOCK_STREAK.best}`} />
        <div className="mt-3 rounded-xl border border-border bg-surface p-4">
          <StreakDots data={MOCK_STREAK.history} count={14} />
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums leading-none">
              {MOCK_STREAK.count}
            </span>
            <span className="text-xs text-text-muted">giorni di fila</span>
          </p>
        </div>
      </section>

      {/* === Stat grid === */}
      <section className="mt-6">
        <StatGrid>
          <StatCard
            label={MOCK_STATS.monthly.label}
            value={MOCK_STATS.monthly.value}
            unit={MOCK_STATS.monthly.unit}
            subtitle={MOCK_STATS.monthly.subtitle}
            status={MOCK_STATS.monthly.status}
            trend={MOCK_STATS.monthly.trend}
            trendColor="energy"
          />
          <StatCard
            label={MOCK_STATS.weekly.label}
            value={MOCK_STATS.weekly.value}
            unit={MOCK_STATS.weekly.unit}
            subtitle={MOCK_STATS.weekly.subtitle}
            status={MOCK_STATS.weekly.status}
            trend={MOCK_STATS.weekly.trend}
            trendColor="good"
          />
          <StatCard
            label={MOCK_STATS.exams.label}
            value={MOCK_STATS.exams.value}
            unit={MOCK_STATS.exams.unit}
            subtitle={MOCK_STATS.exams.subtitle}
            status={MOCK_STATS.exams.status}
          />
          <StatCard
            label={MOCK_STATS.studyHours.label}
            value={MOCK_STATS.studyHours.value}
            unit={MOCK_STATS.studyHours.unit}
            subtitle={MOCK_STATS.studyHours.subtitle}
            status={MOCK_STATS.studyHours.status}
          />
        </StatGrid>
      </section>

      {/* === Daily Stack === */}
      <section className="mt-8 space-y-6">
        {(["morning", "lunch", "evening"] as const).map((slot) => {
          const block = MOCK_DAILY_STACK[slot];
          const items = block.items;
          const checks = stack[slot];
          const allDone = checks.every(Boolean);
          const doneCount = checks.filter(Boolean).length;
          return (
            <div key={slot}>
              <SectionHeader
                label={`Stack giornaliero · ${block.label}`}
                meta={
                  allDone
                    ? "FATTO"
                    : `${doneCount}/${items.length}`
                }
              />
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
                {items.map((it, i) => (
                  <li key={i}>
                    <RoutineRow
                      emoji={it.emoji}
                      text={it.text}
                      checked={checks[i]}
                      onToggle={() => toggleStackItem(slot, i)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* === Tasks · HEAVY === */}
      <section className="mt-8">
        <SectionHeader label="Task" meta={`${MOCK_HEAVY_TASKS.length} HEAVY`} />
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface px-4">
          {MOCK_HEAVY_TASKS.map((task) => (
            <li key={task.id}>
              <RoutineRow
                emoji={task.emoji}
                text={task.text}
                checked={!!heavyChecked[task.id]}
                onToggle={() => toggleHeavy(task.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* === Why panel — collapsible via <details> === */}
      <section className="mt-8">
        <details className="group rounded-xl border border-border bg-surface p-5" open>
          <summary className="flex cursor-pointer items-baseline justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <h2 className="inline text-[10px] font-semibold uppercase tracking-[0.18em]">
              Perché
            </h2>
            <span className="transition-transform group-open:rotate-180" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <ul className="mt-4 space-y-2.5">
            {MOCK_WHY.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-snug text-text-primary">
                <span aria-hidden="true" className="mt-0.5 text-text-muted">→</span>
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* spacer so the bottom nav (rendered separately) doesn't overlap content */}
      <div className="h-16" aria-hidden="true" />
    </main>
  );
}

// --- inline icons (no extra deps) -------------------------------------------------

function iconBase() {
  return {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}
function EndDayIcon() {
  return (
    <svg {...iconBase()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}
function ScheduleIcon() {
  return (
    <svg {...iconBase()}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg {...iconBase()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.86l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.86-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09A1.7 1.7 0 008.5 19.4a1.7 1.7 0 00-1.86.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.86 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 8.5a1.7 1.7 0 00-.34-1.86l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.86.34H9a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.86-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.86V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg {...iconBase()}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
