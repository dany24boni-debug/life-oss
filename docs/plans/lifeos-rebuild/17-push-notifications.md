# Prompt 17 — v2 optional: Web Push + email digest for accounts

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Requires D2 confirmation. VAPID keys, push_subscriptions table with RLS, service-worker push and click handlers, Supabase Edge Function cron sender, per-category opt-in, morning brief, email digest fallback. iOS requires installed PWA (16.4+) - stated in UI.

## Scope

IN: push infra end to end. OUT: guest push (never - see B2.2), SMS, third-party notification services.

Estimated size: M. Recommended model: Fable/Opus Effort Max.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
