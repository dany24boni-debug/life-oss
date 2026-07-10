"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function monthFirstDay(month: string): string {
  // expects YYYY-MM, returns YYYY-MM-01
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(month)) return `${month.slice(0, 7)}-01`;
  return month;
}

export async function addTarget(formData: FormData) {
  const moduleSlug = String(formData.get("module") ?? "").trim();
  const metric = String(formData.get("metric") ?? "").trim();
  const target = Number(formData.get("target_value") ?? 0);
  const monthRaw = String(formData.get("month") ?? "").trim();
  const current = Number(formData.get("current_value") ?? 0);

  if (!moduleSlug || !metric || !Number.isFinite(target) || target <= 0 || !monthRaw) {
    revalidatePath("/settings/targets");
    return;
  }

  const { supabase, user } = await requireUser();
  const month = monthFirstDay(monthRaw);

  const { error } = await supabase.from("user_monthly_targets").upsert(
    {
      user_id: user.id,
      module: moduleSlug,
      metric,
      target_value: target,
      current_value: Number.isFinite(current) && current >= 0 ? current : 0,
      month,
    },
    { onConflict: "user_id,module,metric,month" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/settings/targets");
  revalidatePath("/dashboard");
}

export async function updateCurrent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const current = Number(formData.get("current_value") ?? 0);
  if (!id || !Number.isFinite(current) || current < 0) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_monthly_targets")
    .update({ current_value: current })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/targets");
  revalidatePath("/dashboard");
}

export async function deleteTarget(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_monthly_targets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/targets");
  revalidatePath("/dashboard");
}
