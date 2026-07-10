// Single source of truth for the Anthropic SDK client.
// Returns null when ANTHROPIC_API_KEY is missing so callers can fall back to stubs.

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null | undefined;

export function getAnthropicClient(): Anthropic | null {
  if (cached !== undefined) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    cached = null;
    return cached;
  }
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export const MODELS = {
  // Today's Call banner — short, low-latency, cheap.
  HAIKU: "claude-haiku-4-5-20251001",
  // Overseer chat — context-rich, streaming.
  SONNET: "claude-sonnet-4-6",
} as const;

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
