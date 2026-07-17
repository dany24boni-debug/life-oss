"use client";

/**
 * Scheda esame (run-05 prompt 3): BottomSheet su touch, Modal da md in su
 * — lo stesso split della scheda evento. Ogni campo committa subito sul
 * port (patch mirata, errori a toast); "Elimina" usa il toast con Annulla
 * (il restore vince il LWW sul delete). I capitoli si regolano con
 * stepper da 44px, mai tastiera obbligata.
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  DatePicker,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos, useExam } from "@/data/hooks";
import type { Exam, ExamPatch } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";

export function ExamDetailSheet({
  examId,
  onClose,
}: {
  examId: string | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const exam = useExam(examId);
  const open = examId !== null;

  const body =
    exam === undefined ? (
      <div className="flex flex-col gap-3 pb-4" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    ) : exam === null ? (
      <p className="em-body-sm py-4 text-[var(--em-text-3)]">
        Questo esame non c&apos;è più.
      </p>
    ) : (
      <ExamForm exam={exam} onDeleted={onClose} />
    );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Esame">
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Esame">
      {open ? <div className="pb-2">{body}</div> : <span />}
    </BottomSheet>
  );
}

function ExamForm({ exam, onDeleted }: { exam: Exam; onDeleted: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(exam.title);
  const [notes, setNotes] = useState(exam.notes ?? "");
  const [totalDraft, setTotalDraft] = useState(String(exam.total_chapters));

  async function patch(p: ExamPatch): Promise<boolean> {
    const r = await appRepos().esami.update(exam.id, p);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    return r.ok;
  }

  async function commitTitle() {
    const trimmed = title.trim();
    if (trimmed === "" || trimmed === exam.title) {
      setTitle(exam.title);
      return;
    }
    if (!(await patch({ title: trimmed }))) setTitle(exam.title);
  }

  async function commitNotes() {
    const value = notes.trim() === "" ? null : notes.trim();
    if (value === exam.notes) return;
    if (!(await patch({ notes: value }))) setNotes(exam.notes ?? "");
  }

  async function commitTotal() {
    if (!/^\d{1,3}$/.test(totalDraft.trim())) {
      setTotalDraft(String(exam.total_chapters));
      return;
    }
    const total = Math.min(999, Number(totalDraft.trim()));
    if (total === exam.total_chapters) {
      setTotalDraft(String(total));
      return;
    }
    if (await patch({ total_chapters: total })) setTotalDraft(String(total));
    else setTotalDraft(String(exam.total_chapters));
  }

  async function stepCompleted(delta: 1 | -1) {
    const next = Math.max(
      0,
      Math.min(exam.total_chapters, exam.completed_chapters + delta),
    );
    if (next !== exam.completed_chapters) {
      await patch({ completed_chapters: next });
    }
  }

  async function remove() {
    const r = await appRepos().esami.softDelete(exam.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDeleted();
    toast.show({
      message: "Esame eliminato.",
      action: {
        label: "Annulla",
        onClick: () => void appRepos().esami.restore(exam.id),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome">
        {(p) => (
          <Input
            {...p}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            maxLength={120}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          {(p) => (
            <DatePicker
              id={p.id}
              value={exam.date}
              clearable={false}
              onChange={(day: DayString | null) => {
                if (day) void patch({ date: day });
              }}
            />
          )}
        </Field>
        <Field label="Capitoli totali">
          {(p) => (
            <Input
              {...p}
              value={totalDraft}
              onChange={(e) => setTotalDraft(e.target.value)}
              onBlur={() => void commitTotal()}
              inputMode="numeric"
            />
          )}
        </Field>
      </div>

      <div>
        <p className="em-eyebrow">Capitoli completati</p>
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            aria-label="Un capitolo in meno"
            disabled={exam.completed_chapters <= 0}
            onClick={() => void stepCompleted(-1)}
          >
            −1
          </Button>
          <span className="em-body min-w-16 text-center tabular-nums text-[var(--em-text)]">
            {exam.completed_chapters}/{exam.total_chapters}
          </span>
          <Button
            type="button"
            variant="secondary"
            aria-label="Un capitolo in più"
            disabled={exam.completed_chapters >= exam.total_chapters}
            onClick={() => void stepCompleted(1)}
          >
            +1
          </Button>
        </div>
      </div>

      <Field label="Note" hint="Libro, capitoli, appunti">
        {(p) => (
          <Textarea
            {...p}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void commitNotes()}
            maxLength={2000}
          />
        )}
      </Field>

      <div className="flex justify-end border-t border-[var(--em-hairline)] pt-3">
        <Button type="button" variant="ghost" onClick={() => void remove()}>
          Elimina esame
        </Button>
      </div>
    </div>
  );
}
