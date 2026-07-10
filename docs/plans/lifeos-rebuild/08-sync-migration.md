# Prompt 08 — Sync engine + guest-to-account migration

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Additive Supabase migrations for the new-shape entities; Supabase adapter; background sync engine (push queue, pull on focus, LWW by updated_at, tombstones); guest-to-account migration with summary screen; JSON export/import; ember-dot sync status.

## Scope

IN: src/data/synced (new), supabase/migrations/0019+ (additive only), Settings data section. OUT: realtime channels, CRDT, Google data, legacy tables restructuring.

Estimated size: L. Recommended model: Fable/Opus Effort Max.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
