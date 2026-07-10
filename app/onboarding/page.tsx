import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileStep } from "./_steps/profile";
import { EnergyStep } from "./_steps/energy";
import { GoalsStep } from "./_steps/goals";
import { ModulesStep } from "./_steps/modules";
import { StateStep } from "./_steps/state";
import { TargetsStep } from "./_steps/targets";

const STEPS = [1, 2, 3, 4, 5, 6] as const;
type Step = (typeof STEPS)[number];

function parseStep(raw: string | string[] | undefined): Step {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return STEPS.includes(n as Step) ? (n as Step) : 1;
}

const MONTH_NAMES_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Avoid the generated PageProps<"/route"> helper — it lives in
// .next/dev/types/routes.d.ts which is not produced by `tsc --noEmit`,
// breaking CI. The explicit Promise shape is stable in Next 16.
export default async function OnboardingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, chronotype, wake_time, sleep_time, timezone, onboarding_completed")
    .eq("id", user.id)
    .single();

  const sp = await props.searchParams;

  // If onboarding is already completed, only allow entry when an explicit
  // step is requested (e.g. coming from /settings to edit a section).
  if (profile?.onboarding_completed && !sp.step) redirect("/dashboard");

  const step = parseStep(sp.step);

  if (step === 1) {
    return <ProfileStep defaultDisplayName={profile?.display_name ?? ""} />;
  }

  if (step === 2) {
    return (
      <EnergyStep
        profile={{
          chronotype: profile?.chronotype ?? null,
          wake_time: profile?.wake_time ?? null,
          sleep_time: profile?.sleep_time ?? null,
          timezone: profile?.timezone ?? null,
        }}
      />
    );
  }

  if (step === 3) {
    const { data: goals } = await supabase
      .from("user_long_term_goals")
      .select("category, text, target_date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    return <GoalsStep existing={goals ?? []} />;
  }

  if (step === 4) {
    const [{ data: registry }, { data: userModules }, { data: whitelist }] = await Promise.all([
      supabase.from("modules_registry").select("slug, name, description, is_default, is_private").order("is_default", { ascending: false }),
      supabase.from("user_modules").select("module_slug, is_active").eq("user_id", user.id),
      supabase.from("private_modules_whitelist").select("module_slug").eq("user_id", user.id),
    ]);
    const allowedPrivateSlugs = new Set((whitelist ?? []).map((w) => w.module_slug));
    const available = (registry ?? []).filter((m) => !m.is_private || allowedPrivateSlugs.has(m.slug));
    const activeSlugs = new Set(
      (userModules ?? []).filter((m) => m.is_active).map((m) => m.module_slug),
    );
    return <ModulesStep available={available} activeSlugs={activeSlugs} />;
  }

  if (step === 5) {
    const { data: existing } = await supabase
      .from("user_states")
      .select("state")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const current = existing?.state === "Esami" || existing?.state === "Manutenzione" ? existing.state : null;
    return <StateStep current={current} />;
  }

  // step === 6
  const now = new Date();
  const monthLabel = `${MONTH_NAMES_IT[now.getMonth()]} ${now.getFullYear()}`;
  const monthFirstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: registry }, { data: userModules }, { data: existing }] = await Promise.all([
    supabase.from("modules_registry").select("slug, name"),
    supabase.from("user_modules").select("module_slug").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("user_monthly_targets")
      .select("module, metric, target_value")
      .eq("user_id", user.id)
      .eq("month", monthFirstDay)
      .order("created_at", { ascending: true }),
  ]);
  const activeSet = new Set((userModules ?? []).map((m) => m.module_slug));
  const activeModules = (registry ?? []).filter((m) => activeSet.has(m.slug));
  return <TargetsStep activeModules={activeModules} monthLabel={monthLabel} existing={existing ?? []} />;
}
