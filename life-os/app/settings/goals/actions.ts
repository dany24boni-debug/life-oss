"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = new Set(["financial", "health", "life", "business", "education"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function addGoal(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const targetDate = String(formData.get("target_date") ?? "").trim();
  if (!text || !VALID_CATEGORIES.has(category)) {
    revalidatePath("/settings/goals");
    return;
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("user_long_term_goals").insert({
    user_id: user.id,
    text,
    category,
    target_date: targetDate || null,
    is_visible_in_why_panel: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/goals");
  revalidatePath("/dashboard");
}

export async function deleteGoal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_long_term_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/goals");
  revalidatePath("/dashboard");
}

export async function toggleVisibility(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "true") === "true";
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_long_term_goals")
    .update({ is_visible_in_why_panel: next })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/goals");
  revalidatePath("/dashboard");
}
