# LifeOS — Rebuild Blueprint (Session 00)

Date: 2026-07-09
Author: Claude (Fable 5), from the audit in `00-audit.md`
Status: master design document for the rebuild. Each implementation prompt
(`02-*.md` onward) is finalized from this file without re-auditing.

Naming note: "LifeOS" is the working title used throughout; renaming is a
find-and-replace decision, not an architectural one.

---

## B6 (placed first). Decision points for Davide

Choices only you can make. Everything else in this document proceeds without you.

| # | Decision | My one-line recommendation |
| --- | --- | --- |
| D1 | Auth method | Replace magic link with 6-digit email OTP as the primary path (cross-device by nature, immune to link prefetchers and the PWA cookie-jar split); keep the magic link as a secondary same-device convenience. |
| D2 | Notification channels | v1: in-app reminders only (honest baseline). v2: Web Push for account holders with the PWA installed (iOS 16.4+), plus an optional morning email digest. Never promise scheduled local notifications without a server — the web platform cannot do them. |
| D3 | Repo layout | Move the app from `life-os/` to the repository root in the cleanup phase (fixes dead CI, Vercel root ambiguity). Low risk, one-time disruption to open PRs (there are none). |
| D4 | Legacy modules' fate | Keep Tasks/Gym/Calendar/Stats/Settings as the rebuilt core. Port Esami, Finance (expenses only, drop the legacy `finance_entries` model), and Sera in a later wave. Business/Chameleon, Custom modules, Commute, and Overseer chat: keep the old routes alive untouched until you explicitly retire or port them. |
| D5 | Light mode | Ship both themes from the foundation (tokens make it cheap); dark remains the default. Decide only if you want to *force* dark-only. |
| D6 | Supabase topology | One shared Supabase project for you and Daniele (RLS already isolates users); per-person projects double every ops task. You currently have per-person projects — consolidating means one of you re-registers and migrates rows. |
| D7 | Anthropic features | Keep Today's Call + Overseer as optional (key-gated) — recommendation: keep, they degrade gracefully; but the rebuilt dashboard must be fully useful without them. |

---

## B1. Product target

LifeOS is a personal life dashboard for two power users first (Davide, Daniele),
built to a standard where showing it to anyone is not embarrassing. Core
principles, non-negotiable:

1. **Guest-first.** The app is fully usable with zero signup. All module data
   persists locally in IndexedDB behind a storage abstraction. Creating an
   account is optional and unlocks sync/backup across devices. When a guest
   creates an account, local data migrates into the account seamlessly — no
   data loss, no re-entry, no "import" chore. Corollary: the app is
   local-first for everyone; the network is an enhancement, not a dependency.
   (Today the app is the opposite: nothing works without login — audit A3.)
2. **Dashboard-first.** Opening the app lands on **Today**: date, daily stats,
   today's tasks and agenda, today's workout, streaks, and a prominent
   quick-add. The most important information of the day in one glance,
   composed top-to-bottom by urgency. Mobile-first; the phone on the kitchen
   table is the primary device.
3. **Modules:** Tasks (smart), Gym, Calendar/Planning, Stats/Insights,
   Settings. Legacy modules (Esami, Finance, Sera, Custom, Business, Overseer)
   stay reachable during the rebuild and are ported or retired per D4.
4. **Italian-first.** All copy in Italian; natural-language parsing targets
   Italian. No i18n framework — but user-facing strings live in one module per
   feature so a future translation is mechanical, not archaeological.
5. **Honesty of state.** Nothing on screen is fake: no mock numbers, no
   placeholder cards that pretend to be features (audit found both). If a
   module has no data, it says so beautifully; if a capability is impossible
   (offline push), the UI never implies otherwise.

Non-goals for the rebuild: multi-tenant SaaS features (teams, sharing,
billing), realtime collaboration, native apps, CRDT-grade sync. These are
explicitly out to protect scope.

---

## B2. Feature specification

Tagging: `v1` = rebuild core (prompts 02-13), `v2` = second wave (14+),
`later` = parked with a design note. Ideas marked (best-in-class: X) are
imported from the strongest products in each category — Things 3, Todoist,
TickTick, Fantastical, Hevy, Strong, Apple Fitness, Whoop, Linear.

### B2.1 Smart Tasks

The centerpiece. Replaces the dead state-machine generator (audit A5) with a
direct, fast, personal task system.

**Capture**
- v1 — Single quick-add input on Today and on /tasks, opened by the FAB, the
  `n` shortcut, or focusing the persistent field. One line creates a task.
- v1 — Natural-language parsing, Italian-first (best-in-class: Todoist):
  - dates: "domani", "dopodomani", "lunedì"/"lun", "tra 3 giorni", "il 15",
    "15/08", "fine mese", "stasera", "weekend"
  - times: "18:30", "alle 7", "18.30", "h 18"
  - priorities: "!" / "!!" / "!!!" mapped to P3/P2/P1
  - tags: "#spesa", "#uni"
  - module routing: "palestra ..." can suggest the Gym module chip
  - Parsed fragments highlight inline as recognized chips (date, time, tag,
    priority) BEFORE submit, each dismissible with one tap — the user always
    wins over the parser (best-in-class: Fantastical's parse preview).
  - Parser is a pure, unit-tested library (`lib/nlp-it`), no LLM dependency;
    an optional LLM fallback for ambiguous phrases is `later`.
- v2 — Voice capture via Web Speech API where available.
- later — Email-to-inbox, share-sheet capture.

**Model**
- v1 — Task: id (client UUID), title, notes, date (day-granular), time
  (optional), priority (P1-P3, default none), tags[], module link (optional:
  gym session, exam, event), status, completed_at, created_at, recurrence
  (v2), subtasks[] (v1: flat checklist), sort_order.
- v1 — Views: Today (due + overdue rolled in, visually separated), Upcoming
  (7-day strip), Inbox (dateless), Done (paged archive).
- v2 — Recurrence ("ogni lunedì", "ogni giorno") with completion-based or
  schedule-based repeat, Italian NL forms parsed.
- later — Dependencies, durations/time-blocking, calendar drag-to-slot.

**Interaction**
- v1 — Swipe right to complete, swipe left for date snooze menu (touch);
  hover reveals the same actions on desktop. Large 44px+ hit areas.
- v1 — Every destructive or completing action gets an undo toast (5s), no
  confirm dialogs for reversible things (best-in-class: Things 3).
- v1 — Drag to reorder within a day; drag onto a day header in Upcoming to
  reschedule (desktop); on touch, the snooze menu covers rescheduling.
- v1 — Overdue tasks auto-surface on Today under an "In ritardo" divider with
  one-tap "sposta a oggi" bulk action (no shame copy — audit iron rule 3
  survives the rebuild).
- v2 — Multi-select with bulk actions; keyboard-first triage (j/k/x/d).

**Why not keep the state-machine generator?** It generated hardcoded personal
tasks in five fixed "states" and is dead code today. The concept it served —
"the app adapts the day's load" — returns leaner as: templates ("routine
mattina" one-tap inserts a checklist) `v2`, and load hints from Stats `later`.
The user_states concept (Esami/Recupero/etc.) is retired from Tasks and
becomes an optional Stats annotation `later`.

### B2.2 Reminders and notifications (honest analysis)

Platform truths (stated plainly, they shape everything):
- Scheduled local notifications from a web page WITHOUT a server are not
  possible: the Notification Triggers API is dead, `setTimeout` dies with the
  tab, and service workers cannot self-wake on a timer.
- Web Push works on iOS ONLY when the app is installed to the home screen
  (iOS 16.4+), and requires: a service worker, a VAPID keypair, a subscriptions
  store, and a server-side sender. Delivery is best-effort.
- Push subscriptions can exist without an account, but scheduling a reminder
  requires the server to know when to fire it — so "guest + push" would leak
  reminder content/times to the server without an account contract. We choose
  not to do that.

Strategy (recommendation for D2):
- v1 — **In-app reminders**: tasks with a time show in a Today "prossimi"
  rail; when the app is open at fire time, a toast + optional sound + app
  badge (Badging API where supported). Plus a visible "quiet truth" line in
  Settings explaining exactly when LifeOS can and cannot notify.
- v1 — **.ics escape hatch**: any task with date+time exports to the system
  calendar in two taps — delegating hard-guarantee alarms to the OS calendar,
  which is allowed to do what the web cannot (best-in-class: pragmatism over
  promises).
- v2 — **Web Push for account holders** with the PWA installed: reminders at
  task time, morning brief ("3 task, allenamento Gambe, 2 eventi"), streak
  save-window ping. Sender: Supabase Edge Function on a 1-minute cron reading
  due reminders; VAPID keys in project env. Explicit per-category opt-in.
- v2 — **Email fallback** (account): morning digest as plain, fast HTML.
- later — Quiet hours, per-module channels, snooze from the notification.

### B2.3 Gym

Replace the single-blob "session with muscle groups" logger with a real
training log (best-in-class: Hevy, Strong), while keeping its one honest
insight: most days you just want to record that you trained.

- v1 — **Exercise library**: seeded Italian catalog (~80 exercises, grouped by
  pattern/muscle), user-extensible, per-exercise default rest time and note.
- v1 — **Workout plans**: named templates (giorno A/B, Push/Pull/Legs) as
  ordered exercise lists with target sets x reps.
- v1 — **Session logging**: start from plan or empty; per-set weight x reps
  entry with steppers tuned for a sweaty thumb (large targets, +2.5kg
  increments, duplicate-last-set); rest timer auto-starts on set completion
  (in-app timer with elapsed-time correctness in background tabs; a push/audio
  cue only when the platform allows); session notes; finish screen with
  volume, duration, PRs hit.
- v1 — **Progress**: per-exercise history sparkline, est. 1RM (keep the
  existing tested Brzycki lib — `lib/fitness.ts` survives), personal records
  (max weight, max volume, max reps) computed from sets, not cached.
- v1 — **History**: calendar heat strip + session list; edit past sessions.
- v2 — Plate calculator, supersets, per-set RPE, body-weight log integration
  (folds the old /body page's purpose in), rest-day scheduling with streak
  awareness.
- later — Apple Health/Google Fit import, wearable data, AI form notes.

Data migration: existing `gym_sessions` rows (day, muscle groups, duration,
notes) import as "sessione semplice" entries without sets; legacy
`gym_workouts` rows (exercise, weight, reps) import as single-set history so
old PRs keep meaning. Both covered in the sync/migration prompt.

### B2.4 Calendar / Planning

- v1 — **Month view + week strip** built on the custom Calendar component (no
  native pickers anywhere): month grid with event/task density dots; tapping a
  day opens its agenda; week strip on Today.
- v1 — **Local events**: title, date, start/end time, all-day flag, notes.
  Quick-add shares the Italian NL parser ("cena con Marco ven 20:30").
- v1 — **Unified agenda**: local events + tasks with times + Google events in
  one day timeline, source-badged. Google events stay read-only.
- v1 — **Google Calendar**: keep the existing integration exactly as audited
  (it is the best code in the repo): OAuth, encrypted tokens, manual sync;
  port the UI, fix the render-time INSERT and the multi-account `.maybeSingle()`
  hazards (audit A2).
- v2 — Auto-sync on app focus + background revalidation; multiple Google
  calendars selection; drag tasks onto times (time-blocking lite).
- later — CalDAV/iCloud, write-back to Google, shared calendars.

### B2.5 Stats / Insights

- v1 — **Today tiles**: tasks done/total, streak flame with protected-day
  state, week completion %, gym week volume — real queries on the storage
  port, never cached mocks (the audit's central lesson).
- v1 — **Streaks**: one honest daily streak (any meaningful action keeps it:
  completing a task, logging a workout, adding an event), with the old
  system's one great idea preserved: **protected days** (rest/vacation marked
  in advance never break the chain — audit iron rule 2).
- v1 — **Weekly review**: a Sunday-evening screen: 7-day completion bars,
  gym sessions, best day, one gentle observation string (rule-based).
- v2 — Trends over months, per-tag/module breakdowns, correlations
  (sleep x completion — port the existing detector library `lib/insights/compute.ts`
  which is decent code today), CSV/JSON export.
- later — LLM-written weekly narrative (key-gated), goal tracking against
  monthly targets (port of `user_monthly_targets`).

### B2.6 Settings

- v1 — Profile (display name), theme (dark/light/system per D5), account
  section (guest: "create account to sync" CTA + explanation; account:
  email, sign out, delete account), data (export JSON, import, erase local),
  notifications truth panel, about.
- v2 — Module manager (enable/disable modules, reorder Today), Google
  connection management (port), tag manager.

### B2.7 Comfort layer (evaluated, prioritized)

- v1 — **PWA installability**: manifest + icons already exist; add proper
  install prompts and iOS "add to home" coaching screen.
- v1 — **Offline-first behavior**: reads/writes hit IndexedDB, so the app
  works offline by construction; service worker for app-shell caching arrives
  in the PWA prompt (12) — before that, offline works once loaded.
- v1 — **Dark mode**: both themes from day one via tokens; system-follow.
- v1 — **Skeleton loading** for every async surface + **considered empty
  states** (illustration-free, copy-first, one action) — the audit shows empty
  states are already a strength to preserve.
- v1 — **Large touch targets** (44px floor) + haptic-friendly interactions
  (visual press states everywhere; `navigator.vibrate` where supported, off on
  iOS Safari which does not support it — never a load-bearing signal).
- v2 — **Command palette** (cmd+k): navigate, quick-add, toggle theme; shell
  component ships in the foundation, wiring in prompt 14.
- v2 — **Keyboard shortcuts**: n (new), g t / g c / g g (go to), x
  (complete), cmd+k (palette); discoverable via "?" overlay.
- later — Home-screen widgets (impossible on web today; document as such),
  Shortcuts/Siri integration via URL schemes, wake-lock for gym rest timer.

---

## B3. Architecture decisions

Format per decision: current state -> target -> migration path -> risk.

### B3.1 Storage abstraction (the load-bearing decision)

- **Current:** every page and server action calls `supabase.from("...")`
  directly (60+ call sites); data exists only server-side; nothing works
  logged out (audit A3). Rendering is RSC-first.
- **Target:** a **repository port** per entity (`TasksRepo`, `EventsRepo`,
  `GymRepo`, `StatsRepo`, ...) defined as plain TypeScript interfaces in
  `src/data/ports.ts`, with two adapters:
  1. `local/` — IndexedDB via **Dexie** (the one new runtime dependency this
     architecture asks for; hand-rolling IndexedDB is where side projects go
     to die). All entities keyed by client-generated UUIDv7 (sortable), rows
     carry `updated_at` + `deleted_at` (tombstones) from day one so sync can
     be added without a second migration.
  2. `synced/` — the same interfaces backed by local Dexie AS the read/write
     path, plus a background **sync engine** mirroring to Supabase
     (push-on-change, pull-on-focus/interval, last-write-wins per row via
     `updated_at`, tombstone deletes). Local is always the source of truth
     for the UI; the network is asynchronous.
  Consequence: module UIs become client components reading the port via
  a thin hook layer (`useTasks(day)` etc. — live queries via Dexie's
  liveQuery). RSC remains for shell, auth surfaces, legacy routes, and API
  routes (AI, push send, Google OAuth).
- **Migration path:** build ports + local adapter (prompt 04) with zero UI;
  new modules consume ports from birth; sync engine + Supabase adapter in
  prompt 08; legacy routes keep their direct Supabase calls until each is
  ported or retired (D4).
- **Risk: high** (it is the rebuild's spine — hence early, isolated, and
  heavily unit-tested; LWW conflicts are acceptable for a single-person-
  per-account product).

### B3.2 Guest -> account data migration

- **Current:** no guests, so no migration (audit A3).
- **Target:** on first successful sign-in from a device with local data: all
  local rows upsert to Supabase under the new `user_id` (client UUIDs make
  this collision-free), then the sync engine takes over; the local DB is NOT
  wiped — it becomes the synced cache. If the account ALREADY has server data
  (second device), plain merge by UUID + LWW; a one-screen summary ("importati
  42 task, 3 allenamenti") confirms nothing was lost. Sign-out on a shared
  device offers "mantieni i dati locali" vs "svuota questo dispositivo".
- **Migration path:** ships inside prompt 08 with an integration test
  (guest-create -> login -> verify server rows -> second device pull).
- **Risk: medium** (bounded by UUID keys and tombstones; the dangerous
  variant — re-keying integer IDs — is designed out).

### B3.3 Auth — DECISION POINT D1

- **Current:** Supabase magic link (PKCE) with a Route Handler exchange and an
  implicit-flow fallback; works same-device, fragile cross-context: PKCE
  verifier cookie mismatch in other browsers/devices, iOS PWA cookie-jar
  split, prefetcher link consumption (audit A4, H1/H2).
- **Target (recommended):** **6-digit email OTP** as the primary flow:
  `signInWithOtp` with a code-style template, verified via
  `verifyOtp({ email, token, type: "email" })` — the code is typed into
  whatever context the user is in, so PKCE context, cookie jars, and link
  scanners all become irrelevant. Keep the magic link in the same email as a
  same-device convenience; keep `/auth/confirm` for legacy links. Add
  `token_hash` handling to `/auth/callback` regardless (closes H5). Passkeys:
  `later` (delightful but adds a recovery story we do not need at n=2).
- **Migration path:** prompt 03; pure addition + template change in the
  Supabase dashboard (documented in the prompt); existing sessions unaffected.
- **Risk: low** (server-verified flow; the failure modes it replaces are the
  ones currently burning the team).

### B3.4 Notification infrastructure — DECISION POINT D2

- **Current:** none of any kind.
- **Target:** per B2.2 — v1 in-app engine (a `RemindersScheduler` interface so
  the UI does not care who fires it) + .ics export; v2 Web Push: service
  worker `push` handler, VAPID keys, `push_subscriptions` table
  (account-scoped, RLS), Supabase Edge Function cron sender reading due
  reminders from synced tasks. Email digest via the same cron.
- **Migration path:** interface in prompt 12's scope note, in-app v1 in
  prompt 12, push in a v2 prompt after PWA (13) proves the service worker.
- **Risk: medium** (push debugging on iOS is slow; contained by shipping
  in-app first and treating push as additive).

### B3.5 Routing and layout structure

- **Current:** flat route-per-module, every module protected, `/` redirects
  to `/dashboard` which renders mocks; `max-w-md` strip on all screens; no
  per-route loading/error boundaries (audit A2/A6).
- **Target:**
  - `/` = Today (guest-accessible), `/tasks`, `/calendar`, `/gym`, `/stats`,
    `/settings`, `/dev/ui` (playground, dev-only) — all new surfaces under a
    `(app)` route group with a shared shell: bottom tab bar (5 slots) on
    mobile, left rail on md+ screens (the desktop-wasteland fix), per-group
    `loading.tsx`/`error.tsx`.
  - Legacy routes (`/dashboard`, `/gym-old` alias if needed, `/finance`,
    `/esami`, `/sera`, `/agenda`, `/business`, `/custom`, `/more`, ...) keep
    working untouched under a `(legacy)` group until ported/retired; a small
    "beta" switcher link bridges old and new during the transition.
  - `proxy.ts` flips from allowlist-protected-by-default-nothing to: new
    surfaces public (guest), legacy surfaces still auth-required, auth pages
    redirect-if-logged-in. Session refresh logic stays.
- **Migration path:** prompt 05 builds the shell + Today skeleton; each
  module prompt fills a tab; a final prompt retires `(legacy)`.
- **Risk: low-medium** (additive routing; the proxy change is the only
  shared-surface edit and is trivially testable).

### B3.6 Survival of existing real data

- **Current:** real personal data presumably lives in two live Supabase
  projects (gym_sessions, gym_workouts, personal_expenses/finance_entries,
  exams, evening_checkins, custom modules, events, Google tokens) plus diary
  markdown files in Google Drive. Volume: two users, months of use — small.
- **Target:** nothing is dropped. The rebuild adds tables (new-shape tasks,
  events, exercises, plans, reminders, push subscriptions) via additive
  migrations 0019+; old tables stay read-only sources; per-module importers
  run inside the module prompts (gym importer in 10, calendar/agenda in 09).
  Old `daily_tasks` engine rows are historical noise: kept in DB, surfaced
  only through the legacy dashboard until retirement, not imported.
- **Risk: low** (additive-only; importers are idempotent and testable).

### B3.7 Error handling, validation, and action conventions (new standard)

- **Current:** three regimes (silent, throw, typed slugs) and split-brain
  validation (zod in two modules, hand-rolled elsewhere) — audit A6.
- **Target:** every mutation returns `Result<T> = { ok: true, data } |
  { ok: false, error: { code, message } }`; UI surfaces failures via the
  Toast system and inline field errors; zod schemas at every boundary
  (form, storage port, API route, localStorage) in `src/data/schemas.ts`;
  no silent catch anywhere (lint rule).
- **Migration path:** conventions land with the foundation (02-04) and are
  enforced in every subsequent prompt's acceptance criteria.
- **Risk: low.**

### B3.8 Repo layout, CI, and quality gates — DECISION POINT D3

- **Current:** app nested in `life-os/` under the git root, so the committed
  GitHub Actions workflow never runs; `.DS_Store` tracked; no typecheck
  script; tests exist for lib logic only (audit Pre-flight/A1).
- **Target:** app at repo root; CI at `.github/workflows/ci.yml` running
  lint + `tsc --noEmit` + vitest + build on PRs; add `typecheck` npm script;
  Playwright smoke pack `later`.
- **Migration path:** dedicated cleanup prompt (16) — a pure `git mv` wave,
  zero code edits, done last so history churn does not pollute feature diffs.
- **Risk: low** (mechanical; Vercel project setting update documented in the
  prompt).

### B3.9 AI features (Today's Call, Overseer)

- **Current:** Overseer chat works (key-gated, rate-limited); the real
  Today's Call path is dead code; model IDs half-pinned (audit A5/A8).
- **Target (per D7):** keep both as progressive enhancements: Today's Call
  v2 becomes a one-line daily note on Today fed by REAL stats via the storage
  port; Overseer persists as-is on legacy shell, ported to the new shell in a
  v2 prompt; model IDs pinned to dated snapshots in one place.
- **Risk: low.**

---

## B4. Design system — "Ember"

### Direction and rationale

LifeOS is a private instrument you open twenty times a day, half of them on a
phone before 9am. The design language, named **Ember**, evolves what the
current app already got right — instrument-panel mono labels, a living glow,
calm dark surfaces — and fixes what it got wrong: pure-black flatness, a
single acid-orange accent doing every job (the exact "near-black + one acid
accent" template look we are told to avoid), 10px type, and no light theme.
Ember keeps the flame metaphor (streaks, energy, "keeping the chain") but
matures it: blue-graphite grounds instead of #000, a warm ember accent
reserved for life and progress only, desaturated semantic hues so the UI is
never a traffic light, a characterful grotesque for display numbers, and a
lime-plaster light theme for daylight use — deliberately not the cream+serif+
terracotta cliché.

### Core palette (5 named values)

| Token | Hex | Role |
| --- | --- | --- |
| `ink` | `#15171C` | Dark-theme ground; light-theme text. Blue-graphite, never pure black. |
| `calce` | `#F4F3EF` | Light-theme ground; dark-theme text (near-white with warmth). Named for lime plaster. |
| `ember` | `#FF6B35` | THE accent. Life, progress, "now": streak flame, active states, primary actions, the signature dot. |
| `salvia` | `#6FA96F` | Success/positive, desaturated sage — calm, not neon. |
| `segnale` | `#E5484D` | Danger/destructive only. Errors, delete, broken states. |

Derived tokens (defined once in CSS, both themes): surface, surface-raised,
hairline borders, three text tiers, `ember-deep #C24914` (accent-on-light
text-safe variant), tint/edge translucent variants generated with
`color-mix(...)` — replacing the current file's 30 hand-hardcoded hex tints.
Info/link color derives from ink tiers, not a sixth hue: fewer colors, used
harder.

### Typography

| Slot | Face | Usage |
| --- | --- | --- |
| Display | **Bricolage Grotesque** (variable, via `next/font`) | Screen titles, hero numbers, big dates. Weight 600-750. Gives data a voice; not in any default stack. |
| Body | **Geist Sans** (already in the app) | Everything readable. 400/500/600. |
| Data/label | **Geist Mono** | Eyebrow labels, timestamps, units, tabular data. The instrument-panel identity, kept deliberately. |

Scale (mobile-first, line-height attached, `rem`-based):
`display-xl 64/68 · display 40/44 · title-lg 28/34 · title 20/26 · body 16/24
· body-sm 14/20 · label 12/16 mono uppercase tracking 0.08em`.
Floors, enforced: no interface text below 12px (the current 10px habit is
banned); body copy never below 14px; `tabular-nums` wherever digits change.

### Space, radius, elevation, motion

- **Spacing:** 4px base — `4 8 12 16 20 24 32 40 48 64`, tokens `space-1..10`.
  Screen gutter 20px mobile / 24px desktop; card padding 16/20.
- **Radius:** `r-sm 8` (chips, checkboxes), `r-md 12` (inputs, buttons),
  `r-lg 16` (cards), `r-xl 24` (sheets, modals), `r-full` (pills, the dot).
- **Elevation:** dark theme elevates by hairline + subtle inner luminance,
  not drop shadows; light theme uses 3 shadow recipes. Levels: `e0` flat,
  `e1` card, `e2` sheet/modal, `e3` toast/palette. One glow recipe exists and
  belongs to the signature dot alone.
- **Motion:** `dur-tap 120ms · dur-control 180ms · dur-card 240ms ·
  dur-screen 320ms`; spring-out easing `cubic-bezier(0.22, 1, 0.36, 1)`
  (inherited — it is good); `prefers-reduced-motion` collapses everything to
  fast opacity crossfades, never disables feedback entirely.

### Signature element (one, restrained)

**The ember dot.** A 6px `ember` dot with a soft 2400ms breathing glow that
means exactly one thing everywhere: "this is alive / this is now". It marks
the active tab, today in the calendar, a running rest timer, an alive streak,
and sync-in-flight. It is the only element in the system allowed to glow or
loop. Everything around it stays quiet — hairlines, flat surfaces, type doing
the work. (It is also the honest evolution of the current bottom-nav glow dot
— continuity instead of amnesia.)

### Component inventory (all custom, tokens-only, in `src/ui/`)

Foundation primitives, each with default/hover/focus-visible/active/disabled
and, where meaningful, error/loading/filled states:

| Component | Notes (a11y + behavior floor) |
| --- | --- |
| Button | primary (ember) / secondary (surface) / ghost / destructive (segnale); sm-md-lg; loading spinner replaces label, width locked; real `<button>` |
| Input | label, hint, error slot; 16px font floor (kills iOS zoom); clear affordance optional |
| Textarea | auto-grow, max-height, counter slot |
| Select | custom listbox (`role="listbox"`, typeahead, keyboard nav); native `<select>` is banned in the new library |
| Checkbox | 24px control in a 44px target; indeterminate; animated check |
| Radio | group with `role="radiogroup"`, arrow-key nav |
| Switch | `role="switch"`, drag + tap, haptic-styled thumb |
| DatePicker | fully custom popover/sheet calendar; Italian weekday/month names; min/max; "Oggi" shortcut; keyboard grid nav per WAI-ARIA date grid |
| TimePicker | custom dial-less list picker: two scroll columns (ore, minuti a 5') + free typing; 24h |
| Calendar | month grid + week strip views; density dots; today = ember dot; swipe months on touch, arrows on desktop |
| Modal | focus trap, `inert` background, esc/overlay close, `r-xl`, motion tokens |
| BottomSheet | touch-first modal variant: drag handle, snap points, safe-area padding |
| Toast | stacking, action slot (undo pattern), auto-dismiss with pause-on-hover, `aria-live="polite"` |
| Tabs | underline style, `role="tablist"`, arrow-key nav; scrollable overflow |
| Progress | linear + ring (the hero ring survives, rebuilt on tokens); determinate/indeterminate |
| StatCard | label (mono eyebrow), value (display face, tabular), delta chip, optional sparkline slot |
| ChartFrame | the chart wrapper: title/legend/empty/loading states around any SVG chart child; axis text 12px mono |
| EmptyState | icon-optional, one heading, one sentence, one action; no illustrations |
| Skeleton | shimmer blocks matching each surface; respects reduced-motion |
| CommandPalette shell | cmd+k overlay, fuzzy list, `role="combobox"` pattern; wiring comes later, shell ships in foundation |

### Quality floor (mandatory, acceptance-tested in every prompt)

Responsive to 320px width; visible keyboard focus on every interactive
element (`:focus-visible` ring token); ARIA roles per WAI-ARIA APG on all
custom controls; WCAG AA contrast in both themes (checked at token level);
`prefers-reduced-motion` respected; touch targets >= 44px; no horizontal
scroll on the page body; forms usable with the on-screen keyboard open.

### Interface copy rules (Italian)

- Plain verbs, sentence case: "Aggiungi task", never "AGGIUNGI TASK!" —
  uppercase belongs to mono eyebrow labels only.
- Actions named by what they do: "Sposta a domani", not "OK"/"Conferma".
- Errors say what happened + how to fix: "Non ho potuto salvare (sei
  offline). Riprova quando torni online." Never bare codes, never blame.
- No shame language anywhere (inherited iron rule): overdue is "in ritardo",
  a broken streak is "riparti oggi".
- Numbers with Italian formats: `1.250 kg`, `08:30`, `ven 12 lug`.

---

## B5. Implementation plan — the file of files

Workflow contract for every prompt: one concern per prompt; Davide reviews the
full diff, smoke-tests on a real phone, commits manually, merges `--no-ff`.
Every prompt ends with `npm run build` + `npx tsc --noEmit` + `npm test`
green, legacy routes untouched unless the prompt says otherwise, and the app
in a shippable state. Model tiers: **MAX** = Fable/Opus, Effort Max (auth,
data, architecture); **SON** = Sonnet (contained UI work). Size: S (~1-2h
session), M (half day), L (full long session).

| # | Prompt file | Concern | Size | Tier | Depends on |
| --- | --- | --- | --- | --- | --- |
| 02 | `02-foundation.md` | Ember tokens + full custom UI kit + `/dev/ui` playground | L | MAX | — |
| 03 | `03-auth-otp.md` | Login reliability: email OTP primary, token_hash fallback | S-M | MAX | — |
| 04 | `04-storage-local.md` | Storage ports + Dexie local adapter + schemas + tests | M | MAX | — |
| 05 | `05-shell-today.md` | New app shell: route groups, nav, Today skeleton | M | SON | 02 |
| 06 | `06-tasks.md` | Tasks module v1 + Italian NL quick-add parser | L | MAX | 02,04,05 |
| 07 | `07-guest-mode.md` | Guest access: proxy flip, guest landing, empty states | S | MAX | 05,06 |
| 08 | `08-sync-migration.md` | Sync engine, Supabase adapter, guest->account migration, export/import | L | MAX | 04,06,07 |
| 09 | `09-calendar.md` | Calendar module: month/week UI, local events, Google port + fixes | M-L | SON | 02,04,05 |
| 10 | `10-gym.md` | Gym module: library, plans, session logging, rest timer, PRs, importer | L | SON | 02,04,05 |
| 11 | `11-stats.md` | Stats module: Today tiles, streak engine, weekly review | M | SON | 06 (09,10 enrich) |
| 12 | `12-reminders.md` | Reminders v1: in-app scheduler, badges, .ics export | M | MAX | 06 |
| 13 | `13-pwa-offline.md` | Service worker, offline shell, install UX | M | MAX | 05 |
| 14 | `14-comfort.md` | Command palette wiring, shortcuts, theme switch, skeleton/empty sweep | M | SON | 05-11 |
| 15 | `15-legacy-wave.md` | Port Esami + Expenses + Sera onto ports/UI kit; retire Commute; bridge removal | L | SON | 08 |
| 16 | `16-cleanup.md` | Repo root move, CI revival, dead-code deletion, docs refresh | S | MAX | all |
| 17 | `17-push-notifications.md` | v2, optional per D2: Web Push + email digest for accounts | M | MAX | 08,12,13 |

Dependency shape: 02/03/04 are independent starters. 03 ships first
user-visible relief (login). The spine is 04 -> 06 -> 07 -> 08; module prompts
09/10/11 parallelize after 05.

### Per-prompt definitions

**02-foundation** — Goal: the Ember design system as code plus the complete
custom component library of B4, showcased in a `/dev/ui` playground.
In scope: `src/ui/` (or repo-appropriate isolated folder), tokens CSS, all 21
components with all states, playground route; zero imports from existing
screens. Out: any change to existing pages beyond registering the route.
Acceptance: build+typecheck green; every component visible in every state at
`/dev/ui`; keyboard-only pass on Select/DatePicker/Modal; contrast tokens AA
in both themes; no native date/time/select in the library. Smoke (device):
open `/dev/ui` on iPhone Safari — tap targets, sheet drag, date grid swipe.
(This is Phase C of session 00 — if it completed, this prompt is already
satisfied; the stub records the gate outcome.)

**03-auth-otp** — Goal: sign-in that works every time, from any device or
mail client. In scope: 6-digit OTP entry screen with resend cooldown;
`verifyOtp` server action; `token_hash` handling in `/auth/callback`;
Supabase email template instructions (documented step list for the dashboard);
rate limit on the send action; error copy per B4 rules. Out: guest mode,
password/passkeys, session refactors. Acceptance: request code -> type code on
a DIFFERENT device -> logged in; stale magic link still works same-device;
build green. Smoke: Gmail app on iPhone, code path end to end; wrong code x5
shows friendly lockout copy.

**04-storage-local** — Goal: the data spine. In scope: `src/data/ports.ts`
(Tasks/Events/Gym/Stats/Reminders/Settings interfaces), zod entity schemas,
UUIDv7 helper, Dexie DB with versioned schema + tombstones + `updated_at`,
local adapters implementing every port, `useLiveQuery` hooks, unit tests over
fake-indexeddb, `Result<T>` convention. Out: any UI, any Supabase code paths.
Acceptance: `npm test` covers CRUD + tombstone + migration-bump cases; app
builds with the lib present but unused. Adds dependencies: `dexie`,
`fake-indexeddb` (dev), `uuid` (or `crypto.randomUUID` + v7 helper — decide in
prompt). Smoke: none (lib-only), test suite is the gate.

**05-shell-today** — Goal: the new app skeleton users will live in. In scope:
`(app)` route group with layout (bottom tab bar mobile / left rail desktop,
ember-dot active state), routes `/`, `/tasks`, `/calendar`, `/gym`, `/stats`,
`/settings` as static skeletons with per-group loading/error boundaries;
Today composed of placeholder sections wired to REAL date/greeting; legacy
dashboard moved to stay reachable at `/dashboard` (bridge link both ways);
proxy: `/` added to protected list for now (guest comes in 07). Out: module
logic, storage wiring. Acceptance: navigation works on 320px and desktop;
old routes fully intact; build green. Smoke: iPhone — tab bar safe-area,
landscape, back-gesture behavior.

**06-tasks** — Goal: the flagship module, real end to end. In scope: tasks on
the local storage port (guest-ready but still auth-gated until 07); quick-add
with the Italian NL parser (`lib/nlp-it` pure + ~40 unit tests: dates, times,
priorities, tags, accents, "domani alle 7 e mezza"); parse-preview chips;
Today + Tasks views (Oggi/Prossimi/Inbox/Fatti); swipe complete + snooze;
undo toast; drag reorder; overdue rail. Out: recurrence, reminders, sync.
Acceptance: parser test table green including tricky Italian forms; every
mutation optimistic with rollback on failure; zero mock data anywhere on
Today; build green. Smoke: airplane mode -> add/complete/undo tasks -> reload
(IndexedDB persistence); one-handed phone triage of 10 tasks.

**07-guest-mode** — Goal: zero-signup product. In scope: proxy allowlist flip
(new surfaces public, legacy still protected); guest Today with considered
first-run state + one quiet "i tuoi dati vivono su questo dispositivo" note;
account CTA in Settings; signed-in users unaffected. Out: sync (data stays
local for everyone until 08). Acceptance: fresh incognito visit lands on
Today and can use Tasks fully; `/finance` still redirects to login; build
green. Smoke: private-browsing iPhone run-through; PWA install as guest.

**08-sync-migration** — Goal: accounts mean sync, guests lose nothing. In
scope: additive Supabase migrations (new-shape `tasks`, `events`, `gym_*`,
`reminders`, `push_subscriptions` reserved); Supabase adapter; sync engine
(push queue, pull on focus/interval, LWW by `updated_at`, tombstones);
guest->account migration flow + summary screen; JSON export/import in
Settings; sync status via the ember dot. Out: realtime channels, CRDT,
multi-account merge UI beyond LWW. Acceptance: integration test script:
guest creates data -> signs up -> rows on server -> second browser pulls them;
conflict test (edit both sides) resolves LWW; export file re-imports
losslessly. Smoke: two devices, one account, edits converge; kill network
mid-sync, recover.

**09-calendar** — Goal: planning surface. In scope: month view + week strip
on the custom Calendar component; local events CRUD on the port (NL
quick-add shared); unified day agenda (events + timed tasks + Google
read-only); port the Google integration off the legacy page: fix render-time
INSERT (move to action), fix multi-account `.maybeSingle()`, keep
token crypto untouched; `/agenda` legacy route redirects here when done. Out:
write-back to Google, CalDAV, drag-to-time. Acceptance: month grid renders
500 events without jank; Google connect/sync/disconnect works on the new
page; build green. Smoke: connect real Google account on phone; month swipe;
offline shows local events.

**10-gym** — Goal: a gym log you actually use mid-workout. In scope: exercise
library (seeded IT catalog, CRUD), plans, session flow (start/from-plan,
set logging with steppers, duplicate-set, rest timer with wake-safe elapsed
math, finish summary), per-exercise history + est. 1RM (reuse
`lib/fitness.ts`), PRs, history heat strip; importers for `gym_sessions` +
`gym_workouts` (idempotent, behind a Settings action for account users). Out:
supersets, plate calc, RPE, health integrations. Acceptance: full workout
loggable one-handed with screen locking between sets (timer survives); import
produces correct history on a copy of real data; build green. Smoke: real
gym session on phone, airplane mode.

**11-stats** — Goal: honest numbers. In scope: streak engine on the port
(any-meaningful-action + protected days), Today tiles (real), Stats screen
(week bars, month heat, gym volume, records), weekly review screen; ChartFrame
+ small SVG charts (no chart dependency). Out: correlations, LLM narratives,
goals. Acceptance: streak unit tests incl. timezone-day boundaries and
protected days; tiles match manual counts on seeded data; build green. Smoke:
change phone timezone, verify day roll; review screen Sunday state.

**12-reminders** — Goal: the honest v1 of B2.2. In scope: reminder field on
tasks/events; in-app scheduler (foreground timer + on-focus catch-up), toast
+ sound + Badging API; notifications truth panel in Settings; per-item .ics
download; `RemindersScheduler` interface future-proofed for push. Out: Web
Push (17), email. Acceptance: due reminder fires while app open in another
tab (badge) and on next focus (catch-up list); .ics opens correctly in iOS
Calendar; build green. Smoke: set reminder 2 min out, lock phone, reopen —
catch-up card shows; ics round-trip.

**13-pwa-offline** — Goal: installable and offline-real. In scope: service
worker (app-shell precache + runtime cache, versioned update flow with "nuova
versione" toast), offline fallback page for uncached routes, install
prompt UX + iOS coaching sheet, splash/theme colors both themes. Out: push
handler (17), background sync. Acceptance: Lighthouse PWA installable pass;
airplane-mode cold start reaches Today with data; deploy of a new version
updates without stuck-stale clients (documented kill-switch). Smoke: install
on iPhone + Android, offline cold start, update cycle.

**14-comfort** — Goal: the polish wave. In scope: command palette wiring
(navigate, add task, theme), shortcut map + "?" overlay, theme switcher,
skeleton/empty audit across every new screen, transition tokens applied,
focus-order pass. Out: new features. Acceptance: keyboard-only full app tour
recorded in the PR notes; reduced-motion pass; build green. Smoke: external
keyboard on iPad; palette on desktop.

**15-legacy-wave** — Goal: land the D4 ports, delete the mock world. In
scope: Esami -> new module on ports+UI kit (keep pacing lib); Expenses ->
port `personal_expenses` flow only (legacy `finance_entries` becomes
read-only archive screen); Sera -> journal on ports with Drive export kept;
retire `/commute` and the mock dashboard (delete `lib/mock-data.ts`, dead
dashboard components, dead engine actions after extracting the streak-
protection idea already reborn in 11); redirect map old->new. Out: Business/
Custom/Overseer (explicit D4 leftovers, untouched). Acceptance: no route
renders mock data anywhere; deleted-code build still green; data visible in
new modules matches old screens on real accounts. Smoke: full app tour on
both users' real data.

**16-cleanup** — Goal: repo worth showing. In scope: move app to repo root
(D3), root CI workflow (lint, typecheck, test, build), `typecheck` script,
prune one-shot scripts, untrack `.DS_Store`, README rewrite reflecting
reality, `CLAUDE.md` update (conventions, commands, architecture map). Out:
code changes. Acceptance: CI green on GitHub on a test PR; fresh
`git clone && npm i && npm run dev` works per README on a clean machine.
Smoke: none beyond CI.

**17-push-notifications** (v2, optional, after D2 confirmation) — Goal: real
reminders when the app is closed, for accounts with installed PWA. In scope:
VAPID keys, `push_subscriptions` table + RLS, service-worker push+click
handlers, Edge Function cron sender, per-category opt-in UI, morning brief;
email digest fallback. Acceptance: locked-iPhone reminder delivery from a
scheduled task; unsubscribe path verified; no reminder content in logs.
Smoke: 48h soak on both founders' phones.

### Stub files

Each prompt above has a skeleton stub in this folder (`02-foundation.md` ...
`17-push-notifications.md`) with title, goal, and scope only — to be finalized
one at a time with chat-Claude before its implementation session, per the
established workflow.

