import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PushSubscribeSchema } from "@/data/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registrazione push del dispositivo (run-09 prompt 5, blueprint 17).
 * Autenticato, zod-validato, RLS-scoped: la riga vive in
 * lo_push_subscriptions (0020 + categories di 0031) col client
 * Supabase dell'UTENTE — la policy "Users own" fa il resto.
 * UNIQUE (user_id, endpoint): ri-registrare lo stesso browser
 * aggiorna (categorie comprese), non duplica.
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
  const parsed = PushSubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_subscription" }, { status: 400 });
  }

  const { error } = await supabase
    .from("lo_push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        categories: parsed.data.categories,
        user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
  if (error) {
    // La colonna categories arriva con la 0031: senza, l'upsert fallisce
    // e il client mostra la copy "non ancora attivo su questo server".
    console.error("[push] subscribe error:", error.message);
    return NextResponse.json({ error: "storage" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

/** Stato del dispositivo corrente: le categorie salvate per endpoint. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("lo_push_subscriptions")
    .select("categories")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) {
    console.error("[push] read error:", error.message);
    return NextResponse.json({ error: "storage" }, { status: 503 });
  }
  return NextResponse.json({
    subscribed: data !== null,
    categories: data?.categories ?? null,
  });
}
