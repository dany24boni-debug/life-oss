# LifeOS — Full Audit (Session 00)

Date: 2026-07-09
Auditor: Claude (Fable 5), unattended session, branch `feat/00-audit-blueprint`
Scope: read-only audit of the existing application. No source files modified.

Path convention: the git repository root is `/Users/daviderocca/Desktop/life-oss`; the
application lives in the nested folder `life-os/`. All file references below are
relative to the repository root unless stated otherwise, i.e. `life-os/app/page.tsx`.

## Pre-flight

- `git status --porcelain` at session start: clean.
- Branch at start: `main`, HEAD `e173b58` ("fix: migrazione 0018 grant profiles per authenticated").
- Remote: `origin` -> `https://github.com/dany24boni-debug/life-os.git` (fetch + push).
- Working branch created: `feat/00-audit-blueprint` (branch only, no commits).
- History is short: 3 commits total (`a933fea` initial commit, `a74ad09` auth callback
  fix, `e173b58` migration 0018). Effectively a single-drop codebase plus two auth fixes.
- 222 files tracked by git. `node_modules/` present (installed), `.next/` present
  (project has been built or run locally before).
- Repository layout oddity: the app is nested one level down (`life-os/`), while the
  git root contains only `.DS_Store` (tracked — hygiene issue) and the `life-os/` folder.
  Consequence: `life-os/.github/workflows/ci.yml` is NOT at the repository root, so
  GitHub Actions never executes it. The CI defined there (lint, tsc, sentinel grep,
  vitest) is dead on GitHub. `[NEEDS RUNTIME VERIFICATION]` — confirm via the repo's
  Actions tab; locally verifiable only that the path is non-standard.
- `.env.local` exists at `life-os/.env.local` (untracked, correctly gitignored via
  `.env*` pattern in `life-os/.gitignore`). Values not inspected. Variable names are
  documented in `life-os/.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`.

### Stack detection (summary — full stack card in section A1)

Read from `life-os/package.json`, lockfile, and configs before assuming anything:

- Next.js `16.2.6` (App Router, `proxy.ts` request interceptor — Next 16's replacement
  for `middleware.ts`), React `19.2.4`, TypeScript `^5` strict.
- Tailwind CSS v4 via `@tailwindcss/postcss` (CSS-first config, no tailwind.config file).
- Supabase: `@supabase/supabase-js ^2.105.3` + `@supabase/ssr ^0.10.3` (cookie-based
  SSR session handling). Postgres schema managed via `life-os/supabase/migrations/`
  (18 SQL files).
- `@anthropic-ai/sdk ^0.95.1` — an in-app AI assistant ("Overseer").
- `zod ^4.4.3` for validation, `vitest ^3.2.4` for tests (lib/ only), ESLint 9 flat
  config with `eslint-config-next`.
- Build script: `next build --webpack` (webpack forced, not Turbopack) while
  `next.config.ts` sets `turbopack.root` — mixed signals, see A1.
- Deploy signals: `.vercel` in gitignore, `scripts/setup-vercel-env.mjs` — Vercel.
- `AGENTS.md` warns that Next 16 conventions differ from pre-16 training data and
  points to `node_modules/next/dist/docs/` as reference.

The app is significantly larger than the session brief's seed description
(tasks, gym, calendar, stats): it also contains agenda + Google Calendar sync,
finance, exams (esami), health, body, commute, business/chameleon-os, custom
user-defined modules, an evening journal (sera) with Google Drive export, insights,
timeline, onboarding, recap, and an Anthropic-powered assistant. The audit covers
all of them.

## A1. Stack card

| Concern | Finding | Evidence |
| --- | --- | --- |
| Language | TypeScript 5, `strict: true`, path alias `@/*` | `life-os/tsconfig.json` |
| Framework | Next.js 16.2.6, App Router, React Server Components + server actions, React 19.2.4 | `life-os/package.json` |
| Request interceptor | `proxy.ts` (Next 16 replacement for middleware): Supabase session refresh + route protection | `life-os/proxy.ts` |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss`, CSS-first tokens in an `@theme` block; dark-only theme (`color-scheme: dark`); fonts Geist Sans/Mono via `next/font` | `life-os/app/globals.css:3-109`, `life-os/app/layout.tsx:6-14` |
| State management | None beyond local `useState`; data flows through RSC props and server actions. No client cache, no react-query/zustand/etc. | e.g. `life-os/app/dashboard/_components/dashboard-client.tsx:36-44` |
| Data | Supabase (Postgres + Auth + RLS), `@supabase/supabase-js 2.105.3` + `@supabase/ssr 0.10.3` (cookie sessions); 19 SQL migration files (18 numbers, one duplicate number, see A3) | `life-os/lib/supabase/`, `life-os/supabase/migrations/` |
| Validation | zod 4.4.3 in `lib/validation/*` (finance, gym, form-inputs, drive-api, local-storage) — not used by all forms (e.g. login action does manual string checks) | `life-os/lib/validation/`, `life-os/app/login/actions.ts:7-10` |
| AI | `@anthropic-ai/sdk 0.95.1`; models pinned in one place: Haiku 4.5 (`claude-haiku-4-5-20251001`) for Today's Call, Sonnet (`claude-sonnet-4-6`) for Overseer chat; all callers stub gracefully without `ANTHROPIC_API_KEY` | `life-os/lib/anthropic/client.ts:19-24` |
| Tests | Vitest 3.2.4, node environment, `lib/**/*.test.ts` only (16 test files). No component, route, or e2e tests. `fileParallelism: false` for registry isolation | `life-os/vitest.config.ts` |
| Lint | ESLint 9 flat config + `eslint-config-next` (core-web-vitals + TS) | `life-os/eslint.config.mjs` |
| Build | `next build --webpack` (webpack explicitly forced) while `next.config.ts` also configures `turbopack.root` — mixed signals; dev uses default (Turbopack in Next 16) | `life-os/package.json` scripts, `life-os/next.config.ts:44-46` |
| Security headers | Full CSP + HSTS + X-Frame-Options etc. applied to every response via `headers()` | `life-os/next.config.ts:13-40` |
| CI | GitHub Actions workflow (lint, tsc, sentinel grep, vitest) exists but sits at `life-os/.github/workflows/ci.yml` — not the repo root — so GitHub never runs it. Dead CI. `[NEEDS RUNTIME VERIFICATION]` via repo Actions tab | `life-os/.github/workflows/ci.yml` |
| Hosting | Vercel (gitignore `.vercel`, `scripts/setup-vercel-env.mjs`, README deploy section) | `life-os/README.md` |
| PWA status | Installable-only: `manifest.webmanifest` + `app/icon.tsx` (192px) + `app/apple-icon.tsx` (180px) + iOS meta. NO service worker, NO offline support (`next-pwa` deliberately removed 2026-05 for CVEs, per README "Notes"). `display: standalone`, portrait, `lang: it` | `life-os/public/manifest.webmanifest`, `life-os/app/layout.tsx:19-25` |
| Ops scripts | 12 Node scripts for Supabase Management API (run migrations, verify schema, promote owner, generate admin magic link, diagnose auth, swap project, set Vercel env) | `life-os/scripts/` |
| Language of UI | Italian (copy, comments partially Italian; `lang="it"`) | `life-os/app/layout.tsx:45` |

Version note: `next 16.2.6` / `react 19.2.4` are pinned exact; everything else is
caret-ranged. `AGENTS.md`/`CLAUDE.md` instruct agents to read
`node_modules/next/dist/docs/` before writing code because Next 16 conventions
differ from pre-16 material.

## A2. Route and screen inventory

Grades: `OK` = works as coded, acceptable quality. `buggy` = reachable but with a
concrete defect. `ugly` = works but with significant UX/code-quality debt.
`dead` = unreachable, mock-only, or placeholder. Suspected runtime bugs are
hypotheses (H) unless verifiable from code structure alone.

| Route | Purpose | Grade | Key notes (evidence) |
| --- | --- | --- | --- |
| `/` | Redirect to `/dashboard` | OK | `app/page.tsx:4` |
| `/login` | Magic-link sign-in | buggy (flow) | UI itself is fine; the flow has the A4 failure modes; no resend cooldown; raw Supabase errors surfaced via URL (`app/login/actions.ts:23`) |
| `/auth/callback` | PKCE code exchange (Route Handler) | OK | Correct post-`a74ad09`; no `token_hash` handling (A4) |
| `/auth/confirm` | Implicit-flow hash handler (client) | OK | Thorough error branches; history cleanup (`_client.tsx:79-83`) |
| `/onboarding` (?step=1..6) | 6-step wizard | OK | Server-validated; `saveProfile` uses `.update()` not upsert — silent no-op if profile row missing (H) (`actions.ts:39-42`); step routing is an if-chain (`page.tsx:49-118`) |
| `/dashboard` | Main "Today" screen | **buggy / mock** | Renders almost entirely `lib/mock-data.ts` constants: header date "Ven, 8 mag", state pill, hero ring 81, streak 12/18, stat grid, daily stack, HEAVY tasks, Why panel (`_components/dashboard-client.tsx:36-234`). Checkboxes are unpersisted `useState`. Only `display_name` is real (`page.tsx:43`). Today's Call fed mock inputs (`page.tsx:71-77`). The complete real engine behind it is never called (see A5 Tasks) |
| `/body` | Hub for Gym + Health cards | buggy | Gym card reads legacy `gym_workouts` which nothing writes anymore — stats permanently frozen at 0/"Mai" once user logs via `/gym` (`body/page.tsx:53-64` vs `gym/actions.ts` writing `gym_sessions`) |
| `/gym` | Session logger + stats | OK | Real, validated (zod), edit/delete; silent validation failures (`gym/actions.ts:55-59`); 70 lines of dead legacy actions (`actions.ts:239-309`) |
| `/health` | Water, supplement stack, sleep | OK | Native `<select>` for sleep quality; DB errors `throw` to root error page (`health/actions.ts:42,78,116,159`); "avg 7d" actually averages last 7 rows not 7 days (`page.tsx:69-74,99-101`) |
| `/finance` | Income/expense, two tabs | OK | Split-brain data model: legacy `finance_entries` + new `personal_expenses` both live (`page.tsx:33-36`); silent action failures; add-expense silently no-ops when no category chip picked (H) (`_components/expense-form.tsx:180-182`); 665-line page file |
| `/esami` | Exam list + chapter pacing | buggy (minor) | Dead exported action `updateExamProgress` (`actions.ts:158-196`); never calls `recordEvent` so invisible to timeline/insights; native date input |
| `/agenda` | Local + Google merged agenda | buggy | INSERT during GET render to auto-create "Agenda principale" (`page.tsx:66-93`); second Google account breaks reads via `.maybeSingle()` (H) (`callback/route.ts:158` vs `page.tsx:97-102`); no pending UI on sync |
| `/sera` | Evening check-in + Drive diary | ugly | Placeholder "Domani" section shipped (`page.tsx:297-300`); hand-rolled YAML frontmatter (`drive-journal.ts:71-138`); fetches 30 journal entries and renders 2 (`page.tsx:103,329-333`); diary error UX is actually the best in the app |
| `/recap` | Day summary | OK | Read-only; local-time date parse outlier — off-by-one risk (`page.tsx:233`) |
| `/timeline` | Event feed with filters | OK | "Tutto" range silently truncated at `limit(300)` (`page.tsx:78`) |
| `/insights` | Computed pattern cards | buggy | Recomputes + DELETE/INSERT `user_insights` on every page render (`run.ts:162-181`); that table is write-only — never read back; 2 of 5 evidence visual kinds unreachable; PR window anchored to last workout not today (`compute.ts:270`) |
| `/settings` | State Engine switcher | OK | Clean close-span/insert-span logic (`actions.ts:16-75`) |
| `/settings/goals` | Goals CRUD | OK | One-tap delete without confirmation (`page.tsx:164-173`) |
| `/settings/targets` | Monthly targets CRUD | buggy (minor) | Hardcoded extra `studio` option can duplicate (`page.tsx:124`); native month picker |
| `/more` | Hub + sign-out | OK | Dashboard "Agenda" chip mis-links to `/settings/targets` (`dashboard-client.tsx:79`) |
| `/business` | Private modules hub (whitelisted) | OK | Registry-driven tabs |
| `/business/chameleon-os` | Milestones + partner sync CRUD | OK | Deletes without confirmation; native date + select |
| `/custom`, `/custom/[id]` | User-defined trackers | OK | Ownership defence-in-depth (`custom/actions.ts:100-106`); dead ternary (`[id]/page.tsx:109`); no delete confirmation |
| `/commute` | Commute-mode screen | **dead** | All three cards are `href="#"` placeholders "(in arrivo)" (`commute/page.tsx:19-38`); only the banner/toggle plumbing works |
| `/dev/components` | UI showcase (dev only) | OK | `notFound()` in production (`page.tsx:18`); shows only 10 of 24 ui components |
| `/api/overseer` | Streaming AI chat | OK | Auth + 20/min rate limit + payload caps (`route.ts:23-66`); content-length guard bypassable when header absent (H) (`route.ts:63`) |
| `/api/auth/google/start`, `/callback` | Google OAuth | OK | CSRF state, timing-safe compare, AES-256-GCM token storage — strongest code in the repo |
| `error.tsx` / `loading.tsx` / `not-found.tsx` | Root boundaries | OK | Root-level only; zero per-route boundaries anywhere |

### Native/default browser controls (complete sweep, one line each)

Grep patterns: `type="date|time|datetime-local|month|week"`, `<select`, `alert(`,
`confirm(`, `prompt(` across `app/`, `components/`, `lib/`.

Live code:
1. `life-os/app/onboarding/_steps/energy.tsx:52` — `<input type="time">` — wake time
2. `life-os/app/onboarding/_steps/energy.tsx:62` — `<input type="time">` — sleep time
3. `life-os/app/onboarding/_steps/energy.tsx:73` — `<select>` — timezone (5 hardcoded zones)
4. `life-os/app/onboarding/_steps/goals.tsx:37` — `<select>` — goal category (x5 slots)
5. `life-os/app/onboarding/_steps/goals.tsx:50` — `<input type="date">` — goal target date (x5 slots)
6. `life-os/app/onboarding/_steps/targets.tsx:46` — `<select>` — target module (x3 slots)
7. `life-os/app/settings/goals/page.tsx:70` — `<select>` — goal category
8. `life-os/app/settings/goals/page.tsx:83` — `<input type="date">` — goal target date
9. `life-os/app/settings/targets/page.tsx:113` — `<select>` — target module
10. `life-os/app/settings/targets/page.tsx:127` — `<input type="month">` — target month
11. `life-os/app/health/page.tsx:236` — `<select>` — sleep quality 1-5
12. `life-os/app/finance/page.tsx:312` — `<select>` — entry kind (income/legacy expense)
13. `life-os/app/esami/page.tsx:94` — `<input type="date">` — exam date
14. `life-os/app/agenda/page.tsx:214` — `<input type="date">` — new local event date
15. `life-os/app/business/chameleon-os/page.tsx:139` — `<input type="date">` — milestone target date
16. `life-os/app/business/chameleon-os/page.tsx:174` — `<select>` — milestone status
17. `life-os/app/custom/page.tsx:75` — `<select>` — custom module kind
18. `life-os/components/ui/date-toggle.tsx:110` — `<input type="date">` — shared DateToggle disclosure, used by gym/health/finance/expense-form/custom-detail/chameleon-sync

Dead code (unreferenced component, still counts for cleanup):
19. `life-os/app/dashboard/_components/add-task-form.tsx:21` — `<select>` — task module
20. `life-os/app/dashboard/_components/add-task-form.tsx:34` — `<select>` — task weight

`alert()` / `confirm()` / `prompt()`: **zero occurrences** anywhere. Side effect:
every destructive action (delete goal/target/milestone/custom module/entry,
Google disconnect) fires with NO confirmation at all
(`app/settings/goals/page.tsx:164-173`, `app/business/chameleon-os/page.tsx:192-197`,
`app/custom/page.tsx:167-176`, `app/agenda/page.tsx:280`).

## A3. Data layer

### Where data lives

1. **Supabase Postgres** — effectively all persistent data. Both clients are created
   ad hoc per request (`lib/supabase/server.ts`, `lib/supabase/client.ts`); there is
   NO storage abstraction layer of any kind: pages and server actions call
   `supabase.from("...")` directly (60+ call sites across `app/` and `lib/`).
2. **localStorage** — exactly one feature: the commute-mode manual override, key
   `lifeos.commute.manual`, duplicated as a string literal in two files
   (`app/dashboard/_components/commute-banner.tsx:22`,
   `app/more/_components/commute-toggle.tsx:19`), validated by
   `lib/validation/local-storage.ts`. Per-device, unsynced.
3. **In-memory client state** — the entire dashboard "Daily Stack" and "HEAVY tasks"
   checkboxes are `useState` over mock constants
   (`app/dashboard/_components/dashboard-client.tsx:36-44`): they persist nothing
   and reset on reload.
4. **In-memory server state** — the rate limiter (`lib/rate-limit.ts`) is a
   module-level Map, per-process, documented as V0 single-server scope.

### What happens today for a user with no account

Nothing is usable. `proxy.ts:4-22` lists 17 protected prefixes covering every
feature route; `/` redirects to `/dashboard` (`app/page.tsx:4`) which is protected;
an unauthenticated user can only ever see `/login` and the auth callback pages.
There is no guest mode, no local persistence for guests, no trial surface. This is
the single largest gap between the current app and the guest-first target.

### Entities (from `life-os/supabase/migrations/`, applied in filename order)

| Table | Migration | Purpose / notes |
| --- | --- | --- |
| `profiles` | 0001 (+0004 cols, 0015 col) | 1:1 with `auth.users` via trigger `handle_new_user` (0001/0002); display name, chronotype, wake/sleep time, timezone, `onboarding_completed`, `is_owner`, `diario_drive_folder_id` |
| `modules_registry` | 0005 | Global catalog of module slugs |
| `private_modules_whitelist` | 0005 | Per-user access to private modules (only `chameleon_os` on this branch) |
| `user_modules` | 0005 | Which modules a user activated during onboarding |
| `user_states` | 0005 | State Engine spans (Esami/Scaling/Manutenzione/Recupero/Vacanza), open span = `ended_at is null` |
| `user_long_term_goals` | 0005 | Onboarding goals |
| `user_monthly_targets` | 0005 | Monthly numeric targets per module/metric |
| `daily_tasks` | 0005 (+0013 carryover cols) | Generated/manual daily tasks: date, module, title, weight HEAVY/MEDIUM/LIGHT, completed, rollover fields |
| `user_streaks` | 0005 | current/best per scope ("daily") |
| `voglia_detections` | 0005 | Slip detections for the Voglia Engine (written by nothing live — see A5) |
| `mood_entries` | 0005 | 1-5 mood per day |
| `daily_calls` | 0005 | Cache of Today's Call text per day |
| `gym_workouts` | 0006 | LEGACY per-exercise log; still read by `/body` and insights, but no live writer (see A5 Gym) |
| `health_water_log`, `health_sleep_log`, `health_stack_days` | 0006 | Health module |
| `finance_entries` | 0006 | Income/expense ledger |
| `chameleon_milestones`, `chameleon_partner_sync` | 0007 | Business module data |
| `custom_modules`, `custom_module_entries` | 0008 | User-defined trackers (counter/streak/numeric/calendar kinds) |
| `user_events` | 0010 | Append-only event feed (timeline source), unique `(user_id, kind, ref_id)` |
| `user_insights` | 0010 | Computed insight cache |
| `external_calendar_accounts`, `external_calendar_events` | 0011 | Google Calendar link: AES-256-GCM encrypted tokens + imported events cache |
| `evening_checkins` | 0013 | Evening journal/planner row per day |
| `exams` | 0014 | University exams with CFU, dates, grades |
| `gym_sessions` | 0016 | CURRENT gym log (per-session: muscle groups, duration, notes) |
| `personal_expenses` | 0017 | Second expense system, separate from `finance_entries` (see A5 Finance) |

RLS: per-user `auth.uid() = user_id` policies exist on every user table (verified in
each migration file); `0009_harden_admin_tables.sql` adds deny-all policies for
admin tables; `0012_security_hardening.sql` tightens grants. Profile auto-creation
via `SECURITY DEFINER` triggers (0001/0002).

### Data-layer problems found

- **Two tables for the same domain, twice.** Gym: `gym_workouts` (legacy, still read
  by `/body` page and `lib/insights/run.ts:81`) vs `gym_sessions` (current, written
  by `/gym`). Finance: `finance_entries` (written by `/finance` income/expense form)
  vs `personal_expenses` (written by the newer expense form in the same page).
  Readers and writers are not aligned; `/body` gym stats can never move again
  (see A5).
- **Migration numbering collision:** `0016_gym_sessions.sql` and
  `0016_remove_hardcoded_owner_email.sql` share number 0016 (sorted-filename order
  still applies them deterministically, but the sequence documented in README/
  PARTNER-SETUP says "0004 through 0017", which is ambiguous about the pair).
- **Migration 0018 back-story** (`0018_grant_profiles_to_authenticated.sql:1-12`):
  `profiles` pre-existed the 0001 migration in the original Supabase project, so
  automatic grants never fired and `authenticated` lacked UPDATE on `profiles` —
  Postgres 42501 before RLS. Fixed with explicit column-scoped grants. Consequence
  worth keeping in mind for the rebuild: a fresh Supabase project needs 0001-0018
  applied in order and the app has NO runtime schema-version check — `[NEEDS
  RUNTIME VERIFICATION]` whether Davide's and Daniele's live projects both have all
  19 files applied.
- **No storage abstraction.** Every feature talks to Supabase directly; introducing
  guest-local storage later means touching every call site. This motivates the
  storage-port architecture in the blueprint (B3).
- **UI markers stored in data:** carry-over tasks get a literal `"↪ "` prefixed into
  `daily_tasks.title` (`app/dashboard/actions.ts:143`), and event summaries embed
  glyphs/emoji (`actions.ts:377`, `actions.ts:520-525`) — presentation baked into
  persisted rows.

## A4. Auth as-is (magic link, end to end)

### Flow trace

1. **Request** — `/login` renders a server-action form
   (`app/login/page.tsx:76-102`). `signIn` (`app/login/actions.ts:6-27`) calls
   `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
   ${NEXT_PUBLIC_APP_URL}/auth/callback } })`. Email validation is only
   "non-empty string" (`actions.ts:7-10`); no zod, no rate limit on this action
   (the in-memory limiter exists but is not used here). Errors are round-tripped
   through the URL: `redirect("/login?error=" + encodeURIComponent(error.message))`.
2. **Email send** — Supabase-hosted email (template/SMTP configured in the Supabase
   dashboard, not in the repo). Which template variant the live projects use is
   `[NEEDS RUNTIME VERIFICATION]`.
3. **Callback (PKCE path)** — `/auth/callback` is a Route Handler
   (`app/auth/callback/route.ts:21-41`): takes `?code=`, calls
   `exchangeCodeForSession(code)`, cookies are written to the response, redirects
   to `safeNext(next)` (open-redirect-hardened allowlist,
   `lib/auth/safe-next.ts:9-16`). Commit `a74ad09` moved this from a Server
   Component to a Route Handler because cookie writes during RSC render were
   swallowed and the session never persisted — that specific bug is fixed in code.
4. **Callback (implicit path)** — no `?code=` redirects to `/auth/confirm`
   (`app/auth/confirm/page.tsx`), whose client component
   (`_client.tsx:23-91`) reads `#access_token`/`#refresh_token` from the hash,
   calls `supabase.auth.setSession(...)`, strips the hash from history, then
   navigates. This path exists for links minted by `scripts/admin-magic-link.mjs`
   (admin `generate_link`, implicit flow).
5. **Session persistence** — HTTP-only cookies via `@supabase/ssr`; every request
   passes through `proxy.ts` which calls `supabase.auth.getUser()` (refreshing
   tokens when needed) and enforces the protected-prefix list.
6. **Expiry** — Supabase project defaults (access token ~1h, rotating refresh
   token; magic link single-use with project-configured TTL). Nothing in the repo
   overrides these. `[NEEDS RUNTIME VERIFICATION]` for the live projects' values.

### Not handled by the code today

- `?token_hash=` + `type=` style links (Supabase "email OTP" template variant
  using `verifyOtp`) are not handled by `/auth/callback` — such a link would fall
  through to `/auth/confirm`, find no hash tokens, and bounce to
  `/login?error=missing_code`. Only relevant if the Supabase email template is the
  token-hash variant. `[NEEDS RUNTIME VERIFICATION]`
- No resend/cooldown UX on `/login` (button can be hammered; Supabase's own send
  rate limit then surfaces as a raw error string in the URL banner).
- No session-expiry UX: expired session mid-action just 303s to `/login` via proxy.

### Concrete failure hypotheses (each `[NEEDS RUNTIME VERIFICATION]`)

- **H1 — Cross-context PKCE break (most likely the "magic link is flaky" root).**
  `signInWithOtp` under `@supabase/ssr` uses the PKCE flow: a `code_verifier`
  cookie is written in the browser context that submitted the form. If the user
  opens the emailed link in a DIFFERENT context — Gmail/Outlook in-app browser,
  a different device, or iOS where the installed PWA and Safari have separate
  cookie jars — `exchangeCodeForSession` fails ("code verifier" mismatch) and the
  user lands on `/login?error=...`. Even when it succeeds in Safari, the session
  cookie lives in Safari, not in the installed PWA, so the PWA still shows the
  login screen. Code evidence: verifier-dependent exchange at
  `app/auth/callback/route.ts:33`; no `token_hash` fallback that would avoid the
  verifier requirement.
- **H2 — Link prefetch consumption.** Corporate/consumer mail scanners (Outlook
  SafeLinks, some Gmail prefetchers) follow the one-time link before the user
  taps it; the user's tap then hits an already-consumed OTP -> error. Mitigation
  requires an explicit "click to confirm" interstitial or OTP-code entry; neither
  exists.
- **H3 — `NEXT_PUBLIC_APP_URL` misconfiguration.** `app/login/actions.ts:13` falls
  back to `http://localhost:3000`; if the Vercel env var is missing/typo'd, every
  magic link redirects to localhost and dies on a phone.
- **H4 — Supabase Redirect URL allowlist.** If the deployed URL (or preview URL)
  is not in Authentication -> URL Configuration, Supabase silently redirects to the
  project Site URL instead of `/auth/callback`.
- **H5 — Missing DB grants on a stale project (the 0018 class of bug).** On a
  Supabase project where migrations 0012-0018 are partially applied, `profiles`
  reads/writes fail with 42501; the dashboard then sees `profile = null`,
  redirects to `/onboarding` (`app/dashboard/page.tsx:41`), and onboarding's
  writes fail in a loop. Login itself "works" (session exists) but the app appears
  broken-after-login.
- **H6 — Supabase OTP send rate limit during testing.** Default project caps
  (per-hour magic-link sends) surface as raw `error.message` in the login banner
  and look like a broken login to the team while debugging.

### Auth-adjacent code-level notes

- `app/login/page.tsx:11` decodes and renders arbitrary `?error=` text into the
  page (React-escaped, so no XSS, but attacker-craftable content in an official-
  looking error card; low severity).
- `proxy.ts` runs a Supabase `getUser()` network round-trip on every matched
  request including prefetches — latency tax on every navigation.
  `[NEEDS RUNTIME VERIFICATION]` for measured impact.
- `lib/supabase/server.ts:20` swallows cookie-write failures with only
  `console.error` — correct for RSC contexts, but it means a real cookie problem
  degrades silently.
- Session-less server actions each re-implement `requireUser()`
  (`app/dashboard/actions.ts:32-39`, `app/gym/actions.ts:15-22`,
  `app/health/actions.ts:11-18`, ...) — duplication, no central auth helper.

## A5. Feature inventory

### Tasks / todos — grade: buggy (engine dead, UI mock)

- What exists in code: a complete, tested, state-aware daily-task engine —
  generation per State (`lib/tasks/generator.ts:63-118`), adaptive load
  (`:126-141`), in-presence load from calendar (`:149-164`), carry-over bumping,
  rollover, manual add, toggle-with-event-recording, streak recompute with
  protected states (`app/dashboard/actions.ts:107-498`).
- What actually runs: none of it. Zero call sites for `generateTodayTasks`,
  `rolloverYesterday`, `toggleTask`, `addManualTask`, `saveMood`,
  `chooseIntervention` (verified by grep across `app/` and `lib/`). The dashboard
  renders `MOCK_HEAVY_TASKS`/`MOCK_DAILY_STACK` with throwaway client state. The 9
  components that used to wire it (`add-task-form`, `todays-tasks`, `mood-slider`,
  `monthly-targets`, `intervention-menu`, `why-panel`, `streak-badge`,
  `state-badge`, `todays-call`) are imported nowhere.
- Reads/writes when it ran: `daily_tasks`, `user_states`, `user_streaks`,
  `user_modules`, `custom_modules`, `custom_module_entries`, `user_events`.
- Gaps vs target: no natural-language quick-add, no times/dates on tasks (only
  day + HEAVY/MEDIUM/LIGHT weight — by design, "iron rule" 1), no subtasks, no
  tags, no reorder, no swipe gestures, no undo. Titles are hardcoded personal
  Italian strings inside the generator (`lib/tasks/generator.ts:71-116`) — the
  "smart tasks" concept is a different product than this state-machine generator.

### Gym / workout — grade: OK (current flow), buggy (legacy residue)

- `/gym` logs one session per day (muscle-group chips, duration, notes) into
  `gym_sessions` with zod validation and edit/delete; week/month stat strip.
- Legacy per-exercise system (`gym_workouts`, Brzycki 1RM in `lib/fitness.ts`)
  has no writer but is still read by `/body` (frozen stats) and
  `lib/insights/run.ts:81` (PR insight computed over data that stops growing).
- Gaps vs target: no workout plans, no exercise library, no per-set/rep/weight
  logging in the current model (the legacy model had exercise/weight/reps —
  richer than its replacement), no rest timer, no progress charts beyond
  sparkline, no PRs in the live path.

### Calendar / planning — grade: OK (read-only V0)

- `/agenda`: local events (a `custom_modules` kind=calendar auto-created holder)
  merged with read-only Google Calendar import; OAuth flow is production-grade
  (encrypted tokens, CSRF, refresh); manual "Sincronizza" only — no auto-sync,
  no webhooks/watch channels; `[-7d, +30d]` window (`agenda/actions.ts:64`).
- No week/month grid view — a linear day-grouped list only. No event editing of
  Google events (by design). Local quick-add is date+title only (native date
  input). No iCloud/CalDAV.
- The in-presence detection (`lib/calendar/in-presence.ts`) keyword-matches
  Italian university terms ("lezione", "esame", "aula"...) — personal-use logic
  hardcoded in a lib.

### Stats / dashboard — grade: buggy/mock

- The dashboard IS the stats surface today and it is mock (see A2).
- `/insights` computes real patterns (weekly rhythm, sleep vs completion,
  streak record, target trajectory, gym PRs, module heat) on demand — decent
  detector code (`lib/insights/compute.ts`) undermined by render-time writes, a
  write-only cache table, and the dead `gym_workouts` dependency.
- `/recap` and `/timeline` are real and work. Esami and sera never record
  events, so both are invisible in timeline/insights
  (`lib/events/record.ts` EventKind union has no esami/sera kinds).

### Settings — grade: OK

- State switcher, goals CRUD, targets CRUD, onboarding re-entry. Native
  controls throughout; no delete confirmations; hardcoded `studio` option bug
  (`settings/targets/page.tsx:124`).

### Other modules present beyond the brief

- **Overseer AI chat** (floating overlay on every authenticated screen; streams
  Sonnet responses with a 7-table context prompt) — OK, gated by
  `ANTHROPIC_API_KEY`.
- **Voglia Engine** (slip detection + interventions, a README headline feature)
  — dead: `lib/voglia/detection.ts` and `lib/voglia/compute.ts` are imported by
  nothing; `voglia_detections` written by nothing; `getOrCreateTodaysCall` (the
  real LLM Today's Call) has zero call sites — only the stub is used, with mock
  inputs.
- **Business/Chameleon OS** (whitelist-gated milestones + partner sync) — OK.
- **Custom modules** (counter/streak/numeric/calendar trackers) — OK, the most
  coherent CRUD in the app.
- **Sera** evening journal with Google Drive markdown export — ugly but real.
- **Esami** exam tracker with chapter pacing — real, minor bugs.
- **Commute** — dead placeholder screen plus working localStorage toggle.

## A6. Cross-cutting concerns

- **Dead code, systemic.** The single largest quality issue. Fully dead: 9 of 12
  dashboard `_components`, all six task-engine server actions plus their helper
  graph (~600 lines in `app/dashboard/actions.ts` — only `signOut` is live),
  `lib/voglia/detection.ts` + `compute.ts`, `getOrCreateTodaysCall`, legacy gym
  actions (`app/gym/actions.ts:239-309`), `updateExamProgress`
  (`esami/actions.ts:158-196`), `completeOnboarding` (`onboarding/actions.ts:215-217`),
  `MetricTile` component, `partitionByCutoff` (`lib/agenda/merge.ts:115`),
  `CommuteToggleStateSchema`, 2 of 5 insight evidence kinds, `DAILY_STACK_PRESETS`
  and most of `lib/mock-data.ts` beyond the dashboard mocks.
- **Mock data on the primary screen.** `/dashboard` (the "Main" tab) is a design
  mock wearing the user's display name (`dashboard-client.tsx` throughout).
- **Duplication.** `requireUser()` re-implemented in 7+ action files
  (`dashboard/actions.ts:32`, `gym/actions.ts:15`, `health/actions.ts:11`,
  `finance/actions.ts:11`, `finance/expense-actions.ts:26`, `esami/actions.ts:13`,
  `sera/actions.ts:16`, `custom/actions.ts:11`); the auth+onboarding page guard
  copy-pasted into every page; 3+ date formatters with inconsistent UTC anchoring
  (`T12:00:00Z` vs `T00:00:00Z` vs bare local — `recap/page.tsx:233` and
  `health/page.tsx:290` are off-by-one risks); two divergent `startOfIsoWeek`
  (`gym/page.tsx:54-59` vs `body/page.tsx:239-244`); three module-label/tone/emoji
  registries (`timeline/page.tsx:22`, `lib/types.ts:26`, `lib/mock-data.ts`
  `emojiForModule`); `WATER_TARGET_ML` in two files; localStorage key literal in
  two files; `trimmedOptional` in two validation files.
- **Error handling is three different regimes.** (1) silent: log + revalidate,
  user sees nothing — finance/esami/gym/sera-checkin (dominant pattern);
  (2) throw: raw `Error` to the root error page — health, chameleon, custom;
  (3) typed error slugs surfaced in UI — only the sera Drive diary
  (`journal-editor.tsx:206-215`). No toasts, no inline field errors, no
  `useFormStatus` pending states anywhere except the Overseer chat.
- **Loading states.** One root `app/loading.tsx` skeleton shaped like the
  dashboard; zero per-route `loading.tsx`/`error.tsx`; server-action submits give
  no feedback until the full page revalidates.
- **Empty states.** Genuinely good coverage — every list has considered Italian
  empty copy (verified per module in A5 sources).
- **Accessibility (code-level).** Positives: global `:focus-visible` ring
  (`globals.css:128-132`), `prefers-reduced-motion` handling (`globals.css:188-198`),
  pinch-zoom allowed (`layout.tsx:27-36`), aria-labels/fieldsets present, custom
  controls carry `role="radio"` etc. Negatives: pervasive 10-11px type
  (`bottom-nav.tsx:105`, section headers) below comfortable reading sizes;
  color-only tone signals in places; `<details>`-based disclosure works but
  focus order after server-action reloads unverified `[NEEDS RUNTIME VERIFICATION]`.
- **Responsiveness.** Strictly mobile-first `max-w-md` center column on every
  screen; on desktop the app is a phone-width strip — acceptable for personal
  use, but a rebuild should decide this deliberately.
- **Performance smells.** `proxy.ts` does a Supabase `getUser()` round trip on
  every matched request; `/insights` runs 6 queries + delete + insert per render;
  `/agenda` and `/dashboard` do sequential dependent queries; no caching
  directives anywhere (every page dynamic). Fine at n=2 users; noted for the
  rebuild.
- **Conventions.** Mixed English/Italian identifiers and comments; module docs
  reference internal review tags ("Closes ECC S1 TS-M2") that have no meaning in
  the repo; `.DS_Store` tracked at repo root.

## A7. Security red flags

- **No committed secrets found.** Tracked files greped for common key shapes
  (`sk-ant-`, JWT `eyJhbGciOi`, `AIza...`, PEM headers): clean. `.env.local`
  exists locally but is gitignored (`life-os/.gitignore` `.env*`); only
  `.env.local.example` (empty values) is tracked. Env var names inventoried in
  Pre-flight.
- **Endpoints.** `/api/overseer`: auth 401 + 20/min rate limit + 50KB payload cap
  + history truncation + `max_tokens` 1024 — good; content-length check
  bypassable if header omitted (H, low impact) (`route.ts:63`).
  `/api/auth/google/*`: CSRF state cookie (httpOnly, 10min), timing-safe
  comparison, error-slug allowlist, AES-256-GCM encrypted tokens at rest,
  best-effort revoke on disconnect — strongest area of the codebase.
- **Server actions are unthrottled** — notably `signIn`
  (`app/login/actions.ts`): magic-link send spam is bounded only by Supabase
  project rate limits.
- **Reflected content:** `/login?error=` is decoded and rendered inside the
  error card (React-escaped; content-injection/phishing nuisance only)
  (`app/login/page.tsx:11,70`).
- **CSP** includes `script-src 'unsafe-inline' 'unsafe-eval'`
  (`next.config.ts:27`); the comment justifies `unsafe-inline` for Next runtime,
  but `unsafe-eval` in production is broader than needed
  `[NEEDS RUNTIME VERIFICATION]` whether prod build actually requires it.
- **RLS** consistently per-user on all user tables; deny-all policies on admin
  tables (0009); column-scoped UPDATE grants keep `is_owner`/`email`
  service-role-only (0018). Good.
- **Open-redirect** hardened via `safeNext` allowlist on both auth landing
  paths.
- **Destructive actions without confirmation** (A2) are also a data-loss
  security concern for a life-data app.
- **Sentinel CI step** (`scripts/check-sentinels.mjs`) greps for personal-data
  strings scrubbed during share-prep — but CI never runs on GitHub (workflow
  location), so the guard is advisory-only today.

## A8. Dependency review

Runtime dependencies (8): `next 16.2.6`, `react`/`react-dom 19.2.4`,
`@supabase/supabase-js ^2.105.3`, `@supabase/ssr ^0.10.3`,
`@anthropic-ai/sdk ^0.95.1`, `zod ^4.4.3`, `server-only ^0.0.1`.
Dev (10): TypeScript 5, Tailwind v4 + `@tailwindcss/postcss`, ESLint 9 +
`eslint-config-next`, Vitest 3 + coverage, type packages.

- **Lean and healthy.** No UI kit, no date library, no chart library — all
  hand-rolled (SVG sparklines/rings in `components/ui/`). Nothing abandoned,
  no known-CVE packages; the previously risky `next-pwa@5` was already removed
  (README Notes). `npm outdated` returned empty in this sandbox
  `[NEEDS RUNTIME VERIFICATION]` — treat as "no glaring staleness" pending a
  networked check.
- **Watch items.** `@anthropic-ai/sdk` is pre-1.0 (`^0.95.1`) — API surface can
  drift; model IDs pinned in `lib/anthropic/client.ts:21-23`: Haiku
  `claude-haiku-4-5-20251001` (valid dated snapshot) and Sonnet
  `claude-sonnet-4-6` (bare alias — verify it resolves; if the alias is ever
  retired the Overseer 500s at runtime) `[NEEDS RUNTIME VERIFICATION]`.
  `server-only` is imported by server-side libs and aliased to a no-op in
  vitest (`vitest.config.ts:24-36`) — fine.
- **Unused:** none of the runtime deps are unused. Dev script
  `scripts/fix-and-test.mjs`, `scripts/run-0004.mjs`, `scripts/setup-git.mjs`
  are one-shot artifacts worth pruning in a cleanup phase (not dependencies,
  but ops surface).

## A9. Confidence appendix — weakest claims and how to confirm them

| # | Claim | Confidence | Runtime check that would confirm |
| --- | --- | --- | --- |
| 1 | A4-H1: magic-link failures are dominated by cross-context PKCE (different browser/device, PWA cookie jar) | Medium-high (classic pattern; code shows no token_hash fallback) | Request link on device A, open on device B; open from installed iOS PWA; inspect `/login?error=` message text |
| 2 | A4-H5: some live Supabase project is missing later migrations (0016-0018), causing post-login loops | Medium (0018's own header documents the class) | Run `scripts/verify-schema.mjs` against both live projects |
| 3 | CI never runs on GitHub because the workflow is nested | High (structural) | Check repo Actions tab; move file to root `.github/` and observe |
| 4 | `/body` gym stats frozen because `gym_workouts` has no writer | High (grep-verified) | Log a session via `/gym`, reload `/body`, observe zeros |
| 5 | Insights PR card drifts (window anchored to last workout) | Medium | Seed `gym_workouts` with old rows, load `/insights` |
| 6 | Agenda multi-account breakage via `.maybeSingle()` | Medium (depends on Supabase error behavior for >1 row) | Connect two Google accounts, reload `/agenda` |
| 7 | Add-expense silent no-op without category chip | Medium-high (schema requires category; form omits input) | Submit expense with amount only; watch network + list |
| 8 | `claude-sonnet-4-6` model alias resolves | Unknown | Curl the Anthropic models endpoint with the project key |
| 9 | Overseer content-length bypass | Medium (depends on runtime always setting header) | POST without Content-Length via curl --http1.1 chunked |
| 10 | `prefers-reduced-motion`/focus behavior after server-action reloads | Low-stakes unknown | Manual device pass with VoiceOver/reduced motion |
| 11 | `npm outdated` cleanliness | Unknown (sandbox) | Run on a networked machine |
| 12 | Proxy `getUser()` latency tax is acceptable | Unknown | Vercel logs / web vitals after deploy |

## Audit summary (the one-paragraph version)

The codebase is far better engineered than "poor quality" suggests at the
infrastructure level — RLS everywhere, encrypted OAuth tokens, CSRF discipline,
zod at several boundaries, real tests for lib logic, thoughtful comments — but
the product surface is broken in a specific, fixable way: **the main dashboard is
a mock**, the entire task/streak/mood/intervention engine behind it is dead code,
two modules (gym, finance) have split-brain double data models, one route is a
placeholder, and quality patterns (validation, error feedback, date handling,
labels/tones) diverge per module because there is no shared foundation layer.
The rebuild should keep the DB schema core, the auth hardening, and the Google
integration, and rebuild the product surface on a designed component system with
a storage abstraction that supports guest-first use.

<!-- SECTION-MARKER: appended sections follow -->
