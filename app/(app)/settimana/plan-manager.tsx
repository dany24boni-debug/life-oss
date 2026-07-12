"use client";

/**
 * Gestione piani: lista (attiva/apri/crea), editor del piano —
 * rinomina inline, duplica, elimina con undo, e l'authoring VELOCE
 * degli slot: giorno a chips L-D, righe per orario, scheda slot
 * (TimePicker + titolo + note), "copia in altri giorni" e "copia
 * giorno su…". Niente controlli nativi: TimePicker/Input del kit.
 */

import { useMemo, useState } from "react";
import {
  BottomSheet,
  Button,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  TimePicker,
  cx,
  useToast,
} from "@/ui";
import { WEEKDAYS_IT } from "@/ui/calendar-core";
import { appRepos, usePlanSlots, useWeekPlans } from "@/data/hooks";
import type { PlanSlot, WeekPlan } from "@/data/schemas";
import { IconChevronRight, IconPlus } from "../_components/icons";
import { useIsDesktop } from "../_components/tasks/screen-hooks";

export function PlanManager() {
  const plans = useWeekPlans();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const openPlan = plans?.find((p) => p.id === openPlanId) ?? null;

  if (openPlan) {
    return <PlanEditor plan={openPlan} onBack={() => setOpenPlanId(null)} />;
  }
  return <PlanList plans={plans} onOpen={setOpenPlanId} />;
}

/* ── Lista piani ─────────────────────────────────────────────────────── */

function PlanList({
  plans,
  onOpen,
}: {
  plans: WeekPlan[] | undefined;
  onOpen: (id: string) => void;
}) {
  const toast = useToast();

  async function create() {
    const r = await appRepos().planner.createPlan({
      name: "Nuova settimana",
      is_active: true,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else onOpen(r.data.id);
  }

  async function activate(plan: WeekPlan) {
    const r = await appRepos().planner.updatePlan(plan.id, {
      is_active: true,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else toast.show({ message: `Attiva: ${plan.name}.`, tone: "success" });
  }

  if (plans === undefined) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (plans.length === 0) {
    return (
      <EmptyState
        heading="Nessun piano settimana"
        text='Scrivi la tua settimana tipo una volta ("Settimana lavoro") e spuntala settimana dopo settimana.'
        action={
          <Button type="button" variant="primary" onClick={() => void create()}>
            Crea il primo piano
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex items-center gap-2 border-b border-[var(--em-hairline)] py-1 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpen(plan.id)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
                {plan.name}
              </span>
              {plan.is_active ? (
                <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-text-2)]">
                  attivo
                </span>
              ) : null}
              <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
            </button>
            {!plan.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void activate(plan)}
              >
                Attiva
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => void create()}
      >
        + Nuovo piano
      </Button>
    </div>
  );
}

/* ── Editor del piano ────────────────────────────────────────────────── */

function PlanEditor({ plan, onBack }: { plan: WeekPlan; onBack: () => void }) {
  const toast = useToast();
  const slots = usePlanSlots(plan.id);
  const [weekday, setWeekday] = useState(1);
  const [editing, setEditing] = useState<PlanSlot | "new" | null>(null);

  const daySlots = useMemo(
    () => (slots ?? []).filter((s) => s.weekday === weekday),
    [slots, weekday],
  );

  async function rename(name: string) {
    if (name.trim() === "" || name.trim() === plan.name) return;
    const r = await appRepos().planner.updatePlan(plan.id, {
      name: name.trim(),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function duplicate() {
    const r = await appRepos().planner.duplicatePlan(plan.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else toast.show({ message: `Duplicato: ${r.data.name}.`, tone: "success" });
  }

  async function remove() {
    const r = await appRepos().planner.softDeletePlan(plan.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onBack();
    toast.show({
      message: `"${plan.name}" eliminato con slot e storia.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().planner.restorePlan(plan.id),
      },
    });
  }

  async function copyDayTo(target: number) {
    let copied = 0;
    for (const slot of daySlots) {
      const r = await appRepos().planner.copySlotToWeekdays(slot.id, [target]);
      if (r.ok) copied += r.data.length;
    }
    toast.show({
      message:
        copied > 0
          ? `${copied} slot copiati su ${WEEKDAYS_IT[target - 1]}.`
          : "Niente da copiare.",
      tone: copied > 0 ? "success" : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ‹ Piani
        </Button>
        <Input
          key={plan.name}
          defaultValue={plan.name}
          maxLength={120}
          aria-label="Nome del piano"
          className="min-w-0 flex-1"
          onBlur={(e) => void rename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {plan.is_active ? (
          <span className="em-eyebrow rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-text-2)]">
            attivo
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void appRepos().planner.updatePlan(plan.id, { is_active: true })
            }
          >
            Attiva
          </Button>
        )}
      </div>

      {/* Giorni a chips. */}
      <div role="group" aria-label="Giorno" className="flex flex-wrap gap-1.5">
        {WEEKDAYS_IT.map((label, i) => {
          const day = i + 1;
          const count = (slots ?? []).filter((s) => s.weekday === day).length;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={weekday === day}
              onClick={() => setWeekday(day)}
              className={cx(
                "em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] px-2 font-medium transition-colors duration-[var(--em-dur-tap)]",
                weekday === day
                  ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                  : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
              )}
            >
              {label}
              {count > 0 ? (
                <span className="em-num ml-1 text-[var(--em-text-3)]">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Slot del giorno selezionato. */}
      {slots === undefined ? (
        <div aria-busy="true">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : daySlots.length === 0 ? (
        <EmptyState
          compact
          heading={`Niente di ${WEEKDAY_FULL[weekday - 1]}`}
          text="Aggiungi il primo slot: un orario e un titolo bastano."
        />
      ) : (
        <ul className="flex flex-col">
          {daySlots.map((slot) => (
            <li key={slot.id}>
              <button
                type="button"
                onClick={() => setEditing(slot)}
                className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--em-hairline)] py-2 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
              >
                <span className="em-body-sm em-num w-24 shrink-0 text-[var(--em-text-3)]">
                  {slot.start_hhmm}
                  {slot.end_hhmm ? `–${slot.end_hhmm}` : ""}
                </span>
                <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
                  {slot.title}
                </span>
                {slot.notes ? (
                  <span className="em-body-sm min-w-0 max-w-32 truncate text-[var(--em-text-3)]">
                    {slot.notes}
                  </span>
                ) : null}
                <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setEditing("new")}
        >
          <IconPlus className="h-4 w-4" /> Slot di {WEEKDAY_FULL[weekday - 1]}
        </Button>
        {daySlots.length > 0 ? (
          <CopyDayControl weekday={weekday} onCopy={copyDayTo} />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--em-hairline)] pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => void duplicate()}>
          Duplica piano
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
          Elimina piano
        </Button>
      </div>

      <SlotSheet
        planId={plan.id}
        weekday={weekday}
        slot={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

const WEEKDAY_FULL = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

/** "Copia giorno su…" — chips dei giorni bersaglio. */
function CopyDayControl({
  weekday,
  onCopy,
}: {
  weekday: number;
  onCopy: (target: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Copia giorno su…
      </Button>
    );
  }
  return (
    <span role="group" aria-label="Copia giorno su" className="flex flex-wrap gap-1.5">
      {WEEKDAYS_IT.map((label, i) => {
        const day = i + 1;
        if (day === weekday) return null;
        return (
          <button
            key={day}
            type="button"
            onClick={() => {
              setOpen(false);
              void onCopy(day);
            }}
            className="em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-2 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            {label}
          </button>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        annulla
      </Button>
    </span>
  );
}

/* ── Scheda slot (crea + modifica) ───────────────────────────────────── */

function SlotSheet({
  planId,
  weekday,
  slot,
  open,
  onClose,
}: {
  planId: string;
  weekday: number;
  /** null = creazione nel giorno selezionato. */
  slot: PlanSlot | null;
  open: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const title = slot ? `Slot · ${WEEKDAY_FULL[slot.weekday - 1]}` : "Nuovo slot";
  const body = open ? (
    <SlotSheetBody
      key={slot?.id ?? "new"}
      planId={planId}
      weekday={weekday}
      slot={slot}
      onClose={onClose}
    />
  ) : null;

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

function SlotSheetBody({
  planId,
  weekday,
  slot,
  onClose,
}: {
  planId: string;
  weekday: number;
  slot: PlanSlot | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [start, setStart] = useState<string | null>(slot?.start_hhmm ?? null);
  const [end, setEnd] = useState<string | null>(slot?.end_hhmm ?? null);
  const [title, setTitle] = useState(slot?.title ?? "");
  const [notes, setNotes] = useState(slot?.notes ?? "");
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  const valid = start !== null && title.trim() !== "";

  async function save() {
    if (!valid || start === null) return;
    const planner = appRepos().planner;
    const fields = {
      weekday: slot?.weekday ?? weekday,
      start_hhmm: start,
      end_hhmm: end,
      title: title.trim(),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    const r = slot
      ? await planner.updateSlot(slot.id, fields)
      : await planner.createSlot({ plan_id: planId, ...fields });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    if (copyTargets.length > 0) {
      await planner.copySlotToWeekdays(r.data.id, copyTargets);
    }
    onClose();
  }

  async function remove() {
    if (!slot) return;
    const r = await appRepos().planner.softDeleteSlot(slot.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${slot.title}" eliminato (anche dalla storia).`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().planner.restoreSlot(slot.id),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Inizio</span>
          <TimePicker
            value={start}
            onChange={(v) => setStart(v)}
            clearable={false}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Fine (opzionale)</span>
          <TimePicker
            value={end}
            onChange={(v) => setEnd(v)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Titolo</span>
        <Input
          autoFocus={slot === null}
          value={title}
          maxLength={200}
          placeholder="Palestra, Deep work…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Note</span>
        <Input
          value={notes}
          maxLength={500}
          placeholder="Dettagli, link, promemoria…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div>
        <p className="em-eyebrow mb-1.5">Copia anche in</p>
        <div role="group" aria-label="Copia anche in" className="flex flex-wrap gap-1.5">
          {WEEKDAYS_IT.map((label, i) => {
            const day = i + 1;
            const self = day === (slot?.weekday ?? weekday);
            const on = copyTargets.includes(day);
            if (self) return null;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setCopyTargets((prev) =>
                    on ? prev.filter((d) => d !== day) : [...prev, day],
                  )
                }
                className={cx(
                  "em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] px-2 font-medium transition-colors duration-[var(--em-dur-tap)]",
                  on
                    ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                    : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {slot ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
            Elimina
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="primary"
          disabled={!valid}
          onClick={() => void save()}
        >
          {slot ? "Salva" : "Aggiungi slot"}
        </Button>
      </div>
    </div>
  );
}
