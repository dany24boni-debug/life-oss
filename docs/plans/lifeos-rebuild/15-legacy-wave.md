# Prompt 15 — Legacy wave: port Esami/Expenses/Sera, delete the mock world

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Port Esami (keep pacing lib), Expenses (personal_expenses only; finance_entries becomes read-only archive), Sera (journal on ports, Drive export kept). Retire /commute and the mock dashboard: delete lib/mock-data.ts, the dead dashboard components, the dead engine actions. Redirect map old to new.

## Scope

IN: new module routes, deletions listed above, redirects. OUT: Business/Chameleon, Custom modules, Overseer (explicitly untouched per D4).

Estimated size: L. Recommended model: Sonnet.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
