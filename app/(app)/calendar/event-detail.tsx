"use client";

/**
 * Scheda evento (B2.4): BottomSheet su touch, Modal da md in su (stesso
 * split della scheda task). Ogni campo committa subito sul port (patch
 * mirata, errori a toast, mai dialoghi di conferma); "Elimina" usa il
 * toast con Annulla — il restore vince il LWW sul delete.
 *
 * Regole orari: spegnere "Tutto il giorno" ripristina un inizio di
 * default; impostare un inizio quando c'è già una fine più vecchia la
 * lascia stare (l'utente la corregge dal picker, niente magie).
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  DatePicker,
  Field,
  Input,
  Modal,
  Switch,
  Textarea,
  Skeleton,
  TimePicker,
  useToast,
} from "@/ui";
import { useEvent } from "@/data/hooks";
import { appRepos } from "@/data/hooks";
import type { EventPatch, LocalEvent } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { defaultEndTime } from "./agenda";

export function EventDetailSheet({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const event = useEvent(eventId);
  const open = eventId !== null;

  const body =
    event === undefined ? (
      <div className="flex flex-col gap-3 pb-4" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    ) : event === null ? (
      <p className="em-body-sm py-4 text-[var(--em-text-3)]">
        Questo evento non c&apos;è più.
      </p>
    ) : (
      <EventForm event={event} onDeleted={onClose} />
    );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Evento">
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Evento">
      {open ? <div className="pb-2">{body}</div> : <span />}
    </BottomSheet>
  );
}

function EventForm({
  event,
  onDeleted,
}: {
  event: LocalEvent;
  onDeleted: () => void;
}) {
  const toast = useToast();
  // Il titolo si committa su blur/submit: stato locale, mai mezzo salvato.
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes ?? "");

  async function patch(p: EventPatch): Promise<boolean> {
    const r = await appRepos().events.update(event.id, p);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    return r.ok;
  }

  async function commitTitle() {
    const trimmed = title.trim();
    if (trimmed === "" || trimmed === event.title) {
      setTitle(event.title);
      return;
    }
    if (!(await patch({ title: trimmed }))) setTitle(event.title);
  }

  async function commitNotes() {
    const value = notes.trim() === "" ? null : notes;
    if (value === event.notes) return;
    await patch({ notes: value });
  }

  async function toggleAllDay(next: boolean) {
    if (next) {
      await patch({ all_day: true, start_time: null, end_time: null });
    } else {
      const start = event.start_time ?? "09:00";
      await patch({
        all_day: false,
        start_time: start,
        end_time: event.end_time ?? defaultEndTime(start),
      });
    }
  }

  async function remove() {
    const r = await appRepos().events.softDelete(event.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDeleted();
    toast.show({
      message: `Eliminato: ${event.title}`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().events.restore(event.id),
      },
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void commitTitle();
      }}
    >
      <Field label="Titolo">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            maxLength={500}
          />
        )}
      </Field>

      <Field label="Giorno">
        {(fieldProps) => (
          <DatePicker
            id={fieldProps.id}
            value={event.date}
            clearable={false}
            onChange={(day) => {
              if (day) void patch({ date: day });
            }}
          />
        )}
      </Field>

      <Switch
        label="Tutto il giorno"
        checked={event.all_day}
        onChange={(next: boolean) => void toggleAllDay(next)}
      />

      {!event.all_day ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio">
            {(fieldProps) => (
              <TimePicker
                id={fieldProps.id}
                value={event.start_time}
                onChange={(t) => void patch({ start_time: t })}
              />
            )}
          </Field>
          <Field label="Fine">
            {(fieldProps) => (
              <TimePicker
                id={fieldProps.id}
                value={event.end_time}
                onChange={(t) => void patch({ end_time: t })}
              />
            )}
          </Field>
        </div>
      ) : null}

      <Field label="Note">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void commitNotes()}
            rows={3}
            maxLength={2000}
          />
        )}
      </Field>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => void remove()}
          className="text-[var(--em-segnale-text)] hover:bg-[var(--em-segnale-tint)]"
        >
          Elimina evento
        </Button>
      </div>
    </form>
  );
}
