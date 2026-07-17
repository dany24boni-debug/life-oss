"use client";

/**
 * La scheda di un'abitudine (BottomSheet mobile / Modal desktop):
 * streak + mini-heat del mese (riuso del pattern MonthHeat), modifica
 * di nome/icona/obiettivo/giorni, archivio e cancellazione con undo.
 * L'acqua seminata mostra l'obiettivo "segue il profilo" con override
 * manuale esplicito e ritorno al profilo.
 */

import { useMemo, useState } from "react";
import {
  BottomSheet,
  Button,
  Input,
  Modal,
  cx,
  useToast,
} from "@/ui";
import { WEEKDAYS_IT, daysInMonth } from "@/ui/calendar-core";
import {
  appRepos,
  useHabitLogsRange,
  useHabitStreak,
  useLatestBody,
  useSettings,
} from "@/data/hooks";
import {
  HABIT_ICON_KEYS,
  WATER_HABIT_ID,
  effectiveTarget,
  habitDone,
} from "@/data/habits";
import type { Habit, HabitKind, HabitPatch, IsoDay } from "@/data/schemas";
import { HabitIcon, IconFlame } from "../_components/icons";
import { MonthHeat } from "../stats/month-heat";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { formatHabitValue, parseValueInput } from "./logic";

const WEEKDAY_FULL = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

export function HabitSheet({
  habit,
  today,
  onClose,
}: {
  habit: Habit | null;
  today: IsoDay;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const open = habit !== null;
  const body = habit ? (
    <HabitSheetBody key={habit.id} habit={habit} today={today} onClose={onClose} />
  ) : null;
  const title = habit?.name ?? "Abitudine";

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body ?? <span />}
    </BottomSheet>
  );
}

function HabitSheetBody({
  habit,
  today,
  onClose,
}: {
  habit: Habit;
  today: IsoDay;
  onClose: () => void;
}) {
  const toast = useToast();
  const streak = useHabitStreak(habit.id, today);

  async function patch(input: HabitPatch) {
    const r = await appRepos().habits.update(habit.id, input);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function archive() {
    const r = await appRepos().habits.archive(habit.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${habit.name}" archiviata: la storia resta.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().habits.unarchive(habit.id),
      },
    });
  }

  async function unarchive() {
    const r = await appRepos().habits.unarchive(habit.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else onClose();
  }

  async function remove() {
    const r = await appRepos().habits.softDelete(habit.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${habit.name}" eliminata con tutta la sua storia.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().habits.restore(habit.id),
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {streak !== undefined && (streak.current > 0 || streak.best > 0) ? (
        <p className="em-body-sm flex items-center gap-1.5 text-[var(--em-text-2)]">
          <IconFlame
            className={cx(
              "h-4 w-4",
              streak.todayCounts
                ? "text-[var(--em-ember-text)]"
                : "text-[var(--em-text-3)]",
            )}
          />
          Streak: {streak.current}{" "}
          {streak.current === 1 ? "giorno" : "giorni"} · migliore{" "}
          {streak.best}
        </p>
      ) : null}

      <MonthSection habit={habit} today={today} />

      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nome</span>
        <Input
          defaultValue={habit.name}
          maxLength={120}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== "" && v !== habit.name) void patch({ name: v });
          }}
        />
      </label>

      <IconPicker
        value={habit.icon}
        onPick={(icon) => void patch({ icon })}
      />

      <TargetSection habit={habit} onPatch={patch} />

      <WeekdaysSection habit={habit} onPatch={patch} />

      <div className="flex items-center justify-between gap-3 border-t border-[var(--em-hairline)] pt-4">
        {habit.archived_at === null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void archive()}>
            Archivia
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => void unarchive()}>
            Ripristina dall&apos;archivio
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
          Elimina
        </Button>
      </div>
    </div>
  );
}

/* ── Mese: mini-heat dei giorni completati ───────────────────────────── */

function MonthSection({ habit, today }: { habit: Habit; today: IsoDay }) {
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const from = `${today.slice(0, 8)}01`;
  const to = `${today.slice(0, 8)}${String(
    daysInMonth(year, monthIndex),
  ).padStart(2, "0")}`;

  const logs = useHabitLogsRange(habit.id, from, to);
  const latestBody = useLatestBody();
  const settings = useSettings();

  const doneDays = useMemo(() => {
    if (logs === undefined) return new Set<string>();
    const target = effectiveTarget(habit, latestBody?.weight_kg ?? null);
    return new Set(
      logs
        .filter((l) => habitDone(habit.kind, l.value, target))
        .map((l) => l.date),
    );
  }, [logs, habit, latestBody]);

  return (
    <div>
      <p className="em-eyebrow mb-2">Questo mese</p>
      <MonthHeat
        from={from}
        to={to}
        today={today}
        activeDays={doneDays}
        protectedDays={new Set(settings?.protected_days ?? [])}
      />
    </div>
  );
}

/* ── Icona ───────────────────────────────────────────────────────────── */

function IconPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (icon: string) => void;
}) {
  return (
    <div>
      <p className="em-eyebrow mb-1.5">Icona</p>
      <div role="group" aria-label="Icona" className="flex flex-wrap gap-1.5">
        {HABIT_ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key}
            aria-pressed={value === key}
            onClick={() => onPick(key)}
            className={cx(
              "grid h-11 w-11 place-items-center rounded-[var(--em-r-sm)] transition-colors duration-[var(--em-dur-tap)]",
              value === key
                ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
            )}
          >
            <HabitIcon icon={key} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Obiettivo ───────────────────────────────────────────────────────── */

function TargetSection({
  habit,
  onPatch,
}: {
  habit: Habit;
  onPatch: (input: HabitPatch) => Promise<void>;
}) {
  const latestBody = useLatestBody();
  if (habit.kind === "boolean") return null;

  const isWater = habit.id === WATER_HABIT_ID;
  const derived = isWater
    ? effectiveTarget({ ...habit, daily_target: null }, latestBody?.weight_kg ?? null)
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="em-eyebrow">
        Obiettivo del giorno{habit.unit ? ` (${habit.unit})` : ""}
      </span>
      {isWater && habit.daily_target === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="em-body-sm text-[var(--em-text-2)]">
            Segue il profilo: ~{formatHabitValue(derived ?? 0)} ml
            {latestBody ? "" : " (default: serve una pesata in Corpo)"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onPatch({ daily_target: derived })}
          >
            Imposta manuale
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            key={habit.daily_target ?? "none"}
            defaultValue={
              habit.daily_target === null ? "" : String(habit.daily_target)
            }
            inputMode="decimal"
            placeholder="es. 10"
            className="w-28"
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                if (habit.daily_target !== null && !isWater) {
                  void onPatch({ daily_target: null });
                }
                return;
              }
              const parsed = parseValueInput(raw);
              if (parsed !== null && parsed > 0 && parsed !== habit.daily_target) {
                void onPatch({ daily_target: parsed });
              }
            }}
          />
          {isWater ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onPatch({ daily_target: null })}
            >
              Torna al profilo
            </Button>
          ) : null}
        </div>
      )}
      {habit.kind === "quantity" && !isWater ? (
        <label className="mt-1 flex items-center gap-2">
          <span className="em-body-sm text-[var(--em-text-3)]">Unità</span>
          <Input
            defaultValue={habit.unit ?? ""}
            maxLength={20}
            placeholder="ml, pagine, min…"
            className="w-32"
            onBlur={(e) => {
              const v = e.target.value.trim();
              const next = v === "" ? null : v;
              if (next !== habit.unit) void onPatch({ unit: next });
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

/* ── Giorni previsti ─────────────────────────────────────────────────── */

export function WeekdaysSection({
  habit,
  onPatch,
}: {
  habit: Pick<Habit, "weekdays">;
  onPatch: (input: HabitPatch) => Promise<void>;
}) {
  const selected = habit.weekdays;
  function toggle(day: number) {
    const current = selected ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    // Insieme vuoto = di nuovo "tutti i giorni".
    void onPatch({ weekdays: next.length === 0 ? null : next });
  }

  return (
    <div>
      <p className="em-eyebrow mb-1.5">Giorni previsti</p>
      <div role="group" aria-label="Giorni previsti" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => void onPatch({ weekdays: null })}
          className={dayChipClass(selected === null)}
        >
          Tutti
        </button>
        {WEEKDAYS_IT.map((label, i) => {
          const day = i + 1;
          const on = selected !== null && selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-label={WEEKDAY_FULL[i]}
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={dayChipClass(on)}
            >
              {label.slice(0, 1).toUpperCase()}
            </button>
          );
        })}
      </div>
      <p className="em-body-sm mt-1.5 text-[var(--em-text-3)]">
        Nei giorni non previsti la streak non si spezza: fa ponte.
      </p>
    </div>
  );
}

function dayChipClass(on: boolean): string {
  return cx(
    "em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] px-2 font-medium transition-colors duration-[var(--em-dur-tap)]",
    on
      ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
      : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
  );
}

/* ── Creazione ───────────────────────────────────────────────────────── */

const KIND_OPTIONS: Array<{ kind: HabitKind; label: string; desc: string }> = [
  { kind: "boolean", label: "Sì / No", desc: "Fatta o non fatta" },
  { kind: "counter", label: "Contatore", desc: "Quante volte" },
  { kind: "quantity", label: "Quantità", desc: "Con unità: ml, pagine…" },
];

export function CreateHabitSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (habit: Habit) => void;
}) {
  const isDesktop = useIsDesktop();
  const body = open ? (
    <CreateHabitBody onClose={onClose} onCreated={onCreated} />
  ) : null;
  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Nuova abitudine">
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Nuova abitudine">
      {body ?? <span />}
    </BottomSheet>
  );
}

function CreateHabitBody({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (habit: Habit) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HabitKind>("boolean");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState<string>("spunta");
  const [weekdays, setWeekdays] = useState<number[] | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const parsedTarget = target.trim() === "" ? null : parseValueInput(target);
    const r = await appRepos().habits.create({
      name: trimmed,
      kind,
      icon,
      unit: kind === "quantity" && unit.trim() !== "" ? unit.trim() : null,
      daily_target:
        kind !== "boolean" && parsedTarget !== null && parsedTarget > 0
          ? parsedTarget
          : null,
      weekdays,
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    onCreated?.(r.data);
    toast.show({ message: `"${r.data.name}" creata.`, tone: "success" });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nome</span>
        <Input
          autoFocus
          value={name}
          maxLength={120}
          placeholder="Lettura, Stretching…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
        />
      </label>

      <div>
        <p className="em-eyebrow mb-1.5">Tipo</p>
        <div role="group" aria-label="Tipo" className="flex flex-col gap-1.5">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              aria-pressed={kind === opt.kind}
              onClick={() => setKind(opt.kind)}
              className={cx(
                "flex min-h-11 items-center justify-between gap-3 rounded-[var(--em-r-md)] px-3 py-2 text-left transition-colors duration-[var(--em-dur-tap)]",
                kind === opt.kind
                  ? "bg-[var(--em-ember-tint)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                  : "bg-[var(--em-surface-2)] shadow-[0_0_0_1px_var(--em-hairline)]",
              )}
            >
              <span className="em-body font-medium text-[var(--em-text)]">
                {opt.label}
              </span>
              <span className="em-body-sm text-[var(--em-text-3)]">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {kind !== "boolean" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="em-eyebrow">Obiettivo del giorno</span>
            <Input
              value={target}
              inputMode="decimal"
              placeholder="es. 10"
              className="w-28"
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          {kind === "quantity" ? (
            <label className="flex flex-col gap-1.5">
              <span className="em-eyebrow">Unità</span>
              <Input
                value={unit}
                maxLength={20}
                placeholder="ml, pagine, min…"
                className="w-32"
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <IconPicker value={icon} onPick={setIcon} />

      <WeekdaysSection
        habit={{ weekdays }}
        onPatch={async (input) => {
          setWeekdays(input.weekdays ?? null);
        }}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={() => void create()}
          disabled={name.trim() === ""}
        >
          Crea abitudine
        </Button>
      </div>
    </div>
  );
}
