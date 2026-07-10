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

---

## Prompt 3 — Auth OTP, code only: DONE (checkpoint green, committed)

**What was built** (code + docs only; the Supabase template flip is Davide's, per `03-activation-checklist.md`)

- `app/login/actions.ts` — rewritten around the same wire contract:
  - `signIn`: the `signInWithOtp` call is UNCHANGED (same `emailRedirectTo` -> `/auth/callback`, so today's magic-link template keeps working end to end). What changed: zod email validation (`z.email()`, replacing the manual non-empty check), rate limit via the existing in-memory limiter (`otp_send:<email>`, 4 per 10 min — aligned with the 60s UI cooldown), success now redirects to the code-entry screen `/login/verify?email=...&sent=1`, and Supabase error strings are replaced by our own Italian copy (audit A4 note: raw `error.message` used to be rendered in the banner).
  - `verifyCode` (NEW): zod-validates email + token (6 digits, whitespace stripped first so "123 456" pasted from the email works), rate limit `otp_verify:<email>` 5 per 15 min, then `supabase.auth.verifyOtp({ email, token, type: "email" })`; success redirects to `/dashboard` (same destination as today's callback); failure redirects back to the verify screen with friendly copy and an attempts-remaining tail when <= 2 remain ("Ti restano N tentativi"), turning into a gentle pause message at the limit. No raw Supabase strings anywhere.
- `app/login/verify/page.tsx` (NEW) — stepped state as a separate URL (state lives in the query string via action redirects: works without JS, survives reload): heading, sent/error banners, hidden email + ONE 6-char code input, "Accedi", the same-device link note, resend, "Torna indietro" -> `/login`.
  - **Input-shape decision (documented per brief):** one single 6-char field with `inputMode="numeric"` + `autocomplete="one-time-code"`, NOT six single-glyph boxes — on iOS a single field is the robust choice (native paste, no focus juggling, system autofill when available). No `maxLength`, so a paste with spaces isn't truncated; the server normalizes.
  - Styled with the login surface's existing legacy tokens (NOT Ember): `/login` is outside the `(app)`/`em-scope` world and visual coherence of the auth flow wins; the flow migrates to Ember when the whole login surface does.
- `app/login/verify/resend-button.tsx` (NEW, client) — visible 60s cooldown; the last-send instant lives in sessionStorage per email so a reload or a failed attempt does NOT reset the countdown; submit reuses the `signIn` action (client cooldown is courtesy, the server rate limit is the enforcement). Renders without seconds until mounted (no hydration text mismatch).
- `app/auth/callback/route.ts` — token_hash branch added BEFORE the existing `code` branch (quoted below); `/auth/confirm` untouched; PKCE and implicit paths byte-identical.
- `app/login/page.tsx` — copy only: subtitle "Sign-in via magic link. Niente password, niente fronzoli." -> "Accesso via email, senza password." and button "Invia magic link" -> "Continua" (both honest BEFORE and AFTER the template flip); `sent`/`error` banner branches left in place (no behavior removed).
- `docs/plans/lifeos-rebuild/03-activation-checklist.md` (NEW) — Davide's dashboard steps: Magic Link template with `{{ .Token }}` ALONGSIDE the link (wording suggestion included, plus the optional `{{ .TokenHash }}` link variant the callback now supports), Redirect URLs + `NEXT_PUBLIC_APP_URL` verification (audit H3/H4), local + prod smoke scripts (cross-device code entry, 60s cooldown, wrong-code x5 gentle lockout, stale-link same-device), and an honest not-included list.

**Anchored edit — `app/auth/callback/route.ts`** (the ONLY change to the file, verified via `git diff`: zod import + schema + this branch):
```ts
  const tokenHash = searchParams.get("token_hash");
  const otpType = OtpTypeSchema.safeParse(searchParams.get("type"));
  if (tokenHash && otpType.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType.data,
    });
    if (error) { /* redirect a /login con copy amichevole */ }
    return NextResponse.redirect(new URL(next, origin));
  }
```
inserted between `const next = safeNext(...)` and the existing `if (!code)` fallthrough. `type` is zod-validated against the Supabase `EmailOtpType` enum before use.

**Pre-flip behavior (important):** with the CURRENT link-only template, submitting an email lands on the code screen but the email carries only the link — the screen says exactly that ("Nell'email c'è anche un link: aprirlo da questo dispositivo ti fa entrare direttamente") and the link path is untouched, so nothing regresses before Davide flips the template.

**Checks** (all green): lint / tsc / build / test — suite unchanged at **492** (auth flow is redirect-driven server actions against live Supabase; per session rule 8 no live-project scripting — verification is the checklist's smoke). Dev-server pass: `/login` 200 ("Continua" button), `/login/verify?email=...` 200 (one-time-code input, cooldown button, sent banner, torna indietro), `/login/verify` without email -> streamed `NEXT_REDIRECT;replace;/login;307` + `url=/login` meta fallback (Next 16 in-band redirect for dynamic pages — functionally a redirect for browsers and no-JS clients). Callback diff = ONLY the added branch. Fence audit: `app/login/**`, `app/auth/callback/route.ts`, checklist doc, report.

**Commit:** `feat(auth): email OTP verify flow + token_hash callback support (template flip pending)`

---

## Prompt 4 — Stats + streak engine: DONE (checkpoint green, committed)

**What was built**

- `data/streak.ts` (NEW, pure, no I/O) — the streak engine:
  - **Semantics**: a day counts if any meaningful action happened (adapter decides the sources: task completed, gym session logged); **protected days bridge but never count** — the streak counts ACTIVE days; **today without activity is pending, not broken** (the chain shown reaches yesterday; `todayCounts` drives the flame dot); `best >= current` by construction.
  - **Timezone**: instant -> civil day through `civilDayInZone` (Intl formatToParts, injected zone, UTC fallback, never throws); ALL day arithmetic is UTC-noon string math (`shiftDay`, `dayRange`) — DST 23/25-hour days are ordinary days by construction.
  - 21 unit tests: normal chains, pending today, gap breaks (current resets, best remembers), single/multi-day protected bridges, protected-tail with pending today, all-protected-no-activity (no invented streak), active+protected same day, historical best with bridges, DST entry/exit day arithmetic and instant conversion (March 23h day, October 25h day), timezone injection (same instant, different civil days), invalid-zone fallback.
- `data/schemas.ts` — `Settings.protected_days: IsoDay[]` (max 730) + patch field. `data/local/settings.ts` — DEFAULT includes `[]`; **merge-on-read normalization** (rows written before the field return complete — no Dexie migration needed for an unindexed field); update sorts + dedupes so readers never defend. 3 new tests incl. legacy-row normalization.
- `data/ports.ts` — StatsRepo gains `streak({today, timeZone})` and `activityDays(from, to, timeZone)` (the port comment already reserved this prompt the right to extend). `data/local/stats.ts` implements both: activity = alive done-tasks (`completed_at` -> civil day in zone) + alive gym-session days (the table exists; it enriches automatically when prompt 10 ships); protected days read from the settings row so live queries re-fire on any of tasks/gym/settings. Scan-based on `completed_at` (unindexed) — the documented personal-scale trade. 5 adapter tests with seeded fixtures and manual counts, incl. the timezone-decides-the-day case and tombstone exclusion.
- `data/hooks.ts` — additive: `useTasksSummary`, `useCompletionByDay`, `useStreak(today, timeZone)`, `useActivityDays`.
- `app/(app)/stats/logic.ts` (pure, 12 tests) — `weekBounds`/`lastSevenDays`/`monthBounds` (leap-February tested), `fillDays` (bars always show 7 slots), `completionPercent` (**null when there is nothing to measure — never a fake 0%**), `bestDay`, `weeklyObservation` (rule-based single sentence, first-match: quiet week / every-day-active / >=80% / one-day-carried / plain count with cared-for singular; a dedicated test asserts NO shame vocabulary in any branch).
- `app/(app)/stats/week-bars.tsx` — hand-rolled SVG (no chart dependency): ghost bar = planned, ember bar = done, per-day counts, 12px mono axis labels, today marked, `role="img"` with an Italian summary; days with zero tasks draw only a baseline tick (no fake bars).
- `app/(app)/stats/month-heat.tsx` — month strip as a Mon-first 7-col grid: solid ember = active, hollow ring = protected, faint = past inactive, outline = future, focus-ring outline = today; aria summary.
- `app/(app)/stats/stats-screen.tsx` + rewritten `stats/page.tsx` — Streak/Record StatCards (flame dot only when `current > 0 && todayCounts`), week ChartFrame (loading/empty/ready states), month ChartFrame with legend and an explanatory caption, and the gym volume frame as a DECLARED empty state ("qui niente numeri finti") until prompt 10; link to the review.
- `app/(app)/stats/review/` — `/stats/review`: last-7-days bars, Chiusi / Completamento / Giorno migliore cards, and the one gentle observation in a quiet card.
- `app/(app)/_components/today-tiles.tsx` + Today wiring — real tiles: task done/total (— when no tasks), streak with flame dot, week completion computed over the ELAPSED week only (Mon -> today: future planned tasks don't deflate today's number — documented choice), gym placeholder tile with honest copy.
- `app/(app)/impostazioni/protected-days.tsx` + page wiring — protected-days management: Ember DatePicker with **min = today** (protected days are marked IN ADVANCE, per the audit's iron rule 2 — retro-protecting the past is deliberately impossible), list with remove, past protected days shown muted at the tail (they did their bridging work), immediate SettingsRepo persistence with toast errors.

**Anchored edit — `app/(app)/page.tsx`** (Today): the `SECTIONS` entry `{ eyebrow: "Streak", heading: "La streak parte da qui", text: "Arriva con il modulo Statistiche." }` REMOVED (Agenda/Palestra remain as honest placeholders for prompts 09/10) and:
Before:
```tsx
      {/* Sezione Task reale (run-03 prompt 1): port locale, FAB, undo. */}
      <TodayTasks />
```
After:
```tsx
      {/* Tile reali (run-03 prompt 4): task oggi, streak, settimana. */}
      <TodayTiles />

      {/* Sezione Task reale (run-03 prompt 1): port locale, FAB, undo. */}
      <TodayTasks />
```
(plus the `TodayTiles` import). `app/(app)/stats/page.tsx`: full rewrite from the night-01 honest skeleton to the thin wrapper around `StatsScreen`; metadata preserved.

**Decisions flagged**

1. **Activity sources v1 = completed tasks + gym sessions** (both tables exist; events are a later enrichment per the brief's own note). Adding gym now costs nothing and makes prompt 10 count automatically.
2. **Per-tag counts SKIPPED**: the brief says "if cheap from indexes" — tags are not indexed (`SCHEMA_V1`), so honestly: not cheap, not built.
3. **One existing test updated**: `data/schemas.test.ts` settings fixture gained `protected_days: []` (the field is required on the row schema) — behavioral assertions unchanged.

**Checks** (all green): lint / tsc / build / test — suite **492 -> 533** (21 streak + 5 stats adapter + 3 settings + 12 stats logic). Dev-server: `/stats` 200, `/stats/review` 200, Today serves the tiles section (aria "Statistiche di oggi") with the honest gym placeholder, `/impostazioni` serves "Giorni protetti"; `grep -ri MOCK` over every touched surface: 0. Fence audit: `app/(app)/stats/**`, Today page + `_components/**`, `data/**`, the `/impostazioni` settings area (the adapted `app/(app)/settings` fence per pre-flight delta 2), report.

**Commit:** `feat(stats): streak engine with protected days, real Today tiles, stats + weekly review`

---

## Prompt 5 — Reminders v1: DONE (checkpoint green, committed)

**What was built**

- `lib/reminders/` (NEW, pure, injected clocks/timers/zones — 23 tests):
  - `time.ts` — the civil-time bridge: `zonedTimeToInstant` (two-pass offset resolution; DST spring-gap wall times degrade by one hour without throwing, October ambiguity resolves to a valid instant — both tested), `instantToHhmm`, reminder presets (`at_time` / `before_10m` / `before_1h` / `morning` 08:00) with `computeFireAt` (null when requirements are missing) and `derivePreset` (exact-match recognition, null for custom/stale offsets).
  - `scheduler.ts` — the `RemindersScheduler` INTERFACE (push-ready per B3.4: prompt 17 can implement the same contract server-driven) + `createInAppScheduler`: ONE foreground interval (30s default), immediate tick on start and on visibility return; `markFired` BEFORE delivery and pending-excludes-fired make a reminder fire exactly once (a `markFired` ko = handled elsewhere = no delivery); age-based classification splits `live` (toast+sound) from `catchup` ("mentre eri via", no toast burst), threshold injectable. Fake-timer tests: fires once never twice, old ones go to catchup, future fires via the interval at its time, stop/idempotent start, ko-exclusion, custom threshold.
  - `ics.ts` — per-task .ics: CRLF everywhere, RFC 5545 TEXT escaping (backslash/semicolon/comma/newline), 74-char line folding (longest physical line <= 75 verified in test), `DTSTART;TZID=Europe/Rome` with a static VTIMEZONE (EU last-Sunday rules), VALARM DISPLAY with the app reminder's relative offset (`-PT10M`, `-PT1H30M` composite tested) or `PT0S` without one, DTEND = start+30min (a task is a point; half an hour is the smallest readable calendar block), non-Rome zones degrade to absolute UTC instants (never a TZID without definition). 6 snapshot-style tests with byte-exact expected output.
- Port additions (flagged): `RemindersRepo.listByRef(refId)` (detail sheet) and `listFiredUndismissed()` (the "Mentre eri via" card + badge source of truth — surviving reload by construction, no in-memory store), both implemented + tested (2 tests).
- Hooks (additive): `useTaskReminder`, `useFiredReminders`, `useUpcomingReminders` — the latter two join the task row for titles (`ReminderWithTask`).
- `app/(app)/_components/reminders-host.tsx` — mounts the scheduler for the whole shell (in the group layout): live delivery = Toast "Promemoria: <titolo>" (8s, Ok = dismiss) + one short WebAudio chime per batch (autoplay-suspended contexts give up silently — enhancement, the toast is the real delivery) + Badging API count (guarded, `.catch`-safed); orphan reminders (task deleted) are auto-dismissed instead of shown; the toast context rides in a ref so scheduler never restarts on re-render.
- `app/(app)/_components/reminders-cards.tsx` — `WhileAwayCard` (fired-unacknowledged with per-item Ok and "Segna tutti letti") and `UpcomingReminders` (next 24h, max 4, minute-advancing window, honest closing line "Suonano finché l'app è aperta"). Both render NOTHING when empty — no empty cards.
- Task detail sheet — "Promemoria" Field (Ember Select: Nessuno + 4 presets, time-dependent options disabled without an orario, morning without a data; an underivable stored fire_at shows as a descriptive "Personalizzato · <giorno> <ora>" entry), and **preset-follow**: changing the task's date/time recomputes the reminder when its offset is a recognizable preset (requirements gone -> the reminder decays visibly); custom offsets are never touched. "Esporta su Calendario" ghost button (date+time tasks) downloads the .ics via Blob.
- `app/(app)/impostazioni/page.tsx` — the truth panel (B2.2 honesty): App aperta / Al ritorno / App chiusa ("il web non può suonare da solo: per promemoria garantiti usa Esporta su Calendario").
- Today page — `WhileAwayCard` above the task section, `UpcomingReminders` rail below it.

**Anchored edit — `app/(app)/layout.tsx`** (night-01 file): the shell subtree is now wrapped in ONE `ToastProvider` with `RemindersHost` mounted inside (quoted: `<ToastProvider>` around Rail/MobileHeader/main/TabBar + `<RemindersHost />` before closing). Consequently the per-island providers from prompts 1/2/4 (TasksScreen, TodayTasks, ProtectedDays) were REMOVED — one toast stack for modules and reminders alike.

**Semantics worth knowing (documented, tested where testable)**

1. A reminder that fires while the toast goes unseen is NOT lost: it stays in "Mentre eri via" until acknowledged (fired-undismissed is the queue, dismiss is the acknowledgment; the port's `update(fire_at)` re-arms a reminder by design — adapter comment).
2. Two open tabs could each deliver the same reminder once (both read pending before either stamps) — accepted v1 edge for a single-user local app, noted here.
3. The rail and the card render null when empty (the acceptance's "Today renders the rail" = the components are mounted and appear as soon as a reminder exists; served-HTML shows them only with data — honesty beats markup).

**Checks** (all green): lint / tsc / build / test — suite **533 -> 558** (11 time + 6 scheduler + 6 ics + 2 adapter). Dev-server: `/` 200 (host mounted, cards honest-empty), `/impostazioni` serves the truth panel ("Promemoria e notifiche", "Esporta su Calendario"), `/tasks` still zero native controls. Fence audit: `data/**`, `lib/reminders/**`, `app/(app)/**`, report.

**Commit:** `feat(reminders): in-app scheduler with catch-up, task reminders, ics export`

---

## Run 03 — Closing summary

All FIVE prompts completed, each checkpoint green, each committed on `feat/run-03`. Nothing pushed, nothing merged, `main` untouched. Final tree re-verified after the last commit: lint / tsc / build / test all green, `git status` clean.

**Test counts:** baseline **467** (34 files) -> final **558** (41 files), all passing. Delta per prompt: +25 (tasks: 23 UI logic + 2 restore), +0 (guest: routing verified at runtime), +0 (auth: redirect-driven server actions, smoke via checklist), +41 (stats: 21 streak engine + 5 adapter + 3 settings + 12 screen logic), +25 (reminders: 11 time + 6 scheduler + 6 ics + 2 adapter).

**Commit log of `feat/run-03`** (review surface, oldest first):

1. `29a196b` — `feat(tasks): tasks module v1 with NL quick-add, views, swipe/undo/reorder`
2. `2121aa9` — `feat(guest): public (app) surfaces with local-only guest mode`
3. `756adec` — `feat(auth): email OTP verify flow + token_hash callback support (template flip pending)`
4. `ce7f67e` — `feat(stats): streak engine with protected days, real Today tiles, stats + weekly review`
5. `e114b55` — `feat(reminders): in-app scheduler with catch-up, task reminders, ics export`

**Anchored edits to pre-existing files** (full before/after quotes live in each prompt's section above):

- `proxy.ts` — the guest flip: `path === "/" ||` removed; prefix list byte-identical (Prompt 2 section).
- `app/auth/callback/route.ts` — ONLY the token_hash+type branch added before the PKCE branch, `git diff`-verified (Prompt 3 section).
- `app/login/actions.ts` — `signInWithOtp` call unchanged; zod validation + rate limits + success -> `/login/verify` (Prompt 3 section).
- `app/(app)/page.tsx` — evolved across three prompts: Task placeholder section -> `<TodayTasks />`; guest render (no redirect, guest line, conditional bridge link); Streak placeholder -> `<TodayTiles />`; reminders cards added (Prompts 1/2/4/5 sections).
- `app/(app)/layout.tsx` — single `ToastProvider` + `RemindersHost` (Prompt 5 section).
- `app/(app)/tasks/page.tsx`, `app/(app)/stats/page.tsx` — skeleton -> thin wrappers over the real screens.
- `vitest.config.ts` — include gained `app/**/*.test.ts` (enabling edit, flagged; Prompt 1 section).
- One test fixture updated: `data/schemas.test.ts` settings base + `protected_days: []`.

**Additive data-layer surface** (all flagged in their sections, all tested): `TasksRepo.restore`; `StatsRepo.streak` + `activityDays`; `RemindersRepo.listByRef` + `listFiredUndismissed`; `Settings.protected_days`; `data/streak.ts` module; hooks `useTask`, `useDoneTasks`, `useTasksSummary`, `useCompletionByDay`, `useStreak`, `useActivityDays`, `useTaskReminder`, `useFiredReminders`, `useUpcomingReminders`.

---

## Davide's Gate 1 checklist

**1. Review + merge** (your gate, not mine):

```
git checkout main
git merge --no-ff feat/run-03
```

**2. Single-device smoke list** (dev server or deployed, one pass on the iPhone):

- `/dev/ui` — component playground still intact.
- Shell: tab bar safe-area, rail on desktop, gear -> Impostazioni (nuova), Palestra tab -> legacy gym (login se ospite: atteso).
- Tasks, airplane mode ON: quick-add "domani alle 18 spesa #casa !!" -> chips giusti, dismissal di un chip, submit; completa con swipe destro; undo dal toast; swipe sinistro -> snooze a domani; elimina + Annulla; drag della maniglia per riordinare; scheda dettaglio: sottotask, tag, note; reload -> tutto ancora lì (IndexedDB).
- Guest run: finestra in incognito -> `/` = Oggi ospite con la riga sui dati locali, task utilizzabili, `/finance` -> login, `/impostazioni` = variante ospite con CTA.
- Stats: chiudi 1-2 task -> tile "Task oggi" e streak si muovono; `/stats` barre e strip; `/stats/review` osservazione; proteggi un giorno futuro in Impostazioni e verifica la strip.
- Reminders: task con orario tra 2 minuti + promemoria "All'orario del task" -> rail "Prossimi" su Oggi; aspetta il toast (app aperta); poi metti l'app in background prima di uno scatto e rientra -> card "Mentre eri via"; "Esporta su Calendario" -> l'ics si apre in Calendario iOS con l'allarme giusto.

**3. OTP activation** — follow `docs/plans/lifeos-rebuild/03-activation-checklist.md` (Supabase template with `{{ .Token }}`, Redirect URLs, smoke incl. wrong-code x5 and cross-device code entry). Until you flip the template, login works exactly as before via the link (the code screen says so).

**4. Open decision one-liners (D3-D7)** — unchanged, still yours:

- **D3** repo root move: parked for prompt 16.
- **D4** legacy fates: Palestra tab still points at legacy `/gym` until prompt 10; legacy `/settings` reachable from the new Impostazioni.
- **D5** light theme: tokens exist; no switcher yet (prompt 14).
- **D6** Supabase topology: one project vs two — matters before sync (prompt 08).
- **D7** AI features: untouched, still key-gated on legacy surfaces.

---

## Deliberately NOT done (scope fences)

- **Sync / guest->account migration** (prompt 08): guests AND account holders currently keep new-module data local to the device; the Impostazioni copy says exactly that.
- **Calendar** (09), **Gym** (10): placeholders on Today remain honest EmptyStates; gym sessions already count toward the streak the day the module lands.
- **PWA/service worker** (13), push (17), comfort wave (14), legacy ports (15), repo-root move (16).
- No dependencies added anywhere in this run. No Supabase dashboard changes performed (documented for Davide instead). Nothing pushed or merged.

**Run 04 candidates** (by value): 08-sync-migration (the accounts promise), then 09-calendar or 10-gym (Today has two placeholder sections waiting), 13-pwa-offline to make the guest/local story installable.
