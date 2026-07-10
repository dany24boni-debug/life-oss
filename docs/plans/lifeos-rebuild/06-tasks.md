# Prompt 06 — Tasks module v1 + Italian NL quick-add

STATUS: STUB — finalize from `01-blueprint.md` (B5) with chat-Claude before running.

## Goal

The flagship: tasks CRUD on the local storage port with quick-add natural-language parsing in Italian (dates, times, priorities, tags) shown as dismissible parse-preview chips; Oggi/Prossimi/Inbox/Fatti views; swipe complete, snooze menu, drag reorder, undo toasts, overdue rail. Parser is a pure unit-tested lib (lib/nlp-it).

## Scope

IN: app/(app)/tasks, Today task section, src/data usage, lib/nlp-it (new). OUT: recurrence, reminders, sync, legacy dashboard changes.

Estimated size: L. Recommended model: Fable/Opus Effort Max.

## To be completed at finalization

- Files expected to change
- Step-by-step approach
- Acceptance criteria
- Smoke-test checklist (real device)
