"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { recordEvent, deleteEventsByRef } from "@/lib/events/record";

const VALID_KINDS = new Set(["counter", "streak", "numeric", "calendar"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createCustom(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const unit = String(formData.get("unit") ?? "").trim();
  const targetRaw = String(formData.get("target") ?? "").trim();
  const dailyAction = String(formData.get("daily_action") ?? "").trim();
  const includeInDaily = String(formData.get("include_in_daily") ?? "false") === "true";

  if (!name || !VALID_KINDS.has(kind)) {
    revalidatePath("/custom");
    return;
  }

  const config: Record<string, unknown> = {};
  if (unit) config.unit = unit;
  if (targetRaw && Number.isFinite(Number(targetRaw))) config.target = Number(targetRaw);
  if (dailyAction) config.daily_action = dailyAction;

  const { supabase, user } = await requireUser();
  const { data: inserted, error } = await supabase
    .from("custom_modules")
    .insert({
      user_id: user.id,
      name,
      kind,
      config,
      include_in_daily_tasks: includeInDaily,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: `custom:${inserted.id}`,
    kind: "custom.module_created",
    summary: `Nuovo modulo custom: ${name} · ${kind}`,
    refTable: "custom_modules",
    refId: inserted.id,
    payload: { name, kind, config, include_in_daily: includeInDaily },
  });

  revalidatePath("/custom");
  revalidatePath("/more");
}

export async function deleteCustom(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("custom_modules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await deleteEventsByRef(supabase, user.id, "custom_modules", id);

  revalidatePath("/custom");
}

export async function addEntry(formData: FormData) {
  const moduleId = String(formData.get("custom_module_id") ?? "");
  const dateRaw = String(formData.get("date") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const completedRaw = String(formData.get("completed") ?? "false") === "true";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!moduleId) {
    return;
  }

  const { supabase, user } = await requireUser();

  // Defence in depth: verify the parent custom module belongs to this user
  // before linking an entry to it. RLS on custom_module_entries only checks
  // the entry's own user_id; without this guard a forged hidden input could
  // create an entry referencing another user's module.
  const { data: parent } = await supabase
    .from("custom_modules")
    .select("id")
    .eq("id", moduleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!parent) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Rome";
  const date = dateRaw || todayInTimezone(timezone);

  const value = valueRaw && Number.isFinite(Number(valueRaw)) ? Number(valueRaw) : null;

  const { data: inserted, error } = await supabase
    .from("custom_module_entries")
    .insert({
      user_id: user.id,
      custom_module_id: moduleId,
      date,
      value,
      label: label || null,
      completed: completedRaw,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Skip event recording for the auto-from-daily-task entries — those are
  // already tracked by the toggleTask event in dashboard/actions.ts. Otherwise
  // every checkbox toggle would create two events.
  if (notes !== "auto da daily task") {
    await recordEvent(supabase, {
      userId: user.id,
      module: `custom:${moduleId}`,
      kind: "custom.entry_added",
      summary: `Entry${value !== null ? ` · ${value}` : ""}${label ? ` · ${label}` : ""}`,
      refTable: "custom_module_entries",
      refId: inserted.id,
      occurredAt: `${date}T12:00:00Z`,
      payload: { value, label, completed: completedRaw, date },
    });
  }

  revalidatePath(`/custom/${moduleId}`);
  revalidatePath("/custom");
}

export async function deleteEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("custom_module_id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("custom_module_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await deleteEventsByRef(supabase, user.id, "custom_module_entries", id);

  if (moduleId) revalidatePath(`/custom/${moduleId}`);
}
