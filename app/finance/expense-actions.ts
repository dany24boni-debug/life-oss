"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recordEvent, deleteEventsByRef } from "@/lib/events/record";
import { parseFormData } from "@/lib/validation/form-inputs";
import {
  AddExpenseSchema,
  ExpenseIdSchema,
  UpdateExpenseSchema,
} from "@/lib/validation/finance";

// Sprint U2 server actions per il tab "Uscite" di /finance.
// Scrivono sulla tabella nuova personal_expenses (migration
// 0017). Coesistono con app/finance/actions.ts (legacy income/
// expense via finance_entries) — i due moduli non si chiamano
// fra loro.
//
// NIENTE UNIQUE constraint su personal_expenses (più spese
// stesso giorno = caso normale), quindi nessun 23505 da gestire
// — l'add è dritto. La race da doppio submit (UX gap cross-app
// flaggato in ECC mid-sprint HIGH-2) resta deferred a V2
// (idempotency-key cross-module).

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function revalidateAll() {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

function expenseSummary(amount: number, category: string): string {
  return `−${amount.toFixed(2)} € · ${category}`;
}

// ============================================================
// Add / Update / Delete
// ============================================================

/**
 * Insert a new personal_expenses row. Form fields:
 *   - expense_date: YYYY-MM-DD
 *   - amount: positive number, max 99999999.99, max 2 decimals
 *   - category: one of CATEGORIES (closed enum mirror del DB)
 *   - note: optional, max 280
 */
export async function addExpense(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(AddExpenseSchema, formData);
  if (!parsed.success) {
    console.warn("[finance] addExpense validation failed", parsed.error.flatten());
    revalidateAll();
    return;
  }
  const { expense_date, amount, category, note } = parsed.data;

  const { data: inserted, error } = await supabase
    .from("personal_expenses")
    .insert({
      user_id: user.id,
      expense_date,
      amount,
      category,
      note: note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[finance] addExpense insert failed:", error.message);
    revalidateAll();
    return;
  }

  await recordEvent(supabase, {
    userId: user.id,
    module: "finance",
    kind: "finance.expense_added",
    summary: expenseSummary(amount, category),
    refTable: "personal_expenses",
    refId: inserted.id,
    occurredAt: `${expense_date}T12:00:00Z`,
    payload: { amount, category, expense_date },
  });

  revalidateAll();
}

/**
 * Update an existing personal_expenses row.
 */
export async function updateExpense(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(UpdateExpenseSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[finance] updateExpense validation failed",
      parsed.error.flatten(),
    );
    revalidateAll();
    return;
  }
  const { id, expense_date, amount, category, note } = parsed.data;

  const { error } = await supabase
    .from("personal_expenses")
    .update({
      expense_date,
      amount,
      category,
      note: note ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[finance] updateExpense failed:", error.message);
    revalidateAll();
    return;
  }

  await recordEvent(supabase, {
    userId: user.id,
    module: "finance",
    kind: "finance.expense_updated",
    summary: expenseSummary(amount, category),
    refTable: "personal_expenses",
    refId: id,
    occurredAt: `${expense_date}T12:00:00Z`,
    payload: { amount, category, expense_date },
  });

  revalidateAll();
  redirect("/finance?tab=expenses");
}

/**
 * Delete a personal_expenses row.
 */
export async function deleteExpense(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(ExpenseIdSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[finance] deleteExpense validation failed",
      parsed.error.flatten(),
    );
    revalidateAll();
    return;
  }
  const { id } = parsed.data;

  const { error } = await supabase
    .from("personal_expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[finance] deleteExpense failed:", error.message);
    revalidateAll();
    return;
  }

  await deleteEventsByRef(supabase, user.id, "personal_expenses", id);

  await recordEvent(supabase, {
    userId: user.id,
    module: "finance",
    kind: "finance.expense_deleted",
    summary: "Spesa eliminata",
    refTable: "personal_expenses",
    refId: id,
  });

  revalidateAll();
  redirect("/finance?tab=expenses");
}
