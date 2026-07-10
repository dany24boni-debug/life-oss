// Server wrapper that decides whether to mount the Overseer chat:
// only renders for authenticated users who have completed onboarding.
// Reads the Anthropic key flag once and passes it as a prop to the client.

import { createClient } from "@/lib/supabase/server";
import { hasAnthropicKey } from "@/lib/anthropic/client";
import { Overseer } from "./overseer";

export async function OverseerMount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_completed) return null;

  return <Overseer available={hasAnthropicKey()} />;
}
