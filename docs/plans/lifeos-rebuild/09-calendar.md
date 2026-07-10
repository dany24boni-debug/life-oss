# Prompt 09 — Calendar module: month/week + local events + Google port

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

Month grid and week strip on the custom Calendar component; local events CRUD with shared NL quick-add; unified day agenda (events + timed tasks + Google read-only); port Google Calendar integration off the legacy page fixing the render-time INSERT and the multi-account maybeSingle hazard; redirect /agenda when complete.

## Scope

IN: app/(app)/calendar, src/data events port usage, app/agenda (redirect only), lib/google (two targeted fixes). OUT: Google write-back, CalDAV, drag-to-time, token crypto changes.

Estimated size: M-L. Recommended model: Sonnet (escalate to Fable/Opus if token-store must change).

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
