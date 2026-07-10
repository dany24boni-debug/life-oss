"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { recordEvent, deleteEventsByRef } from "@/lib/events/record";

const VALID_KINDS = new Set(["income", "expense"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function logEntry(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "").trim();
  const kind = String(formData.get("kind") ?? "expense");
  const amount = Number(formData.get("amount_eur") ?? 0);
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!VALID_KINDS.has(kind) || !Number.isFinite(amount) || amount <= 0) {
    revalidatePath("/finance");
    return;
  }

  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Rome";
  const date = dateRaw || todayInTimezone(timezone);

  const { data: inserted, error } = await supabase
    .from("finance_entries")
    .insert({
      user_id: user.id,
      date,
      kind,
      amount_eur: amount,
      category: category || null,
      description: description || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "finance",
    kind: "finance.entry_added",
    summary: `${kind === "income" ? "+" : "−"}${amount}€${category ? ` · ${category}` : ""}`,
    refTable: "finance_entries",
    refId: inserted.id,
    occurredAt: `${date}T12:00:00Z`,
    payload: { kind, amount_eur: amount, category, description, date },
  });

  revalidatePath("/finance");
}

export async function deleteEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("finance_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await deleteEventsByRef(supabase, user.id, "finance_entries", id);

  revalidatePath("/finance");
}
