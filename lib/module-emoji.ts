/**
 * Registro emoji per modulo — ricollocato 1:1 da lib/mock-data.ts
 * (run-05 prompt 1): il file dei mock muore col ritiro della dashboard,
 * ma /recap (D4: intatta) usa questa mappa per le righe dei task.
 */

export const MODULE_EMOJI: Record<string, string> = {
  studio: "📚",
  gym: "💪",
  health: "💧",
  finance: "💶",
  chameleon_os: "🦎",
  general: "✨",
};

export function emojiForModule(moduleSlug: string): string {
  if (moduleSlug.startsWith("custom:")) return "✨";
  return MODULE_EMOJI[moduleSlug] ?? "○";
}
