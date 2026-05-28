// Shared tone → CSS-var maps for Pulse components.
//
// MetricTile, InsightToneCard, /body landing, Evidence/* and a few others
// all need the same five lookups (text colour, raw colour var, stripe
// gradient, tint background, edge border). Without this file each
// component carried its own copy — adding a 6th tone would require
// updating 5 files in lockstep. Importing from here removes that risk.
import type { ToneKey } from "@/lib/types";

export const TONE_TEXT: Record<ToneKey, string> = {
  energy: "text-accent-energy",
  good: "text-accent-good",
  warn: "text-accent-warn",
  bad: "text-accent-bad",
  info: "text-accent-info",
};

export const TONE_VAR: Record<ToneKey, string> = {
  energy: "var(--color-accent-energy)",
  good: "var(--color-accent-good)",
  warn: "var(--color-accent-warn)",
  bad: "var(--color-accent-bad)",
  info: "var(--color-accent-info)",
};

export const TONE_STRIPE: Record<ToneKey, string> = {
  energy: "var(--grad-tile-stripe-energy)",
  good: "var(--grad-tile-stripe-good)",
  warn: "var(--grad-tile-stripe-warn)",
  bad: "var(--grad-tile-stripe-bad)",
  info: "var(--grad-tile-stripe-info)",
};

export const TONE_TINT: Record<ToneKey, string> = {
  energy: "var(--color-energy-tint)",
  good: "var(--color-good-tint)",
  warn: "var(--color-warn-tint)",
  bad: "var(--color-bad-tint)",
  info: "var(--color-info-tint)",
};

export const TONE_EDGE: Record<ToneKey, string> = {
  energy: "var(--color-energy-edge)",
  good: "var(--color-good-edge)",
  warn: "var(--color-warn-edge)",
  bad: "var(--color-bad-edge)",
  info: "var(--color-info-edge)",
};
