"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { getPrivateWhitelist } from "@/lib/auth/whitelist";
import { recordEvent, deleteEventsByRef } from "@/lib/events/record";

const VALID_STATUS = new Set(["todo", "in_progress", "done", "dropped"]);

async function requireWhitelistedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const whitelist = await getPrivateWhitelist(supabase, user.id);
  if (!whitelist.has("chameleon_os")) redirect("/dashboard");
  return { supabase, user };
}

export async function addMilestone(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const target = String(formData.get("target_date") ?? "").trim();
  if (!title) {
    revalidatePath("/business/chameleon-os");
    return;
  }
  const { supabase, user } = await requireWhitelistedUser();
  const { data: inserted, error } = await supabase
    .from("chameleon_milestones")
    .insert({
      user_id: user.id,
      title,
      description: description || null,
      target_date: target || null,
      status: "todo",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "chameleon_os",
    kind: "chameleon.milestone_added",
    summary: `+ ${title}`,
    refTable: "chameleon_milestones",
    refId: inserted.id,
    payload: { title, target_date: target || null },
  });

  revalidatePath("/business/chameleon-os");
}

export async function setMilestoneStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !VALID_STATUS.has(status)) return;
  const { supabase, user } = await requireWhitelistedUser();

  const { data: prev } = await supabase
    .from("chameleon_milestones")
    .select("title, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const update: { status: string; completed_at?: string | null } = { status };
  if (status === "done") update.completed_at = new Date().toISOString();
  if (status !== "done") update.completed_at = null;
  const { error } = await supabase
    .from("chameleon_milestones")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  if (prev && prev.status !== status) {
    await recordEvent(supabase, {
      userId: user.id,
      module: "chameleon_os",
      kind: "chameleon.milestone_status_changed",
      summary: `${prev.title}: ${prev.status} → ${status}`,
      refTable: "chameleon_milestones",
      payload: { milestone_id: id, from: prev.status, to: status },
    });
  }

  revalidatePath("/business/chameleon-os");
}

export async function deleteMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireWhitelistedUser();
  const { error } = await supabase
    .from("chameleon_milestones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await deleteEventsByRef(supabase, user.id, "chameleon_milestones", id);

  revalidatePath("/business/chameleon-os");
}

export async function logSync(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "").trim();
  const minutes = Number(formData.get("duration_minutes") ?? 0);
  const topics = String(formData.get("topics") ?? "").trim();
  const decisions = String(formData.get("decisions") ?? "").trim();
  const next = String(formData.get("next_actions") ?? "").trim();

  if (!topics && !decisions && !next) {
    revalidatePath("/business/chameleon-os");
    return;
  }

  const { supabase, user } = await requireWhitelistedUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Rome";
  const date = dateRaw || todayInTimezone(timezone);

  const minutesVal = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;

  const { data: inserted, error } = await supabase
    .from("chameleon_partner_sync")
    .insert({
      user_id: user.id,
      date,
      duration_minutes: minutesVal,
      topics: topics || null,
      decisions: decisions || null,
      next_actions: next || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "chameleon_os",
    kind: "chameleon.sync_logged",
    summary: `Sync${minutesVal ? ` · ${minutesVal} min` : ""}${topics ? ` · ${topics.slice(0, 50)}` : ""}`,
    refTable: "chameleon_partner_sync",
    refId: inserted.id,
    occurredAt: `${date}T15:00:00Z`,
    payload: { minutes: minutesVal, topics, decisions, next, date },
  });

  revalidatePath("/business/chameleon-os");
}
