// Helpers for whitelist-gated private modules.
// Source of truth: private_modules_whitelist table — never derive visibility
// from email or any other field that could leak across users.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPrivateWhitelist(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("private_modules_whitelist")
    .select("module_slug")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.module_slug));
}

export function hasAnyPrivate(whitelist: Set<string>): boolean {
  return whitelist.size > 0;
}

/**
 * Slugs gated dalla `private_modules_whitelist` DB table. On this
 * branch only `chameleon_os` is registered as a private module; the
 * DB whitelist remains a feature gate (you may want to show it only
 * to users explicitly added to the whitelist).
 */
export const PRIVATE_SLUGS = ["chameleon_os"] as const;
export type PrivateSlug = (typeof PRIVATE_SLUGS)[number];
