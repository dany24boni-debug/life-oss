import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS, hasAnthropicKey } from "@/lib/anthropic/client";
import { buildOverseerContext } from "@/lib/overseer/context";
import { checkAndConsume } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-user sliding window. 20 chat turns/minute is generous for a
// human reading streamed responses; well below what a flooder would
// need to inflict damage. Tightening this is cheap if needed.
const OVERSEER_WINDOW_MS = 60_000;
const OVERSEER_MAX_PER_WINDOW = 20;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Rate limit BEFORE any Anthropic call or Supabase context fan-out.
  // Authenticated cost-amplification attacks (and runaway client
  // bugs) hit Anthropic billing first; fail closed here.
  const rl = checkAndConsume(
    `overseer:${user.id}`,
    OVERSEER_WINDOW_MS,
    OVERSEER_MAX_PER_WINDOW,
  );
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        error: "missing_anthropic_key",
        message:
          "Aggiungi ANTHROPIC_API_KEY a .env.local e riavvia il dev server per attivare l'Overseer.",
      },
      { status: 503 },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: "anthropic_unavailable" }, { status: 503 });
  }

  // Reject payloads larger than ~50 KB before parsing — prevents oversized
  // history arrays from being forwarded to the LLM (token cost amplification).
  const MAX_BODY_BYTES = 50 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: { messages?: ChatMessage[] } = {};
  try {
    body = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const MAX_HISTORY = 20;
  const MAX_MESSAGE_CHARS = 1500;

  const history = (body.messages ?? [])
    .filter(
      (m): m is ChatMessage =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.length > MAX_MESSAGE_CHARS ? m.content.slice(0, MAX_MESSAGE_CHARS) : m.content,
    }));
  if (history.length === 0) {
    return NextResponse.json({ error: "empty_messages" }, { status: 400 });
  }

  const { systemPrompt } = await buildOverseerContext(supabase, user.id);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const response = await client.messages.stream({
          model: MODELS.SONNET,
          max_tokens: 1024,
          system: systemPrompt,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // Log full error server-side for debugging; only surface a generic
        // line to the client so internal API details (model names, rate-limit
        // identifiers, request IDs) don't leak through the stream.
        console.error("[overseer] stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n[errore Overseer: servizio temporaneamente non disponibile]"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
