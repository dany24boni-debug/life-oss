import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ endpoint: z.url().max(2000) });

/**
 * Cancellazione della registrazione push del dispositivo (run-09
 * prompt 5): la riga server muore CON la subscription del browser —
 * mai endpoint orfani che la Edge Function continuerebbe a chiamare.
 * RLS-scoped: si può cancellare solo la propria riga.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("lo_push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint);
  if (error) {
    console.error("[push] unsubscribe error:", error.message);
    return NextResponse.json({ error: "storage" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
