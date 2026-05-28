// Today's Call — single-line status banner.
// Real generation uses Anthropic Haiku 4.5 when ANTHROPIC_API_KEY is set.
// Falls back to a deterministic stub otherwise so the UI never breaks.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInTimezone } from "@/lib/tasks/generator";
import { getAnthropicClient, MODELS } from "@/lib/anthropic/client";

export type ColorTag = "GREEN" | "YELLOW" | "RED" | "RECUPERO" | "VACANZA";

const VALID_COLOR_TAGS = new Set<string>([
  "GREEN",
  "YELLOW",
  "RED",
  "RECUPERO",
  "VACANZA",
]);

// Validates an untrusted runtime string against the ColorTag union. Used at
// the two boundaries where strings cross the type system: the daily_calls
// cache row (DB allows any string) and the LLM regex capture (model can
// return any casing/value). Falls back to YELLOW so VISUAL[tone] in
// TodaysCallBanner never reads undefined and the UI never crashes.
function asColorTag(s: string | null | undefined): ColorTag {
  return s && VALID_COLOR_TAGS.has(s) ? (s as ColorTag) : "YELLOW";
}

export type TodaysCall = {
  text: string;
  color_tag: ColorTag;
};

type Inputs = {
  state: string;
  yesterdayCompletionPct: number; // 0..100
  streakDays: number;
  topTargetGap: string | null;
  detectionFlag: "slip" | null;
};

export function stubTodaysCall(i: Inputs): TodaysCall {
  if (i.state === "Recupero") {
    return {
      text: "RECUPERO. Modalità minima attivata. Non aprirla pensando a tutto.",
      color_tag: "RECUPERO",
    };
  }
  if (i.state === "Vacanza") {
    return {
      text: "VACANZA. Tutto fermo tranne i non-negotiables. Riprendi quando torni.",
      color_tag: "VACANZA",
    };
  }
  if (i.detectionFlag === "slip") {
    return {
      text: "RED. Sei in calo. Scegli un intervento e tieni la catena.",
      color_tag: "RED",
    };
  }
  if (i.yesterdayCompletionPct >= 80) {
    const gap = i.topTargetGap ? ` ${i.topTargetGap}.` : "";
    return {
      text: `GREEN. Sei in linea col mese.${gap} Chiudi i HEAVY oggi.`,
      color_tag: "GREEN",
    };
  }
  if (i.yesterdayCompletionPct >= 50) {
    return {
      text: "YELLOW. Ieri sotto soglia ma non rotta. Riprendi dai LIGHT.",
      color_tag: "YELLOW",
    };
  }
  return {
    text: "YELLOW. Riparti dal LIGHT più piccolo. Non serve fare tutto.",
    color_tag: "YELLOW",
  };
}

// Read or generate today's call. Insert into daily_calls cache.
// Uses Haiku 4.5 when ANTHROPIC_API_KEY is set; falls back to the deterministic
// stub when the key is missing or the LLM call errors out.
export async function getOrCreateTodaysCall(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  inputs: Inputs,
): Promise<TodaysCall | null> {
  const today = todayInTimezone(timezone);

  const { data: cached } = await supabase
    .from("daily_calls")
    .select("text, color_tag")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();
  if (cached) return { text: cached.text, color_tag: asColorTag(cached.color_tag) };

  const generated = await generateTodaysCall(inputs);

  const { error } = await supabase.from("daily_calls").upsert(
    {
      user_id: userId,
      date: today,
      text: generated.text,
      color_tag: generated.color_tag,
    },
    { onConflict: "user_id,date" },
  );
  if (error) {
    return generated;
  }
  return generated;
}

async function generateTodaysCall(inputs: Inputs): Promise<TodaysCall> {
  const client = getAnthropicClient();
  if (!client) return stubTodaysCall(inputs);

  try {
    const sys = `Sei l'assistente Life OS. Genera UNA singola riga di stato per oggi, max 15 parole, italiano. Tono pratico e diretto, niente frasi motivazionali, niente coaching.

Formato esatto: [TAG]. [una riga concreta].

TAG ammessi: GREEN (in linea), YELLOW (sotto soglia ma recuperabile), RED (slip rilevato), RECUPERO (in modalità recupero), VACANZA (in vacanza).

Esempi:
- "GREEN. Sei in linea col mese. Chiudi i 2 HEAVY oggi."
- "YELLOW. Hai saltato l'acqua 2 giorni — riprendi da lì."
- "RECUPERO. Modalità minima attivata. Non aprirla pensando a tutto."

Niente virgolette, niente preamboli, solo la riga.`;

    const userMsg = `Stato: ${inputs.state}
Completion ieri: ${inputs.yesterdayCompletionPct}%
Streak: ${inputs.streakDays} giorni
Top target gap: ${inputs.topTargetGap ?? "(nessuno)"}
Detection flag: ${inputs.detectionFlag ?? "(none)"}

Genera la riga ora.`;

    const res = await client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 80,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
    });

    const text =
      res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim() || stubTodaysCall(inputs).text;

    const tagMatch = text.match(/^(GREEN|YELLOW|RED|RECUPERO|VACANZA)\b/i);
    const color_tag = asColorTag(tagMatch?.[1]?.toUpperCase());
    return { text, color_tag };
  } catch {
    return stubTodaysCall(inputs);
  }
}
