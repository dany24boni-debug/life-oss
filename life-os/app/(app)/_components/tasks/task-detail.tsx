"use client";

/**
 * Scheda dettaglio task (B2.1): BottomSheet su touch, Modal su desktop.
 * Salvataggio continuo, campo per campo (niente pulsante "Salva"): ogni
 * modifica è una patch sul port con errore a toast; titolo e note
 * committano al blur per non patchare a ogni battuta. Elimina passa dal
 * toast undo, mai da un dialogo di conferma.
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  Checkbox,
  DatePicker,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  TimePicker,
  cx,
  useToast,
  type SelectOption,
} from "@/ui";
import { formatDayShort, type DayString } from "@/ui/calendar-core";
import { appRepos, useTask, useTaskReminder } from "@/data/hooks";
import type { Reminder, Task, TaskPriority } from "@/data/schemas";
import { civilDayInZone } from "@/data/streak";
import { taskToIcs } from "@/lib/reminders/ics";
import {
  computeFireAt,
  derivePreset,
  instantToHhmm,
  REMINDER_PRESET_LABELS,
  type ReminderPreset,
} from "@/lib/reminders/time";
import { IconDownload, IconPlus, IconTrash } from "../icons";
import type { TaskActions } from "./actions";
import { APP_TIME_ZONE } from "./logic";
import { useIsDesktop } from "./screen-hooks";

export function TaskDetailSheet({
  taskId,
  today,
  actions,
  onClose,
}: {
  taskId: string | null;
  today: DayString;
  actions: TaskActions;
  onClose: () => void;
}) {
  const task = useTask(taskId);
  const isDesktop = useIsDesktop();

  if (taskId === null) return null;

  const body =
    task === undefined ? (
      <div className="flex flex-col gap-3 pb-4" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    ) : task === null ? (
      // Il task è sparito sotto i piedi (eliminato altrove): niente forma.
      <p className="em-body-sm pb-4 text-[var(--em-text-3)]">
        Questo task non esiste più.
      </p>
    ) : (
      <TaskEditor key={task.id} task={task} today={today} actions={actions} onClose={onClose} />
    );

  return isDesktop ? (
    <Modal open onClose={onClose} title="Dettagli task">
      {body}
    </Modal>
  ) : (
    <BottomSheet open onClose={onClose} title="Dettagli task">
      {body}
    </BottomSheet>
  );
}

const PRIORITY_OPTIONS: Array<{ value: TaskPriority | null; label: string }> = [
  { value: null, label: "Nessuna" },
  { value: 1, label: "P1" },
  { value: 2, label: "P2" },
  { value: 3, label: "P3" },
];

function TaskEditor({
  task,
  today,
  actions,
  onClose,
}: {
  task: Task;
  today: DayString;
  actions: TaskActions;
  onClose: () => void;
}) {
  const toast = useToast();
  const reminder = useTaskReminder(task.id);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");

  /**
   * Cambiare data/orario del task fa SEGUIRE il promemoria quando il suo
   * offset è uno dei preset (derivabile); se i requisiti cadono (es.
   * orario rimosso con preset relativo) il promemoria decade — il campo
   * qui sotto lo mostra subito. Un fire_at personalizzato non si tocca.
   */
  async function patchSchedule(patch: {
    date?: DayString | null;
    time?: string | null;
  }) {
    const current = reminder ?? null;
    const preset = current
      ? derivePreset(task.date, task.time, current.fire_at, APP_TIME_ZONE)
      : null;
    const ok = await actions.patch(task.id, patch);
    if (!ok || !current || !preset) return;
    const nextDate = patch.date !== undefined ? patch.date : task.date;
    const nextTime = patch.time !== undefined ? patch.time : task.time;
    const fireAt = computeFireAt(preset, nextDate, nextTime, APP_TIME_ZONE);
    const r = fireAt
      ? await appRepos().reminders.update(current.id, { fire_at: fireAt })
      : await appRepos().reminders.softDelete(current.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function setReminderPreset(value: string) {
    const current = reminder ?? null;
    if (value === "custom") return; // voce descrittiva, non un comando
    if (value === "none") {
      if (!current) return;
      const r = await appRepos().reminders.softDelete(current.id);
      if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    const fireAt = computeFireAt(
      value as ReminderPreset,
      task.date,
      task.time,
      APP_TIME_ZONE,
    );
    if (!fireAt) return; // opzione disabilitata: non si arriva qui
    const r = current
      ? await appRepos().reminders.update(current.id, { fire_at: fireAt })
      : await appRepos().reminders.create({
          kind: "task",
          ref_id: task.id,
          fire_at: fireAt,
        });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  function exportIcs() {
    if (task.date === null || task.time === null) return;
    const ics = taskToIcs({
      task: {
        id: task.id,
        title: task.title,
        notes: task.notes,
        date: task.date,
        time: task.time,
      },
      reminderFireAt: reminder?.fire_at ?? null,
      timeZone: APP_TIME_ZONE,
      now: new Date(),
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-${task.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function commitTitle() {
    const next = title.trim();
    if (next === "") {
      setTitle(task.title); // un task senza titolo non esiste: si torna indietro
      return;
    }
    if (next !== task.title) void actions.patch(task.id, { title: next });
  }

  function commitNotes() {
    const next = notes.trim() === "" ? null : notes;
    if (next !== task.notes) void actions.patch(task.id, { notes: next });
  }

  function subtaskInputs() {
    return task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done }));
  }

  function toggleSubtask(id: string, done: boolean) {
    void actions.patch(task.id, {
      subtasks: subtaskInputs().map((s) => (s.id === id ? { ...s, done } : s)),
    });
  }

  function removeSubtask(id: string) {
    void actions.patch(task.id, {
      subtasks: subtaskInputs().filter((s) => s.id !== id),
    });
  }

  function addSubtask() {
    const t = newSubtask.trim();
    if (t === "") return;
    setNewSubtask("");
    void actions.patch(task.id, {
      subtasks: [...subtaskInputs(), { title: t, done: false }],
    });
  }

  function addTag() {
    const t = newTag.trim().replace(/^#/, "");
    if (t === "" || t.length > 40) return;
    setNewTag("");
    if (task.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    void actions.patch(task.id, { tags: [...task.tags, t] });
  }

  function removeTag(tag: string) {
    void actions.patch(task.id, { tags: task.tags.filter((x) => x !== tag) });
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Field label="Titolo">
        {(p) => (
          <Input
            {...p}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          {(p) => (
            <DatePicker
              {...p}
              value={task.date}
              onChange={(day) => void patchSchedule({ date: day })}
            />
          )}
        </Field>
        <Field label="Orario">
          {(p) => (
            <TimePicker
              {...p}
              value={task.time}
              onChange={(time) => void patchSchedule({ time })}
            />
          )}
        </Field>
      </div>

      <Field
        label="Promemoria"
        hint={
          task.date === null
            ? "Serve una data per impostare un promemoria."
            : undefined
        }
      >
        {(p) =>
          reminder === undefined ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Select
              {...p}
              options={reminderOptions(task, reminder)}
              value={reminderValue(task, reminder)}
              onChange={(v) => void setReminderPreset(v)}
              disabled={task.date === null}
            />
          )
        }
      </Field>

      <Field label="Priorità">
        {(p) => (
          <div id={p.id} role="group" aria-label="Priorità" className="flex gap-1.5">
            {PRIORITY_OPTIONS.map((opt) => {
              const active = task.priority === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void actions.patch(task.id, { priority: opt.value })}
                  className={cx(
                    "min-h-[var(--em-control-h-sm)] flex-1 rounded-[var(--em-r-sm)] px-2",
                    "em-body-sm font-medium transition-[background,box-shadow,color] duration-[var(--em-dur-tap)]",
                    active
                      ? "bg-[var(--em-ember-tint)] text-[var(--em-ember-text)] shadow-[0_0_0_1px_var(--em-ember-edge)]"
                      : "text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Tag">
        {(p) => (
          <div className="flex flex-col gap-2">
            {task.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--em-surface-2)] pl-3 pr-1 shadow-[0_0_0_1px_var(--em-hairline)]"
                  >
                    <span className="em-body-sm text-[var(--em-text)]">#{tag}</span>
                    <button
                      type="button"
                      aria-label={`Rimuovi tag ${tag}`}
                      onClick={() => removeTag(tag)}
                      className="grid h-6 w-6 place-items-center rounded-full text-[var(--em-text-3)] hover:bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)] hover:text-[var(--em-text)]"
                    >
                      <CrossSmall />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addTag();
              }}
            >
              <Input
                {...p}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Aggiungi tag"
                autoComplete="off"
              />
              <Button type="submit" size="md" aria-label="Aggiungi tag" icon={<IconPlus className="h-4 w-4" />} />
            </form>
          </div>
        )}
      </Field>

      <Field label="Sottotask">
        {(p) => (
          <div className="flex flex-col gap-1">
            {task.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <Checkbox
                  label={s.title}
                  checked={s.done}
                  onChange={(done) => toggleSubtask(s.id, done)}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label={`Elimina sottotask: ${s.title}`}
                  onClick={() => removeSubtask(s.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_9%,transparent)] hover:text-[var(--em-text)]"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addSubtask();
              }}
            >
              <Input
                {...p}
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Aggiungi sottotask"
                autoComplete="off"
              />
              <Button
                type="submit"
                aria-label="Aggiungi sottotask"
                icon={<IconPlus className="h-4 w-4" />}
              />
            </form>
          </div>
        )}
      </Field>

      <Field label="Note">
        {(p) => (
          <Textarea
            {...p}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={commitNotes}
            rows={3}
            placeholder="Note"
          />
        )}
      </Field>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="em-body-sm text-[var(--em-text-3)]">
          {task.status === "done" ? "Completato" : "Aperto"}
          {task.date === today ? " · oggi" : ""}
        </span>
        <span className="flex items-center gap-2">
          {task.date !== null && task.time !== null ? (
            <Button
              variant="ghost"
              icon={<IconDownload className="h-4 w-4" />}
              onClick={exportIcs}
            >
              Esporta su Calendario
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="text-[var(--em-segnale-text)] hover:bg-[var(--em-segnale-tint)]"
            icon={<IconTrash className="h-4 w-4" />}
            onClick={() => {
              void actions.remove(task);
              onClose();
            }}
          >
            Elimina
          </Button>
        </span>
      </div>
    </div>
  );
}

/* ── Promemoria: opzioni e valore del Select ──────────────────────────── */

const PRESET_ORDER: ReminderPreset[] = [
  "at_time",
  "before_10m",
  "before_1h",
  "morning",
];

function reminderValue(task: Task, reminder: Reminder | null): string {
  if (!reminder) return "none";
  return (
    derivePreset(task.date, task.time, reminder.fire_at, APP_TIME_ZONE) ??
    "custom"
  );
}

function reminderOptions(task: Task, reminder: Reminder | null): SelectOption[] {
  const needsTime = task.time === null;
  const options: SelectOption[] = [
    { value: "none", label: "Nessuno" },
    ...PRESET_ORDER.map((preset) => ({
      value: preset,
      label: REMINDER_PRESET_LABELS[preset],
      disabled: preset === "morning" ? task.date === null : needsTime,
    })),
  ];
  if (reminder && reminderValue(task, reminder) === "custom") {
    // fire_at non riconducibile ai preset coi campi attuali: si mostra
    // com'è, scegliere un'altra voce lo sostituisce.
    const day = civilDayInZone(reminder.fire_at, APP_TIME_ZONE);
    options.push({
      value: "custom",
      label: `Personalizzato · ${formatDayShort(day)} ${instantToHhmm(
        reminder.fire_at,
        APP_TIME_ZONE,
      )}`,
    });
  }
  return options;
}

function CrossSmall() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
