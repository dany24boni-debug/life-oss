# Prompt 05 — New app shell + Today skeleton

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Create the (app) route group with the new navigation (bottom tab bar mobile, left rail desktop, ember-dot active state), routes /, /tasks, /calendar, /gym, /stats, /settings as skeletons, per-group loading/error boundaries, real date/greeting on Today, bridge links to/from the legacy dashboard.

## Scope

IN: app/(app)/* (new), proxy.ts (add / to protected list for now), minimal link from legacy. OUT: module logic, storage wiring, guest access, restyling legacy pages.

Estimated size: M. Recommended model: Sonnet.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
