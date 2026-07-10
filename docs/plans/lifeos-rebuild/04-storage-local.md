# Prompt 04 — Storage ports + Dexie local adapter

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Build the data spine: repository interfaces per entity, zod schemas, UUIDv7 ids, Dexie database with versioned schema, updated_at + tombstones on every row, local adapters, live-query hooks, Result<T> convention, full unit tests over fake-indexeddb.

## Scope

IN: src/data/ (new), package.json (dexie, dev: fake-indexeddb). OUT: any UI, any Supabase adapter code, any change to existing routes.

Estimated size: M. Recommended model: Fable/Opus Effort Max.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
