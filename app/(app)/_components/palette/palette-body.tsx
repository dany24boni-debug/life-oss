"use client";

/**
 * Il corpo della palette (run-12 P4) — caricato con next/dynamic SOLO
 * alla prima apertura (⌘K): la shell nel layout paga solo il listener,
 * i byte delle sorgenti vivono in questo chunk. Dentro: navigazione a
 * ogni superficie, le SCHEDE palestra per nome ("tor…" → "Apri scheda:
 * Torso A"), le azioni sicure (nuovo task, avvia focus, acqua CON undo
 * — lo stesso disegno della strip di Oggi), tema, recenti
 * per-dispositivo. Il matching è il ranking in casa di matcher.ts.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, useToast, type CommandItem } from "@/ui";
import {
  appRepos,
  useActiveProgram,
  useHabits,
  useLatestBody,
  useProgramDays,
} from "@/data/hooks";
import { WATER_HABIT_ID, effectiveTarget } from "@/data/habits";
import type { Habit } from "@/data/schemas";
import { defaultQuickStep, formatHabitValue } from "../../abitudini/logic";
import { startFocusNow } from "../../focus/use-focus";
import { useToday } from "../tasks/screen-hooks";
import { setThemeMode } from "../theme";
import { rankOf } from "./matcher";
import { NAV_SOURCES, gymCardSources } from "./sources";

const RECENT_KEY = "lifeos.palette.recent";
const RECENT_MAX = 4;

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.length <= 64)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((r) => r !== id)].slice(
      0,
      RECENT_MAX,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage negato: i recenti semplicemente non si ricordano.
  }
}

export default function PaletteBody({
  onClose,
  onQuickAdd,
}: {
  onClose: () => void;
  onQuickAdd: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const program = useActiveProgram();
  const days = useProgramDays(program?.id ?? null);
  const habits = useHabits();
  const latest = useLatestBody();
  // Il corpo monta all'apertura: i recenti si leggono qui, una volta
  // (client-only per costruzione, ssr:false sul dynamic).
  const [recents] = useState(() => readRecents());

  const water =
    (habits ?? []).find(
      (h) => h.id === WATER_HABIT_ID && h.archived_at === null,
    ) ?? null;

  async function logWater(habit: Habit) {
    const repo = appRepos().habits;
    const log = await repo.getLog(habit.id, today);
    const previous = log?.value ?? 0;
    const target = effectiveTarget(habit, latest?.weight_kg ?? null);
    const step = defaultQuickStep(habit.unit, target);
    const r = await repo.incrementDay(habit.id, today, step);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    // Lo stesso undo della strip di Oggi: ripristino del totale di prima.
    toast.show({
      message: `${habit.name}: +${formatHabitValue(step)}${habit.unit ? ` ${habit.unit}` : ""}.`,
      action: {
        label: "Annulla",
        onClick: () => void repo.logDay(habit.id, today, previous),
      },
    });
  }

  const items: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = [
      ...NAV_SOURCES,
      ...gymCardSources(days ?? []),
    ].map((s) => ({
      id: s.id,
      label: s.label,
      group: s.group,
      hint: s.hint,
      keywords: s.keywords,
      onSelect: () => {
        pushRecent(s.id);
        router.push(s.href);
      },
    }));
    const actions: CommandItem[] = [
      {
        id: "act:new-task",
        label: "Nuovo task…",
        group: "Azioni",
        hint: "n",
        keywords: "aggiungi crea todo",
        onSelect: () => {
          pushRecent("act:new-task");
          onQuickAdd();
        },
      },
      {
        id: "act:start-focus",
        label: "Avvia focus",
        group: "Azioni",
        keywords: "pomodoro timer concentrazione parti",
        onSelect: () => {
          pushRecent("act:start-focus");
          startFocusNow();
          router.push("/focus");
        },
      },
      ...(water
        ? [
            {
              id: "act:log-water",
              label: "Logga acqua",
              group: "Azioni",
              keywords: "bevi acqua idratazione +330 ml bicchiere",
              onSelect: () => {
                pushRecent("act:log-water");
                void logWater(water);
              },
            },
          ]
        : []),
    ];
    const theme: CommandItem[] = [
      { id: "theme:dark", label: "Tema scuro", keywords: "dark notte" },
      { id: "theme:light", label: "Tema chiaro", keywords: "light giorno" },
      { id: "theme:system", label: "Tema di sistema", keywords: "auto os" },
    ].map((t) => ({
      ...t,
      group: "Tema",
      onSelect: () => {
        pushRecent(t.id);
        setThemeMode(
          t.id.slice("theme:".length) as "dark" | "light" | "system",
        );
      },
    }));

    const all = [...nav, ...actions, ...theme];
    const byId = new Map(all.map((i) => [i.id, i] as const));
    // Recenti in testa, nel loro gruppo — l'ordine dell'array comanda.
    const recentItems = recents
      .map((id) => byId.get(id))
      .filter((i): i is CommandItem => i !== undefined)
      .map((i) => ({ ...i, group: "Recenti" }));
    const recentIds = new Set(recentItems.map((i) => i.id));
    return [...recentItems, ...all.filter((i) => !recentIds.has(i.id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, water, recents, today]);

  return (
    <CommandPalette open onClose={onClose} items={items} rank={rankOf} />
  );
}
