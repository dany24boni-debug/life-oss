"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { recordEvent } from "@/lib/events/record";

const VALID_SLOTS = new Set(["morning", "lunch", "evening"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function getTodayInUserTz(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
  return todayInTimezone(data?.timezone ?? "Europe/Rome");
}

export async function addWater(formData: FormData) {
  const amount = Number(formData.get("amount_ml") ?? 250);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
    revalidatePath("/health");
    return;
  }
  const { supabase, user } = await requireUser();
  const today = await getTodayInUserTz(supabase, user.id);
  const { data: inserted, error } = await supabase
    .from("health_water_log")
    .insert({
      user_id: user.id,
      date: today,
      amount_ml: Math.round(amount),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "health",
    kind: "health.water_added",
    summary: `+${Math.round(amount)} ml acqua`,
    refTable: "health_water_log",
    refId: inserted.id,
    payload: { amount_ml: Math.round(amount), date: today },
  });

  revalidatePath("/health");
}

export async function undoLastWater() {
  const { supabase, user } = await requireUser();
  const today = await getTodayInUserTz(supabase, user.id);

  const { data: last } = await supabase
    .from("health_water_log")
    .select("id, amount_ml")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) {
    revalidatePath("/health");
    return;
  }
  const { error } = await supabase
    .from("health_water_log")
    .delete()
    .eq("id", last.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "health",
    kind: "health.water_undone",
    summary: `Annullato −${last.amount_ml} ml acqua`,
    payload: { amount_ml: last.amount_ml, date: today },
  });

  revalidatePath("/health");
}

export async function toggleStackSlot(formData: FormData) {
  const slot = String(formData.get("slot") ?? "");
  if (!VALID_SLOTS.has(slot)) {
    revalidatePath("/health");
    return;
  }
  const next = String(formData.get("next") ?? "true") === "true";

  const { supabase, user } = await requireUser();
  const today = await getTodayInUserTz(supabase, user.id);

  const column =
    slot === "morning" ? "morning_done" : slot === "lunch" ? "lunch_done" : "evening_done";

  const { error } = await supabase
    .from("health_stack_days")
    .upsert(
      {
        user_id: user.id,
        date: today,
        [column]: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    );
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "health",
    kind: next ? "health.stack_done" : "health.stack_undone",
    summary: `${slot === "morning" ? "Mattina" : slot === "lunch" ? "Pranzo" : "Sera"} stack: ${next ? "fatto" : "annullato"}`,
    payload: { slot, done: next, date: today },
  });

  revalidatePath("/health");
}

export async function logSleep(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "").trim();
  const hours = Number(formData.get("hours") ?? 0);
  const qualityRaw = String(formData.get("quality") ?? "");
  const quality = qualityRaw ? Math.max(1, Math.min(5, Number(qualityRaw))) : null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    revalidatePath("/health");
    return;
  }

  const { supabase, user } = await requireUser();
  const today = await getTodayInUserTz(supabase, user.id);
  const date = dateRaw || today;

  const { data: upserted, error } = await supabase
    .from("health_sleep_log")
    .upsert(
      {
        user_id: user.id,
        date,
        hours,
        quality,
        notes: notes || null,
      },
      { onConflict: "user_id,date" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "health",
    kind: "health.sleep_logged",
    summary: `${hours.toLocaleString("it-IT", { maximumFractionDigits: 1 })}h sonno${quality ? ` · q${quality}` : ""}`,
    refTable: "health_sleep_log",
    refId: upserted.id,
    occurredAt: `${date}T07:00:00Z`,
    payload: { hours, quality, date },
  });

  revalidatePath("/health");
}
