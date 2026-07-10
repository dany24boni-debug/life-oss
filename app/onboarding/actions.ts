"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_CHRONOTYPES = new Set(["morning", "intermediate", "evening"]);

function isValidTimezone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 60) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const VALID_CATEGORIES = new Set(["financial", "health", "life", "business", "education"]);
const VALID_STATES = new Set(["Esami", "Manutenzione"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function nextStep(step: number) {
  redirect(`/onboarding?step=${step}`);
}

export async function saveProfile(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) nextStep(1);

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  nextStep(2);
}

export async function saveEnergy(formData: FormData) {
  const chronotype = String(formData.get("chronotype") ?? "intermediate");
  const wakeTime = String(formData.get("wake_time") ?? "09:00");
  const sleepTime = String(formData.get("sleep_time") ?? "01:00");
  const timezoneRaw = String(formData.get("timezone") ?? "Europe/Rome");

  const safeChronotype = VALID_CHRONOTYPES.has(chronotype) ? chronotype : "intermediate";
  // Validate timezone against the platform's IANA list. An invalid value
  // would later make Intl.DateTimeFormat throw inside todayInTimezone(),
  // breaking task generation for that user.
  const timezone = isValidTimezone(timezoneRaw) ? timezoneRaw : "Europe/Rome";

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      chronotype: safeChronotype,
      wake_time: wakeTime,
      sleep_time: sleepTime,
      timezone,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  nextStep(3);
}

export async function saveGoals(formData: FormData) {
  const { supabase, user } = await requireUser();

  const rows: { user_id: string; category: string; text: string; target_date: string | null }[] = [];
  for (let i = 0; i < 5; i++) {
    const text = String(formData.get(`text_${i}`) ?? "").trim();
    if (!text) continue;
    const category = String(formData.get(`category_${i}`) ?? "");
    if (!VALID_CATEGORIES.has(category)) continue;
    const dateRaw = String(formData.get(`target_date_${i}`) ?? "").trim();
    rows.push({
      user_id: user.id,
      category,
      text,
      target_date: dateRaw || null,
    });
  }

  // Idempotent: clear and re-insert this user's goals.
  const { error: delErr } = await supabase
    .from("user_long_term_goals")
    .delete()
    .eq("user_id", user.id);
  if (delErr) throw new Error(delErr.message);

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("user_long_term_goals").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  nextStep(4);
}

export async function saveModules(formData: FormData) {
  const { supabase, user } = await requireUser();

  const selected = new Set(formData.getAll("modules").map((v) => String(v)));

  // Validate against registry + whitelist.
  const [{ data: registry }, { data: whitelist }] = await Promise.all([
    supabase.from("modules_registry").select("slug, is_private"),
    supabase.from("private_modules_whitelist").select("module_slug").eq("user_id", user.id),
  ]);
  const allowedPrivate = new Set((whitelist ?? []).map((w) => w.module_slug));
  const allowedSlugs = new Set(
    (registry ?? [])
      .filter((m) => !m.is_private || allowedPrivate.has(m.slug))
      .map((m) => m.slug),
  );

  const rows = (registry ?? [])
    .filter((m) => allowedSlugs.has(m.slug))
    .map((m) => ({
      user_id: user.id,
      module_slug: m.slug,
      is_active: selected.has(m.slug),
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("user_modules")
      .upsert(rows, { onConflict: "user_id,module_slug" });
    if (error) throw new Error(error.message);
  }

  nextStep(5);
}

export async function saveInitialState(formData: FormData) {
  const state = String(formData.get("state") ?? "Manutenzione");
  if (!VALID_STATES.has(state)) nextStep(5);

  const { supabase, user } = await requireUser();

  // Close any currently-open state spans, then open a new one.
  const { error: closeErr } = await supabase
    .from("user_states")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ended_at", null);
  if (closeErr) throw new Error(closeErr.message);

  const { error: insErr } = await supabase.from("user_states").insert({
    user_id: user.id,
    state,
    triggered_by: "manual",
  });
  if (insErr) throw new Error(insErr.message);

  nextStep(6);
}

export async function saveTargetsAndComplete(formData: FormData) {
  const { supabase, user } = await requireUser();

  const now = new Date();
  const monthFirstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const rows: {
    user_id: string;
    module: string;
    metric: string;
    target_value: number;
    month: string;
  }[] = [];

  for (let i = 0; i < 3; i++) {
    const moduleSlug = String(formData.get(`module_${i}`) ?? "").trim();
    const metric = String(formData.get(`metric_${i}`) ?? "").trim();
    const valueRaw = String(formData.get(`target_value_${i}`) ?? "").trim();
    if (!moduleSlug || !metric || !valueRaw) continue;
    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 0) continue;
    rows.push({
      user_id: user.id,
      module: moduleSlug,
      metric,
      target_value: value,
      month: monthFirstDay,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("user_monthly_targets")
      .upsert(rows, { onConflict: "user_id,module,metric,month" });
    if (error) throw new Error(error.message);
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (profErr) throw new Error(profErr.message);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Legacy single-step action — kept for backward compatibility, redirects to the wizard.
export async function completeOnboarding() {
  redirect("/onboarding?step=1");
}
