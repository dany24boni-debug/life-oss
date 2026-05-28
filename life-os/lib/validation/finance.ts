/**
 * Runtime validation per le server actions /finance Uscite
 * (Sprint U2). Mirror della migration 0017 personal_expenses sul
 * lato application.
 *
 * Le 3 action (add/update/delete) parsano FormData via
 * parseFormData (single-value) — il form NON ha campi multi-value
 * (la categoria è una stringa singola da chip single-select).
 */

import { z } from "zod";
import { CATEGORIES } from "@/lib/finance/auto-classify";
import { DateYmdSchema, UuidSchema } from "./form-inputs";

// ============================================================
// Primitives local
// ============================================================
//
// trimmedOptional resta locale per module isolation (vedi Sprint
// U1 audit, LOW1). Identico a quello in form-inputs.ts e gym.ts.

const trimmedOptional = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v ?? null;
      const t = v.trim();
      return t.length === 0 ? null : t.slice(0, max);
    },
    z.string().max(max).nullable(),
  );

// Amount in € con max 2 decimali. Coerce da string (FormData).
// Range mirror della migration 0017: amount > 0 AND amount <= 99999999.99.
// La precisione decimale è validata QUI (no silent DB truncation):
// se l'utente scrive "12.999" la action rifiuta con
// "amount_max_2_decimals" invece di salvare 13.00 in silenzio.
// Closes ECC mid-sprint U2 HIGH-1.
//
// .gt(0) cattura anche NaN e -Infinity da z.coerce.number() (in
// JavaScript NaN > 0 === false). La refine sotto NON ha
// bisogno di Number.isFinite — closes ECC end-of-sprint U2
// security MEDIUM-3 (guardia ridondante che rischiava di far
// credere a un futuro refactor che la refine fosse la difesa
// principale contro NaN, lasciando un buco se .gt(0) veniva
// rimosso).
const AmountEurSchema = z.coerce
  .number()
  .gt(0, { message: "amount_must_be_positive" })
  .max(99999999.99, { message: "amount_too_large" })
  .refine(
    (v) => Math.round(v * 100) === v * 100,
    { message: "amount_max_2_decimals" },
  );

// Closed enum mirror del CHECK constraint DB.
const CategorySchema = z.enum(CATEGORIES);

// ============================================================
// Schemas
// ============================================================

export const AddExpenseSchema = z.object({
  expense_date: DateYmdSchema,
  amount: AmountEurSchema,
  category: CategorySchema,
  note: trimmedOptional(280),
});
export type AddExpenseInput = z.infer<typeof AddExpenseSchema>;

export const UpdateExpenseSchema = z.object({
  id: UuidSchema,
  expense_date: DateYmdSchema,
  amount: AmountEurSchema,
  category: CategorySchema,
  note: trimmedOptional(280),
});
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

export const ExpenseIdSchema = z.object({
  id: UuidSchema,
});
export type ExpenseIdInput = z.infer<typeof ExpenseIdSchema>;
