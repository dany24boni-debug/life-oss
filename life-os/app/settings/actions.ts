"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/events/record";

const VALID_STATES = new Set([
  "Esami",
  "Scaling",
  "Manutenzione",
  "Recupero",
  "Vacanza",
]);

export async function switchState(formData: FormData) {
  const next = String(formData.get("state") ?? "");
  if (!VALID_STATES.has(next)) redirect("/settings");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Skip work if already in this state.
  const { data: current } = await supabase
    .from("user_states")
    .select("state")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current?.state === next) {
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  // Close current span, open new one.
  const now = new Date().toISOString();
  const { error: closeErr } = await supabase
    .from("user_states")
    .update({ ended_at: now })
    .eq("user_id", user.id)
    .is("ended_at", null);
  if (closeErr) throw new Error(closeErr.message);

  const { data: insertedState, error: insErr } = await supabase
    .from("user_states")
    .insert({
      user_id: user.id,
      state: next,
      triggered_by: "manual",
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "state",
    kind: "state.changed",
    summary: `Stato → ${next}${current?.state ? ` (era ${current.state})` : ""}`,
    refTable: "user_states",
    refId: insertedState?.id ?? null,
    payload: { from: current?.state ?? null, to: next, triggered_by: "manual" },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
