"use client";

/**
 * Scheda spesa (run-05 prompt 4): BottomSheet/Modal come le altre schede;
 * commit-on-blur, eliminazione col toast Annulla (restore vince il LWW).
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  DatePicker,
  Field,
  Input,
  Modal,
  useToast,
} from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos, useExpense } from "@/data/hooks";
import type { Expense, ExpensePatch } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { parseEuroAmount } from "./logic";

export function ExpenseDetailSheet({
  expenseId,
  onClose,
}: {
  expenseId: string | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const expense = useExpense(expenseId);
  const open = expenseId !== null;

  const body =
    expense === undefined ? null : expense === null ? (
      <p className="em-body-sm py-4 text-[var(--em-text-3)]">
        Questa spesa non c&apos;è più.
      </p>
    ) : (
      <ExpenseForm expense={expense} onDeleted={onClose} />
    );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Spesa">
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Spesa">
      {open ? <div className="pb-2">{body}</div> : <span />}
    </BottomSheet>
  );
}

function ExpenseForm({
  expense,
  onDeleted,
}: {
  expense: Expense;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [amountDraft, setAmountDraft] = useState(
    String(expense.amount).replace(".", ","),
  );
  const [category, setCategory] = useState(expense.category);
  const [note, setNote] = useState(expense.note ?? "");

  async function patch(p: ExpensePatch): Promise<boolean> {
    const r = await appRepos().spese.update(expense.id, p);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    return r.ok;
  }

  async function commitAmount() {
    const parsed = parseEuroAmount(amountDraft);
    if (parsed === null) {
      setAmountDraft(String(expense.amount).replace(".", ","));
      return;
    }
    if (parsed !== expense.amount && !(await patch({ amount: parsed }))) {
      setAmountDraft(String(expense.amount).replace(".", ","));
    }
  }

  async function commitCategory() {
    const trimmed = category.trim().toLowerCase();
    if (trimmed === "" ) {
      setCategory(expense.category);
      return;
    }
    if (trimmed !== expense.category && !(await patch({ category: trimmed }))) {
      setCategory(expense.category);
    }
  }

  async function commitNote() {
    const value = note.trim() === "" ? null : note.trim();
    if (value === expense.note) return;
    if (!(await patch({ note: value }))) setNote(expense.note ?? "");
  }

  async function remove() {
    const r = await appRepos().spese.softDelete(expense.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDeleted();
    toast.show({
      message: "Spesa eliminata.",
      action: {
        label: "Annulla",
        onClick: () => void appRepos().spese.restore(expense.id),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importo">
          {(p) => (
            <Input
              {...p}
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onBlur={() => void commitAmount()}
              inputMode="decimal"
            />
          )}
        </Field>
        <Field label="Giorno">
          {(p) => (
            <DatePicker
              id={p.id}
              value={expense.date}
              clearable={false}
              onChange={(day: DayString | null) => {
                if (day) void patch({ date: day });
              }}
            />
          )}
        </Field>
      </div>

      <Field label="Categoria">
        {(p) => (
          <Input
            {...p}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => void commitCategory()}
            maxLength={40}
          />
        )}
      </Field>

      <Field label="Nota">
        {(p) => (
          <Input
            {...p}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => void commitNote()}
            maxLength={200}
          />
        )}
      </Field>

      <div className="flex justify-end border-t border-[var(--em-hairline)] pt-3">
        <Button type="button" variant="ghost" onClick={() => void remove()}>
          Elimina spesa
        </Button>
      </div>
    </div>
  );
}
