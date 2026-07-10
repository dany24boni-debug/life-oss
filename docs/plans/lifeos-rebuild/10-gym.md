# Prompt 10 — Gym module: library, plans, live session logging

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Exercise library (seeded Italian catalog), workout plans, session flow with per-set weight x reps steppers, duplicate-last-set, auto rest timer (wake-safe), finish summary, per-exercise history with est. 1RM (reuse lib/fitness.ts), PRs, history heat strip, idempotent importers for gym_sessions and gym_workouts.

## Scope

IN: app/(app)/gym, src/data gym ports, importer action in Settings. OUT: supersets, plate calculator, RPE, health-platform integrations.

Estimated size: L. Recommended model: Sonnet.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
