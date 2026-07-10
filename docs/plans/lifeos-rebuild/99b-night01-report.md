# Night Session 01 — Report

**Date:** 2026-07-10 (overnight)
**Model:** Fable 5, effort max
**Outcome: STOPPED AT PRE-FLIGHT GATE. No work was started.**

No branch was created, no dependencies installed, no code written, nothing committed. The only file produced by this session is this report.

---

## What the pre-flight gate found

The session brief states: "Session 00 (audit + blueprint + Ember foundation) is complete and has been committed and merged by Davide." That premise does not match the repository state.

### Gate 1 — clean tree: FAILED

`git status --porcelain` is not empty:

```
?? docs/
?? life-os/app/dev/ui/
?? life-os/ui/
```

### Gate 2 — session 00 in HEAD: FAILED

- Current branch: `feat/00-audit-blueprint` (the session-00 working branch, not `main`)
- HEAD: `e173b58` — `fix: migrazione 0018 grant profiles per authenticated`
- `main` also points at `e173b58`; the feature branch has **zero commits over main**
- `life-os/ui/ember.css` — exists on disk, **not in HEAD, not in main**
- `docs/plans/lifeos-rebuild/01-blueprint.md` — exists on disk, **not in HEAD, not in main**

Conclusion: session 00 was never committed anywhere. Its entire output sits as untracked files in the working tree.

### Inventory of the untracked trees (all session-00 deliverables, intact on disk)

- `docs/plans/lifeos-rebuild/` — 19 files: `00-audit.md`, `01-blueprint.md`, stubs `02`–`17`, `99-session-report.md`
- `life-os/ui/` — 26 files: `ember.css`, `index.ts`, `cx.ts`, `internal.tsx`, `calendar-core.ts`, and 21 components (button, input, select, checkbox, radio, switch, field, modal, bottom-sheet, toast, tabs, date-picker, time-picker, calendar, command-palette, empty-state, skeleton, progress, stat-card, chart-frame)
- `life-os/app/dev/ui/` — 2 files: `page.tsx`, `showcase.tsx` (the component showcase route)

Nothing has been lost or modified; the tree was left exactly as found.

---

## Why the session stopped here

The pre-flight rules are explicit: a non-empty `git status --porcelain` means STOP immediately (rule: "This protects against building on an unreviewed tree"), and session-00 files missing from HEAD means STOP ("session 00 was not merged"). Both conditions fired.

Proceeding anyway would also have broken the session mechanics downstream:

1. Every checkpoint audits `git status --porcelain` against the union of the prompt fences. `docs/`, `life-os/ui/`, and `life-os/app/dev/ui/` are outside all three fences, so every checkpoint would have failed from the start.
2. The morning commit map depends on night-01 work being cleanly separable. Building on top of an uncommitted session-00 tree would have commingled unreviewed foundation work with three new concerns in one dirty tree.
3. Prompt C's shell imports `@/ui` — building against a component library that exists only as unreviewed untracked files would bake in whatever review changes Davide still wants to make to it.

Baseline health checks (lint, tsc, build, test) were **not** run: the gate failed at step 1, and those checks come after it.

---

## Recommended morning path

1. Review the session-00 tree (it is all still untracked, nothing touched).
2. Commit it — suggested split, on `feat/00-audit-blueprint`:
   - `docs(plan): lifeos rebuild audit, blueprint, and session stubs` → `docs/plans/lifeos-rebuild/`
   - `feat(ui): Ember component library foundation` → `life-os/ui/`
   - `feat(dev): /dev/ui component showcase` → `life-os/app/dev/ui/`
   (This report file, `99b-night01-report.md`, can ride with the docs commit or be dropped.)
3. Merge to `main`.
4. Re-run the night-01 brief unchanged from the clean tree — the three prompts (A: storage ports + Dexie adapter, B: `lib/nlp-it` parser, C: `(app)` shell + Today skeleton) remain fully executable as written.

---

## Not done (deliberately)

Everything: Prompt A (storage), Prompt B (parser), Prompt C (shell), branch `feat/night-01`, baseline checks, dependency installs. All blocked by the pre-flight gate, none attempted.

---

## Run 2 — 2026-07-10

**Model:** Fable 5, effort max. **Session:** unattended re-run of the night-01 brief after Davide committed and merged session 00.

### Pre-flight gate: PASSED

- `git status --porcelain`: empty (clean tree).
- Branch at start: `main`, HEAD `f9bd387` ("Merge branch 'feat/00-audit-blueprint'").
- Session 00 verified IN HEAD via `git ls-files`: `life-os/ui/ember.css`, `docs/plans/lifeos-rebuild/01-blueprint.md`, `00-audit.md`, and this report file all tracked.
- Working branch created: `feat/night-01`.
- Baseline health, all four green before any new code:
  - `npm run lint` — clean
  - `npx tsc --noEmit` — clean
  - `npm run build` — succeeds (webpack build, all routes compiled)
  - `npm test` — **22 files, 322 tests, all passing** (baseline test count)
- `00-audit.md` and `01-blueprint.md` read in full before any code, per brief.

Prompt sections follow; each appended after its checkpoint.

### Prompt A — Storage ports + Dexie local adapter: DONE (checkpoint green)

**What was built** (`life-os/data/`, library only — nothing in `app/` imports it, grep-verified):

- `data/result.ts` — `Result<T>` convention (B3.7): `ok/err/isOk` helpers plus `attempt()`, the adapter wrapper that converts any unexpected Dexie exception into `err("storage")` so no storage failure ever throws at the UI.
- `data/schemas.ts` — zod v4 schemas as the single source of entity types (`z.infer`): Task (subtasks as flat checklist, module_link, P1–P3, tags, sort_order), LocalEvent, GymExercise / GymPlan / GymSession / GymSet, Reminder, Settings. Every entity carries `created_at`/`updated_at`/`deleted_at`. Create/Patch input schemas derived per entity (patch distinguishes "absent = don't touch" from explicit null).
- `data/ids.ts` — UUIDv7 per RFC 9562 implemented directly (`crypto.randomUUID` produces v4, which does not sort — so no shortcut was possible). Strictly monotonic in-process: 12-bit counter in rand_a, +1 ms borrow on overflow (RFC 9562 §6.2), robust to clock skew.
- `data/db.ts` — Dexie schema v1, 8 tables, indexes matched to blueprint query patterns (`[date+status]` for tasks, `date` for events/sessions, `exercise_id`/`session_id` for sets, `fire_at` for reminders) and `updated_at` on EVERY table for the future sync engine's "changed since X" reads.
- `data/ports.ts` — `TasksRepo`, `EventsRepo`, `GymRepo`, `StatsRepo`, `RemindersRepo`, `SettingsRepo` interfaces + `Repos` bundle. Pure TypeScript, zero Dexie imports.
- `data/local/` — adapters implementing every port (`tasks.ts`, `events.ts`, `gym.ts`, `reminders.ts`, `settings.ts`, `stats.ts`, `util.ts`, `index.ts` factory `createLocalRepos`). Soft delete = tombstone; every read filters tombstones; every write bumps `updated_at`.
- `data/hooks.ts` — `"use client"` live-query hooks over the ports: `useTasks(day)`, `useOverdueTasks`, `useInboxTasks`, `useUpcomingTasks`, `useEventsRange`, `useGymSessionsRange`, `useSettings`, plus `appRepos()` as the single future swap-point for the synced adapter.

**Decisions taken**

1. **Live-query mechanism: `dexie-react-hooks` kept** (the brief's stated preference). Verified before adopting, not assumed: the package's source has an explicit SSR guard (`typeof window !== 'undefined' // Don't do this in SSR`) with subscription in `useEffect`, peer deps `react >=16` cover React 19, and v4.4.0 is versioned in lockstep with Dexie 4. During server prerender of client components the hooks return `undefined` (= skeleton state). No type friction with React 19: tsc clean.
2. **Client-only guard for `db.ts`: capability check, not window check.** `getDb()` throws unless `typeof indexedDB !== "undefined"`. Rationale: the same code path works in the browser AND in vitest node with `fake-indexeddb/auto` (which defines `indexedDB` but not `window`). Module import instantiates nothing (RSC-safe); tests bypass the singleton entirely with `new LifeosDb("unique-name")`.
3. **snake_case entity fields** (`sort_order`, `completed_at`, …): matches the blueprint's own field naming and means future Supabase columns map 1:1 with no rename layer in the sync engine.
4. **Gym sets as a separate table** rather than embedded in sessions: per-exercise history and PRs (prompt 10, "computed from sets, not cached") become index reads on `exercise_id` instead of full-session scans. Session soft-delete tombstones its sets in the same transaction.
5. **Monotonic write clock**: default clock guarantees strictly increasing `updated_at` even for same-millisecond writes (LWW without ambiguous ties); injectable in adapters for deterministic tests.
6. **`SettingsRepo.get()` never writes**: missing row returns `DEFAULT_SETTINGS` with epoch timestamps ("never persisted" — loses LWW to any real write, which is correct); the row is born on first `update()`. No write-on-read surprises in render paths.
7. **StatsRepo kept deliberately minimal** (tasksSummary, overdueCount, completionByDay, gymVolumeInRange): the streak engine with protected days and timezone-day semantics is prompt 11's job; inheriting a wrong semantic now would be worse than a small port.
8. **Dexie null-index caveat documented in code**: null `date`/`deleted_at` don't enter indexes, so Inbox and tombstone filtering use scan-filters — the right trade at personal-app scale.

**Anchored edit — `life-os/vitest.config.ts`** (the one permitted config edit, flagged as the brief requires; unavoidable because the include pattern only matched `lib/**` and the fence places tests in `data/**`):

Before:
```ts
    include: ["lib/**/*.test.ts"],
```
After:
```ts
    include: ["lib/**/*.test.ts", "data/**/*.test.ts"],
```

**Dependencies added** (the allowed set, nothing else):
- `dexie` 4.4.4 (runtime) — the IndexedDB layer B3.1 asks for by name.
- `dexie-react-hooks` 4.4.0 (runtime) — live-query hooks; justification in decision 1.
- `fake-indexeddb` 6.2.5 (dev) — IndexedDB in vitest node; imported via `fake-indexeddb/auto` inside the test files themselves.
- `npm audit` note: the 9 reported vulnerabilities all pre-date this session (next, vitest, postcss chains — verified via audit package list); none introduced by the three additions.

**Tests**: 10 new files, 67 new tests, all passing — CRUD per repo, tombstone semantics (invisible to reads, physically present, purge respects the age threshold), `updated_at` bumping, idempotent complete/softDelete, reorder skip-unknown-ids, cursor-paged Done archive, UUIDv7 format/monotonicity/uniqueness/clock-skew, schema-bump v1→v2 with data survival and a working new index. Suite: **322 → 389 tests, 32 files, green**. Lint/tsc/build green. `git status` audit: only fenced paths touched.

### Prompt B — Italian NL parser `lib/nlp-it`: DONE (checkpoint green)

**What was built** (`life-os/lib/nlp-it/`, five source files + two test files):

- `types.ts` — the public contract exactly per brief: `parse(input, { now, timeZone }) => ParseResult`; `Fragment` spans (start inclusive, end exclusive) over the ORIGINAL input with `display` as the ready-to-render chip label ("ven 17 lug", "18:30", "P2", "#spesa", "Palestra").
- `civil.ts` — the timezone-safety core: `todayInTimeZone` extracts the civil date of the injected instant via one `Intl.formatToParts` call (locale-independent), and ALL other date math (domani, "tra 3 giorni", next-lunedì) is pure integer arithmetic on {y,m,d} triples via Hinnant's civil_from_days/days_from_civil. A civil day is always +1 regardless of 23/25-hour DST days — the parser is DST-immune by construction, not by patching. Invalid timezone degrades to UTC (never throws).
- `matchers.ts` — the v1 grammar. JS `\b` is ASCII and silently fails after accented vowels (`lunedì\b` never matches at word end), so word boundaries are built with a leading `(^|[^\p{L}\p{N}])` group + trailing lookahead — no lookbehind, ES2017-target-safe.
- `parse.ts` — orchestration: candidate collection with overlap masking, last-wins resolution, title assembly, catch-all safety net honoring the never-throw contract.
- `index.ts` — barrel.

**Grammar decisions documented** (each encoded in tests):

1. **Last-one-wins for single-value kinds** (date, time, priority): the fragment appearing last in the text wins; earlier matches revert to plain title text and produce NO fragment ("domani anzi il 20" → date = il 20, title keeps "domani anzi"). Tags are multi-value: all consumed, deduped case-insensitively (first spelling kept).
2. **Strictly-future convention** for weekday names, "weekend" (= next Saturday) and "il N": "venerdì" typed on a Friday means +7, "il 10" typed on the 10th means next month. "15/08" follows the brief's own rule instead (current year, roll only if strictly past — today counts as present); "29/02" advances to the first year where the date exists (2028), "31/04" never exists and stays title. "fine mese" = last day of the current month, even if that is today.
3. **"stasera"** = today + default time 20:00 (`EVENING_DEFAULT`, exported) only when no explicit time exists AND stasera wins the date contest; it stays ONE fragment — dismissing the chip discards date and time together, because "stasera" is one concept.
4. **Times**: bare numbers are never times; a bare hour needs "alle"/"h". "alle"/"h" prefixes are consumed inside the time span (title never keeps an orphan "alle"). "e mezza"/"e un quarto" extend bare-hour matches only. Hour validated ≤ 23 ("alle 25" stays title).
5. **Priority runs**: `!+` runs — 1 → P3, 2 → P2, ≥3 → P1, whole run consumed, last run wins so "ciao! fai la spesa!!" keeps "ciao!" as punctuation and reads P2.
6. **Module hint**: leading "palestra" produces a `module` fragment and `moduleHint: "gym"` but is NOT consumed — the word stays in the title, never swallowed silently.
7. **Known accepted ambiguities** (Todoist-class, chip is dismissible): "mar"/"ven" as standalone words parse as weekdays; "12.50" parses as 12:50. Explicit-year dates (15/08/2027) are out of the v1 grammar and stay title.

**Purity, verified**: non-test files import only sibling modules (grep: zero imports from `data/`, `app/`, or any package); zero dependencies added; `now`/`timeZone` injected everywhere, no environment reads.

**Tests**: 78 new (70 parse + 8 civil arithmetic), all passing on first run. The parse table has 61 cases covering: all date keyword forms, accented/unaccented/uppercase weekdays, all abbreviations (incl. "dom" ≠ "domani", "dopodomani" ≠ "domani"), tra-N-giorni, il-N, DD/MM with year rolls and leap-year skip, conflicting dates, all time forms incl. "e mezza"/"e un quarto" and invalid hours, priority runs, unicode tags with dedupe, module hint positive/negative, garbage in → full-string title, empty input, exact fragment spans verified character-by-character against the original string, same-instant different-timezone civil days (Rome vs New York), DST entry (March) and exit (October) day-accuracy, and year-boundary rollovers. Suite: **389 → 467 tests, 34 files, green**. Lint/tsc/build green. Fence audit clean (`lib/nlp-it/` only, plus report).

### Prompt C — App shell + Today skeleton: DONE (checkpoint green)

**What was built** (`life-os/app/(app)/`):

- `layout.tsx` — the (app) group shell: `em-scope` wrapper (Ember tokens live here and only here; legacy routes outside the group are untouched), Bricolage Grotesque bound via `--font-em-display` (same convention as `/dev/ui`), left rail on md+ with content centered in the remaining space, bottom tab bar on mobile.
- `_components/app-nav.tsx` — `TabBar` (mobile: fixed bottom, safe-area padding via `env(safe-area-inset-bottom)`, five 44px+ targets, 12px-floor labels), `Rail` (md+: vertical nav, Impostazioni anchored at the bottom), `MobileHeader` (wordmark + 44px gear affordance to Impostazioni). Active item marked with the ember dot (`em-dot em-dot--live`) and `aria-current="page"`; five slots: Oggi, Task, Calendario, Palestra, Statistiche.
- `_components/icons.tsx` — six inline stroke SVGs (currentColor, no dependency, no emoji).
- `page.tsx` — Today at `/`: REAL date header via `Intl` it-IT in the profile's timezone (fallback Europe/Rome), REAL greeting from `profiles.display_name` (plain "Ciao" when absent), four module sections (Task / Agenda / Palestra / Streak) as quiet EmptyStates naming the module that will bring them ("Arriva con il modulo Task." …), and the one-way bridge link "Vecchia dashboard" → `/dashboard` (legacy dashboard NOT edited; the reverse link is prompt 15). Deliberately NO `/onboarding` redirect — onboarding belongs to the legacy world; the page degrades gracefully with no profile row.
- `tasks/page.tsx`, `calendar/page.tsx`, `stats/page.tsx` — honest skeletons: title + EmptyState describing what the module will bring. No fake numbers, no mock stats, no placeholder cards pretending to be features.
- `loading.tsx` — group loading boundary shaped like Today (header + cards) on Ember `Skeleton`/`SkeletonText`, `aria-busy` container.
- `error.tsx` — group error boundary in Ember style with a "Riprova" primary Button wired to `unstable_retry()` — Next 16.2's documented recommendation over `reset()` (re-fetches and re-renders the segment; verified in `node_modules/next/dist/docs` per AGENTS.md before writing).

**Route-collision decision (conservative, per the collision rule)**: legacy `/gym` (real session logger, grade OK in the audit) and legacy `/settings` (+ `/settings/goals`, `/settings/targets`, all working) KEEP their paths and behavior untouched. The App Router would hard-error on duplicate resolved paths anyway, and replacing a working data-logging screen with an EmptyState skeleton would break a legacy surface — exactly what fails this prompt. So the new group creates only `/`, `/tasks`, `/calendar`, `/stats`; the "Palestra" tab and the "Impostazioni" affordances navigate to the legacy pages. The new gym/settings surfaces arrive with prompts 10 and B2.6 work, when they can supersede without breakage.

**Proxy scope note**: per the stub, ONLY `/` was added to protection (exact match — a prefix match on "/" would have protected every path including `/login`, causing a redirect loop). `/tasks`, `/calendar`, `/stats` are therefore currently public skeletons: they contain zero data and zero storage wiring (grep-verified: no `@/data` imports in the group), and prompt 07 makes the new surfaces properly guest-ready. This also made an honest served-HTML runtime check possible while logged out.

**"Skeleton shape" interpretation**: the static module pages render structure + EmptyState, NOT shimmer Skeleton blocks — a permanent shimmer on a static page would read as "loading forever", violating the honesty rule. The shimmer skeletons live in the group `loading.tsx`, where loading is real.

**Anchored edit 1 — `life-os/app/page.tsx` (REMOVED)**. App Router forbids two pages resolving to `/`; deleting the root page lets `app/(app)/page.tsx` own `/`. Entire previous content:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```
After: file deleted. (Behavior change: logged-in users landing on `/` now see Today with the bridge link instead of being bounced to `/dashboard`; logged-out users still end at `/login` via proxy.)

**Anchored edit 2 — `life-os/proxy.ts`**. Before:
```ts
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
```
After:
```ts
  const path = request.nextUrl.pathname;
  // "/" ora è Oggi (gruppo (app)) e resta protetta fino al guest mode
  // (prompt 07). Match esatto, non prefisso: ogni path inizia con "/".
  const isProtected =
    path === "/" || PROTECTED_PREFIXES.some((p) => path.startsWith(p));
```
`PROTECTED_PREFIXES` list, `AUTH_ONLY_PREFIXES`, the login redirect, and the matcher are all byte-identical to before.

**Runtime pass (dev server on :3111, logged out)**:
- `GET /` → 307 to `/login` (proxy protects the new Today) — verified
- `GET /login` → 200
- Legacy spot-checks `/dashboard`, `/gym`, `/settings`, `/agenda` → 307 to `/login` (proxy intact; routes compile in the production build, which builds every page)
- `GET /dev/ui` → 200
- New shell served HTML (`/tasks`, `/calendar`, `/stats`, all 200): **zero** `type="date"`, `type="time"`, `<select` occurrences; `em-scope`, ember dot, and all six nav hrefs present (tab bar + rail)
- New group source: zero `MOCK`/mock matches, zero hardcoded stat digit literals in JSX text, zero `@/data` imports

**Housekeeping note (artifact, not source)**: deleting `app/page.tsx` left stale generated route types in `.next/` (gitignored) referencing the removed file; `npm run build` regenerated the production types and the stale `.next/dev/types` was removed and regenerated by the dev-server run. No tracked file involved.

**Checks**: lint / tsc / build / test all green — suite unchanged at **467 tests, 34 files** (this prompt adds UI, not lib logic; its verification is the runtime pass above). Fence audit: only `app/(app)/`, the two permitted anchored edits, and the report.

---

### Run 2 — Closing summary

All three prompts of the night-01 brief completed, each checkpoint green, nothing committed (per session rules). The tree contains three cleanly separable concerns:

1. **Storage spine** (`data/`): ports + Dexie adapter with tombstones, `updated_at` LWW groundwork, UUIDv7, live-query hooks — 67 tests.
2. **Parser** (`lib/nlp-it/`): pure Italian NL quick-add parser, DST-immune by construction — 78 tests.
3. **Shell** (`app/(app)/` + 2 anchored edits): Ember navigation, honest Today, per-group boundaries, legacy untouched and verified reachable.

**Test counts**: baseline 322 (22 files) → final **467 (34 files)**, all green. Lint, tsc, build green throughout.

**Commit map for Davide** (three Conventional Commits, disjoint pathspecs):

1. `feat(data): storage ports + Dexie local adapter with tombstones`
   → `git add life-os/data life-os/package.json life-os/package-lock.json life-os/vitest.config.ts`
2. `feat(nlp): Italian natural-language parser for quick-add`
   → `git add life-os/lib/nlp-it`
3. `feat(shell): (app) route group with Ember nav and Today skeleton`
   → `git add "life-os/app/(app)" life-os/app/page.tsx life-os/proxy.ts`
   (the `life-os/app/page.tsx` pathspec stages its deletion)

This report file (`docs/plans/lifeos-rebuild/99b-night01-report.md`) can ride with any of the three or its own `docs:` commit.

**Dependencies added** (Prompt A only): `dexie` 4.4.4 (IndexedDB layer, named by the blueprint), `dexie-react-hooks` 4.4.0 (live-query hooks; SSR-safety verified in source before adopting), `fake-indexeddb` 6.2.5 dev (IndexedDB for vitest node). Nothing else.

**Deliberately NOT done** (scope fences, rule 6): tasks UI (06b), guest mode (07), sync engine (08), any legacy-page edit, any commit/push/tag. The `/dev/ui` showcase and all legacy routes are untouched.

**Recommended next sessions**: 03-auth-otp attended by day (Supabase dashboard template change requires Davide); then 06b tasks UI (consumes Prompt A's ports + Prompt B's parser + Prompt C's shell — all three of its dependencies now exist).
