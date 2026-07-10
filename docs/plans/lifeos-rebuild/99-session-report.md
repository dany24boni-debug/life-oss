# LifeOS — Session 00 Report

Date: 2026-07-09/10 (overnight, unattended)
Branch: `feat/00-audit-blueprint` (created from `main` @ `e173b58`).
Nothing committed, nothing pushed, nothing tagged — all work sits uncommitted
in the working tree as NEW files only. `git status` shows exactly three
untracked paths (`docs/`, `life-os/ui/`, `life-os/app/dev/ui/`) and zero
modified tracked files.

## Files produced

Documentation (`docs/plans/lifeos-rebuild/`):
- `00-audit.md` — full audit: pre-flight, stack card, route inventory with grades, native-control sweep (20 occurrences listed), data layer, auth trace with failure hypotheses, feature inventory, cross-cutting concerns, security, dependencies, confidence appendix.
- `01-blueprint.md` — master rebuild design: decision points, product target, feature specs (v1/v2/later), architecture decisions, the Ember design system, implementation plan (prompts 02-17).
- `02-foundation.md` ... `17-push-notifications.md` — 16 prompt stubs (title, goal, scope, size, model tier).
- `99-session-report.md` — this file.

Code — Ember UI library (`life-os/ui/`, 25 new files, imported by nothing existing):
- `ember.css` — all tokens (dark default + light theme), type/motion/elevation recipes, signature ember dot, skeleton shimmer, reduced-motion handling; element rules scoped under `.em-scope`.
- `cx.ts`, `internal.tsx` (Portal, focus trap, click-outside, scroll lock, Esc, controllable state), `calendar-core.ts` (pure Italian date/time math), `field.tsx`.
- Components: `button.tsx`, `input.tsx` (Input + Textarea), `select.tsx`, `checkbox.tsx`, `radio.tsx`, `switch.tsx`, `calendar.tsx` (month grid + WeekStrip), `date-picker.tsx`, `time-picker.tsx`, `modal.tsx`, `bottom-sheet.tsx`, `toast.tsx` (provider + undo pattern), `tabs.tsx`, `progress.tsx` (bar + ring), `stat-card.tsx`, `chart-frame.tsx`, `empty-state.tsx`, `skeleton.tsx`, `command-palette.tsx`, `index.ts` (barrel, loads the stylesheet).

Code — playground (`life-os/app/dev/ui/`, 2 new files):
- `page.tsx` — route registration (dev-only via `notFound()` in production, same convention as the existing `/dev/components`), binds Bricolage Grotesque to `--font-em-display`.
- `showcase.tsx` — every component in default/filled/error/disabled/loading states, live overlays, theme toggle (dark/light), cmd+K binding.

## Phase C: EXECUTED — gate passed

1. Stack identified unambiguously: Next.js 16.2.6 App Router + React 19.2.4 + Tailwind v4 + TypeScript strict (audit A1).
2. Baseline `npx tsc --noEmit` and `npm run build` both passed BEFORE any new code was written.
3. Additive build confirmed: new `ui/` folder + a new route folder. In the App Router a route is registered by creating files, so **zero existing files were edited — the "one permitted edit" allowance went unused** (no anchor lines to quote).

Post-build verification (all green):
- `npx tsc --noEmit` — clean (one React 19 `onInput` typing issue found and fixed during the loop).
- `npm run build` — compiles; `/dev/ui` appears in the route manifest.
- `npm run lint` — clean (four strict react-hooks findings found and properly fixed: Portal now uses `useSyncExternalStore`, CommandPalette state remounts per open instead of reset effects, Toast ref initializer made pure).
- `npm run lint:sentinels` — OK.
- `npm test` — 322/322 passing (unchanged; no tests added — adding UI tests would have required editing `vitest.config.ts`, which the session rules forbid; test wiring belongs to prompt 02 finalization or 16).
- Runtime check: dev server booted, `GET /dev/ui` -> 200 with the full showcase rendered; served HTML contains **zero** `type="date"`, `type="time"`, or `<select>`; legacy `/login` still 200.

## Consolidated [NEEDS RUNTIME VERIFICATION] items

From `00-audit.md` (section A9 has the how-to-verify table):
1. GitHub CI never runs because the workflow sits at `life-os/.github/` instead of the repo root (structural evidence is conclusive; confirm on the Actions tab).
2. Magic-link failure hypotheses H1-H6: cross-context PKCE break (most likely), mail-scanner link consumption, `NEXT_PUBLIC_APP_URL` misconfiguration, Supabase redirect allowlist, missing migrations on a live project (the 0018 class), Supabase OTP send rate limits.
3. Whether BOTH live Supabase projects have all 19 migrations applied (`scripts/verify-schema.mjs`).
4. `/body` gym stats frozen (reads legacy `gym_workouts` that nothing writes) — grep-verified, needs a device confirmation.
5. Insights PR window drift (anchored to last workout date, not today).
6. Agenda breaks with a second Google account (`.maybeSingle()` on a now-plural row).
7. Add-expense silently no-ops when no category chip is selected.
8. `claude-sonnet-4-6` model alias in `lib/anthropic/client.ts` resolves against the current Anthropic API.
9. Overseer `content-length` guard bypassable when the header is absent.
10. Reduced-motion/focus-order behavior after server-action reloads (manual device pass).
11. `npm outdated` cleanliness (sandbox returned empty).
12. `proxy.ts` per-request Supabase `getUser()` latency cost in production.

## Decision points for Davide (full versions in `01-blueprint.md` B6)

- D1 Auth: replace magic link with 6-digit email OTP (keep link as same-device convenience). Recommended.
- D2 Notifications: v1 in-app only + .ics export; v2 Web Push for accounts with installed PWA + optional email digest. Recommended.
- D3 Repo layout: move app to repo root in the cleanup phase (fixes dead CI). Recommended.
- D4 Legacy modules: rebuild core five; port Esami/Expenses/Sera later; Business/Custom/Overseer stay untouched until you decide.
- D5 Light mode: ship both themes, dark default. Recommended (already implemented at token level).
- D6 Supabase topology: one shared project for both of you. Recommended.
- D7 AI features: keep Today's Call + Overseer as key-gated enhancements. Recommended.

## Dependencies added

None. The entire component library (including DatePicker/TimePicker/Calendar,
focus traps, toasts, command palette) is hand-rolled on React 19 + Tailwind v4.
The blueprint proposes exactly one future runtime dependency (`dexie`, prompt
04) plus `fake-indexeddb` as a dev dependency — both deferred and flagged there.

## Headline audit findings (details in `00-audit.md`)

- The main dashboard renders mock data (hero, streak, stats, tasks, why panel); only the display name is real. The complete task/streak/mood/intervention engine behind it is dead code with zero call sites, along with 9 of 12 dashboard components and the entire Voglia Engine.
- No guest mode exists: every feature route is auth-gated in `proxy.ts`.
- Two split-brain data models (gym: `gym_workouts` vs `gym_sessions`; finance: `finance_entries` vs `personal_expenses`); `/body` reads the dead one.
- 20 native browser control usages inventoried for replacement; zero `alert/confirm/prompt` — which also means zero confirmation on any destructive action.
- Infrastructure quality is genuinely good (RLS everywhere, AES-256-GCM token storage, CSRF discipline, CSP headers); the product surface is where the quality collapses.

## Recommended next session

1. Davide: 10 minutes on a phone — `npm run dev`, open `/dev/ui`, poke every control (especially DatePicker/TimePicker/BottomSheet touch behavior), and skim `01-blueprint.md` B6 to settle D1-D7.
2. Then run **prompt 03 (`03-auth-otp.md`)** — smallest session, kills the top daily pain (login reliability), independent of everything else.
3. In parallel or after: **prompt 04 (`04-storage-local.md`)** — the data spine; everything else stacks on it.
4. Finalize each stub with chat-Claude right before its session, per the established workflow (review diff, device smoke-test, manual commit, `--no-ff` merge).
