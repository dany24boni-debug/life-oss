import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropicClient,
  hasAnthropicKey,
  MODELS,
} from "@/lib/anthropic/client";
import { checkAndConsume } from "@/lib/rate-limit";
import { BriefSnapshotSchema, composeBrief } from "@/data/brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rifinitura LLM del morning brief (run-09 prompt 4). Riceve lo
 * SNAPSHOT aggregato (mai dump di tabelle: lo valida lo stesso schema
 * zod del composer), chiede al modello Haiku pinnato una riscrittura
 * italiana <=160 caratteri e risponde { line }. Su QUALSIASI intoppo
 * di modello risponde { line: null }: il client resta sulla frase
 * deterministica, che è il prodotto. Senza chiave: 503 (il client
 * degrada in silenzio).
 */

// Il client chiama una volta al giorno (cache localStorage); 5/min
// assorbe retry e device multipli senza aprire ai flood.
const BRIEF_WINDOW_MS = 60_000;
const BRIEF_MAX_PER_WINDOW = 5;

/** La riscrittura resta una riga: oltre si butta e si tiene la nostra. */
const MAX_LINE_CHARS = 180;

const SYSTEM_PROMPT = [
  "Sei la riga del buongiorno di LifeOS, un'app personale italiana.",
  "Ricevi uno snapshot JSON della giornata e una frase deterministica già corretta.",
  "Riscrivi la frase in UNA sola frase italiana più naturale e scorrevole, massimo 160 caratteri.",
  "Tono quieto e concreto: niente emoji, niente punti esclamativi, niente motivazione da poster.",
  "MAI aggiungere numeri, nomi o fatti che non siano nello snapshot; puoi solo ometterne.",
  "Rispondi SOLO con la frase, senza virgolette.",
].join(" ");

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate limit PRIMA di qualsiasi chiamata Anthropic (pattern overseer).
  const rl = checkAndConsume(
    `brief:${user.id}`,
    BRIEF_WINDOW_MS,
    BRIEF_MAX_PER_WINDOW,
  );
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "missing_anthropic_key" }, { status: 503 });
  }

  // Lo snapshot è piccolo per costruzione: tutto oltre i 10 KB è abuso.
  const MAX_BODY_BYTES = 10 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = BriefSnapshotSchema.safeParse(
    (raw as { snapshot?: unknown })?.snapshot,
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_snapshot" }, { status: 400 });
  }

  const deterministic = composeBrief(parsed.data);
  if (deterministic === null) {
    // Zero dati: niente da rifinire.
    return NextResponse.json({ line: null });
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: "anthropic_unavailable" }, { status: 503 });
  }

  try {
    const response = await client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 120,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Snapshot: ${JSON.stringify(parsed.data)}\nFrase deterministica: ${deterministic}`,
        },
      ],
    });
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim()
      .replace(/\s+/g, " ");
    // Risposta strana (vuota, multi-riga compressa troppo lunga):
    // si scarta e il client resta sul deterministico.
    if (text === "" || text.length > MAX_LINE_CHARS) {
      return NextResponse.json({ line: null });
    }
    return NextResponse.json({ line: text });
  } catch (err) {
    // Log server-side, mai dettagli verso il client (pattern overseer).
    console.error("[brief] anthropic error:", err);
    return NextResponse.json({ line: null });
  }
}
