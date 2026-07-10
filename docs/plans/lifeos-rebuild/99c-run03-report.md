# Run 03 — Report

**Date:** 2026-07-10
**Model:** Fable 5, effort max. **Session:** unattended, five prompts in sequence (tasks UI, guest mode, auth OTP code-only, stats+streak, reminders v1).
**Branch:** `feat/run-03` (created at pre-flight). Commit-per-prompt authorized by Davide; never push, never merge.

---

## Pre-flight gate: PASSED

- `git status --porcelain`: empty (clean tree) on `main`, HEAD `a6c3ada` ("Merge branch 'feat/night-01'").
- Night-01 verified IN HEAD via `git ls-files`: `life-os/data/ports.ts`, `life-os/lib/nlp-it/*` (7 files), `life-os/app/(app)/layout.tsx`, `life-os/ui/ember.css` — all tracked.
- Working branch created: `feat/run-03`.
- Baseline health, all four green before any new code:
  - `npm run lint` — clean
  - `npx tsc --noEmit` — clean
  - `npm run build` — succeeds (all routes compiled)
  - `npm test` — **34 files, 467 tests, all passing** (baseline matches the expected ~467)
- Contracts read in full before Prompt 1: `data/ports.ts`, `data/hooks.ts`, `data/schemas.ts`, `data/result.ts`, `data/db.ts`, `data/local/tasks.ts`, `data/local/util.ts`, `lib/nlp-it/{types,parse,civil,index}.ts`, the `(app)` shell (layout, page, app-nav, tasks skeleton), the Ember component APIs (toast, tabs, modal, bottom-sheet, date-picker, time-picker, select, input, button, checkbox, field, empty-state, calendar-core), `proxy.ts`, `vitest.config.ts`, `tsconfig.json`. Blueprint B2.1/B2.2/B2.5/B3.3/B3.7 and the five stubs read; `00-audit.md` skimmed (auth section A4 will be read in full before Prompt 3).

### Contract deltas noticed at pre-flight (brief vs repo reality)

1. **`/tasks`, `/calendar`, `/stats` are already public** in `proxy.ts` (night-01 protected only `/` — exact match). Prompt 1's "still auth-gated" premise therefore applies to `/` (Today) only; `proxy.ts` is outside Prompt 1's fence and stays untouched until Prompt 2. No data-exposure concern: IndexedDB data is the browser's own.
2. **Route collisions (night-01 decisions, still binding):** legacy `/gym` and `/settings` keep their paths. The new settings surface of Prompts 2/4/5 cannot live at `/settings` (App Router duplicate-path error) — it will be created at **`/impostazioni`** inside the `(app)` group, with the shell nav pointing there (fence-legal: nav is `(app)` code). Legacy `/settings` remains reachable and protected, byte-identical.
3. **No undelete on `TasksRepo`** — "delete with 5s undo" (Prompt 1) is impossible via the existing port (`update()` cannot touch `deleted_at` and `getById` hides tombstones). An additive `restore(id)` repo method is required; the Prompt 1 fence explicitly allows missing repo methods (flagged, with tests).
4. **Vitest include patterns** are `lib/**/*.test.ts`, `data/**/*.test.ts`. Prompt 1 mandates tests for UI-side pure logic (snooze math, payload mapping, reorder math) which lives in the fenced `app/(app)/_components/tasks/` — running those tests requires adding `app/**/*.test.ts` to the include list. Same class of enabling config edit night-01 made (and flagged) for `data/**`; quoted as an anchored edit in the Prompt 1 section.

Prompt sections follow; each appended after its checkpoint.

---

## Prompt 1 — Tasks module UI: DONE (checkpoint green, committed)

**What was built**

- `app/(app)/_components/tasks/` (new, shared between /tasks and Today):
  - `logic.ts` — pure logic, fully unit-tested: `todayInZone` (Intl formatToParts, UTC fallback), chip model with `applyDismissals` (dismissing a chip returns its text to the title; "stasera" drops date+implicit time together; dismissing an explicit time never resurrects the 20:00 default; module chip toggles only the hint since it is never consumed), `withDefaultDate` (view-implicit date shown as a MUTED dismissible chip — no invisible payload magic), `toTaskCreate` (payload mapping incl. moduleHint -> `module_link {kind:"gym"}`), `snoozeDate` (stasera/domani/weekend/prossima settimana, strictly-future weekday convention consistent with the parser), `moveItem` (reorder math), `upcomingRange`, `dayHeading`, `groupTasksByDay`.
  - `logic.test.ts` — 23 tests, run against the REAL parser with injected `now`/`Europe/Rome`.
  - `actions.ts` — `useTaskActions()`: every mutation via the port, errors to Toast (B3.7, no silent catch), 5s undo Toast for complete (-> uncomplete), delete (-> restore), snooze (-> restore previous date), "Sposta tutte a oggi" (cumulative undo). No confirm dialogs anywhere.
  - `quick-add.tsx` — parse-on-keystroke with dismissible chips; optimistic submit (field clears immediately, text restored + error toast on `Result` ko).
  - `task-item.tsx` — row: optimistic complete toggle (render-time state adjustment, rollback on ko), tap -> detail, touch swipe right = completa / left = snooze menu (pointerType "touch" only, axis-locked, `touch-pan-y`, click suppression after swipe), desktop hover actions, overflow menu (keyboard/a11y fallback for swipe AND reorder: Sposta su/giù, Sposta a…, Riapri, Elimina).
  - `task-list.tsx` — drag-to-reorder from the grip handle only (no gesture conflict with swipe), pointer-based with live row transforms, drop -> `TasksRepo.reorder(orderedIds)`; keyboard fallback wired to the row menu.
  - `snooze-menu.tsx` — BottomSheet (touch) / Modal (desktop): 4 quick options with target-day preview + inline Ember Calendar for "Scegli data" (min = today).
  - `task-detail.tsx` — detail sheet (BottomSheet/Modal by viewport): title, date (DatePicker), time (TimePicker), priority segmented control, tags editor, flat subtask checklist (add/toggle/remove), notes (Textarea), Elimina with undo. Field-by-field continuous save (no Save button), title/notes commit on blur.
  - `screen-hooks.ts` — `useToday` (minute tick + visibilitychange: the day rolls over even if the tab stays open for days), `useIsDesktop` (SSR-safe matchMedia).
  - `today-section.tsx` — Today's real Task section: compact list, FAB with quick-add sheet, "Tutto fatto per oggi · N" line when done>0, EmptyState ONLY when genuinely empty, quiet "N in ritardo" link (no shame copy), own ToastProvider.
- `app/(app)/tasks/tasks-screen.tsx` + rewritten `tasks/page.tsx` — Ember Tabs views: Oggi (overdue block under "In ritardo · N" with one-tap "Sposta tutte a oggi" + today list reorderable + "Fatte · N"), Prossimi (7-day groups, reorderable within day), Inbox (dateless, reorderable), Fatti (paged 50 + "Carica altri", uncomplete via toggle/menu).
- `_components/icons.tsx` — 7 additive stroke icons (plus, check, clock, trash, dots, grip, chevron).

**Additive data-layer changes (fence-sanctioned, flagged)**

1. `TasksRepo.restore(id)` (ports.ts + local/tasks.ts + 2 tests): "delete with undo" was impossible via the existing port — `update()` cannot touch `deleted_at` and `getById` hides tombstones. `restore` clears the tombstone and bumps `updated_at` so the undo wins LWW over the delete. Idempotent on live rows.
2. Hooks `useTask(id)` and `useDoneTasks(limit)` in `data/hooks.ts` — additive, mirror the existing hook pattern; the repo methods they call were already tested (hooks themselves have no unit tests: that would need a React testing dependency, and this run adds no dependencies).

**Anchored edits (pre-existing files)**

`life-os/vitest.config.ts` (enabling config edit, same class night-01 flagged; required by this prompt's own "testable logic gets tests" mandate for logic living in the fenced `_components/tasks/`):
Before:
```ts
    include: ["lib/**/*.test.ts", "data/**/*.test.ts"],
```
After:
```ts
    include: ["lib/**/*.test.ts", "data/**/*.test.ts", "app/**/*.test.ts"],
```

`life-os/app/(app)/page.tsx` (Today wiring) — import added:
Before:
```tsx
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/ui";
```
After:
```tsx
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/ui";
import { TodayTasks } from "./_components/tasks/today-section";
```
The `SECTIONS` placeholder entry `{ eyebrow: "Task", heading: "Nessun task da mostrare", text: "Arriva con il modulo Task." }` was REMOVED (Agenda/Palestra/Streak stay), and the section render gained the real component:
Before:
```tsx
      {SECTIONS.map((s) => (
```
After:
```tsx
      {/* Sezione Task reale (run-03 prompt 1): port locale, FAB, undo. */}
      <TodayTasks />

      {SECTIONS.map((s) => (
```

`life-os/app/(app)/tasks/page.tsx` — full rewrite from the honest skeleton (title + EmptyState "Il modulo Task non è ancora qui") to a thin server wrapper rendering `<TasksScreen />`; `metadata` preserved byte-identical.

**Decisions taken**

1. **`/tasks` stays public** (as night-01 left it): the brief's "still auth-gated" premise did not match the repo — only `/` is gated, and `proxy.ts` is outside this prompt's fence. No exposure: IndexedDB data belongs to the requesting browser.
2. **ToastProvider mounted per client island** (TasksScreen, TodayTasks), NOT in the group layout: `layout.tsx` is not in this prompt's fence. Prompt 5 (fence: whole `app/(app)/**`) can hoist a single provider if needed.
3. **Chip dismissal key = kind + span text**: dismissing "domani" suppresses that exact text for the current input, a different date text re-chips; duplicate identical fragments share the key (predictable). Dismissals reset when the input is emptied or submitted. Post-dismissal recomputation cannot resurrect a "loser" fragment the parser already discarded (e.g. "domani anzi il 20" with "il 20" dismissed yields NO date, not "domani") — accepted v1 semantics, user always wins.
4. **Swipe only on open tasks and only for `pointerType === "touch"`** with axis lock and 72px trigger; reorder drag starts only from the grip handle; both have menu-based keyboard fallbacks.
5. **Optimistic writes**: quick-add clears the field before the Result lands (text restored on ko); the complete toggle flips locally and rolls back on ko; everything else is liveQuery-truth (a failed Result never writes, so no ghost state is possible).
6. **Time without date is allowed** in payloads (schema permits; the parser can produce it): the task lands in Inbox with its time — honest to what was typed.

**Checks** (all green): lint / tsc / build / test — suite **467 -> 492** (23 logic + 2 restore), 35 files. Dev-server pass: `GET /tasks` 200 with `em-scope`, quick-add, tablist and SSR skeletons in the served HTML, ZERO `<select`/`type="date"`/`type="time"`; `GET /` 307 -> `/login` (proxy untouched); `GET /login` 200. `grep -ri MOCK` over the new/edited surfaces: 0. Fence audit: only fenced paths + the flagged vitest include line + this report.

**Commit:** `feat(tasks): tasks module v1 with NL quick-add, views, swipe/undo/reorder`

---

## Prompt 2 — Guest mode: DONE (checkpoint green, committed)

**What was built**

- `proxy.ts` — the flip (anchored quote below): `/` is no longer protected; ALL legacy prefixes byte-identical; logged-in redirect away from `/login` untouched.
- `app/(app)/page.tsx` (Today) — guest-renders: the `if (!user) redirect("/login")` guard is gone; profile lookup happens only with a user; the guest header carries the quiet line "I tuoi dati vivono su questo dispositivo" linking to the account section (`/impostazioni`); the "Vecchia dashboard" bridge link is now shown to signed-in users only (for a guest it would only bounce off the proxy).
- `app/(app)/impostazioni/page.tsx` (NEW) — the new settings surface (see pre-flight delta 2 for why not `/settings`):
  - guest variant: "Stai usando LifeOS come ospite" + local-data explanation + CTA "Crea un account per sincronizzare" -> `/login`. The sync promise is worded as future ("servirà a"), not as an existing feature.
  - authed variant: email, Esci (REUSES the existing `signOut` server action from `app/dashboard/actions.ts` — no new auth code), and the bridge "Vecchie impostazioni (obiettivi e target)" -> legacy `/settings` so nothing users could reach before is stranded. Nothing fake, no placeholder toggles.
- `app/(app)/_components/app-nav.tsx` — the Rail "Impostazioni" item and the MobileHeader gear now point to `/impostazioni` (active state wired); collision comment updated. The Palestra tab still points to legacy `/gym` (protected): a guest tapping it reaches the login screen — honest until prompt 10 rebuilds gym on the ports.
- `app/login/page.tsx` — one additive escape hatch under the form: "Continua senza account" -> `/` ("i dati restano su questo dispositivo"), styled with the page's own legacy tokens. Nothing else touched on the login surface.

**Anchored edit — `life-os/proxy.ts`**

Before:
```ts
  const path = request.nextUrl.pathname;
  // "/" ora è Oggi (gruppo (app)) e resta protetta fino al guest mode
  // (prompt 07). Match esatto, non prefisso: ogni path inizia con "/".
  const isProtected =
    path === "/" || PROTECTED_PREFIXES.some((p) => path.startsWith(p));
```
After:
```ts
  const path = request.nextUrl.pathname;
  // Guest mode (prompt 07, run-03): le superfici del gruppo (app) — "/",
  // /tasks, /calendar, /stats, /impostazioni — sono pubbliche, coi dati
  // locali al dispositivo. Le rotte legacy restano protette com'erano.
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
```
`PROTECTED_PREFIXES`, `AUTH_ONLY_PREFIXES`, both redirect blocks and the matcher are byte-identical to before.

**Decisions taken**

1. **New settings path = `/impostazioni`** (Italian-first, matches the nav label): `app/(app)/settings/page.tsx` would collide with legacy `/settings` (App Router duplicate-path error), and deleting the legacy page is outside every fence. Prompts 4/5 will add their settings sections here.
2. **Guest hitting Palestra tab -> login** is accepted and documented rather than exposing the legacy Supabase-backed `/gym` page (which the brief forbids: "ALL legacy prefixes stay protected exactly as-is").
3. Signed-in users on legacy routes: zero change (grep-verifiable — no legacy file touched except the additive login link).

**Checks** (all green): lint / tsc / build / test — suite unchanged at **492** (this prompt is routing + two server pages; runtime pass is the verification). Dev-server pass with NO auth cookie: `/` 200 (guest line present, "Vecchia dashboard" ABSENT, task section SSR-skeletons present), `/tasks` 200, `/impostazioni` 200 (guest variant + CTA), `/login` 200 (guest link present); legacy `/finance`, `/settings`, `/dashboard`, `/gym` all 307 -> `/login` (the brief's "302" is Next's 307 in practice, same semantics). Fence audit: proxy.ts + `(app)` + the one additive login-page link + report.

**Commit:** `feat(guest): public (app) surfaces with local-only guest mode`
