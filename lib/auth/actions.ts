"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * signOut — unica azione auth condivisa tra mondo nuovo (Impostazioni) e
 * legacy (/more). Viveva in app/dashboard/actions.ts, morto col ritiro
 * della dashboard mock (run-05 prompt 1): questa è la ricollocazione 1:1,
 * corpo invariato.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
