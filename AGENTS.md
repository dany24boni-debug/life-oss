<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LifeOS — house style for agents

The app lives at the **repository root** (moved out of `life-os/` in run-06). Run every
command from the root. LifeOS is a guest-first, local-first life dashboard: fourteen surfaces
under the `(app)` shell, local data in Dexie behind `data/ports.ts`, LWW sync in `data/sync/`
mirroring to `lo_*` tables on Supabase. See `README.md` for the product + architecture map.

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | dev server (http://localhost:3000) |
| `npm run build` | production build (`next build --webpack`) |
| `npm start` | serve the production build |
| `npm test` | full Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run lint:sentinels` | sentinel grep (share-prep hygiene) |

CI (`.github/workflows/ci.yml`) runs lint · typecheck · sentinels · tests · build on push/PR to `main`.

## Working conventions (how changes are made here)

- **Scope fences.** Each task declares the exact files it may touch — stay inside the fence.
  Product-behavior changes are opt-in and explicit: if a step would change runtime behavior
  outside the sanctioned set, STOP and report instead of widening scope.
- **Anchored edits.** Quote the before/after for every pre-existing file you modify.
- **Grep-gated deletion.** Before deleting any file or export, grep the whole repo for its
  consumers and quote the grep. A live consumer outside the deletion set = don't delete; adapt.
- **Golden tests for derived ids.** `data/ids.ts#deriveUuidV8` (imported directly by every
  consumer since run-09; the old `deriveId` re-export from `app/(app)/gym/importer.ts` is
  retired) is pinned byte-for-byte in `data/ids.test.ts` and
  `app/(app)/gym/importer.test.ts`. If those fail, every importer's idempotency AND every
  derived-id convergence (sera/body/habit-log/slot-check/meal-log/task-recur) is broken —
  never "update" the expected UUIDs; fix the derivation.
- **Commit-per-prompt on run branches.** One Conventional Commit per prompt, only after a green
  checkpoint (lint · typecheck · build · test). Never commit on red.
- **Never push, never merge, never touch live Supabase/Vercel/GitHub.** No Management API runs
  against live projects, no migration application, no `vercel` CLI, no pushes to `main`. Those
  are the owner's gate, documented in the run reports under `docs/plans/lifeos-rebuild/`.

## Landmines (learned across runs — check before you trip them)

- **Stale `.next/dev` types after route changes.** Deleting or renaming a route can leave stale
  generated types under `.next/dev` that surface as phantom `tsc` errors. Ritual: `rm -rf .next`
  and rebuild — a fresh build regenerates the route types.
- **Italian number grouping.** `Intl.NumberFormat("it-IT")` does NOT insert a thousands
  separator below 10.000 by default (CLDR `minimumGroupingDigits=2`). Pass
  `useGrouping: "always"` when you need grouping under 10.000.
- **Service worker never caches redirected responses.** `public/sw.js` must not cache a response
  with `response.redirected === true` — caching a redirected response breaks navigation. Emergency
  kill-switch: deploy `public/sw-kill.js.txt` as `sw.js`.
- **`lo_push` allowlist redeclaration.** Every migration that adds SYNC tables redeclares
  the `lo_push` RPC with a growing allowlist (0021-0023, 0024-0029) — apply them IN ORDER;
  **0029 is final (28 tables)**. Pure ALTERs (0030, 0031) don't touch it. Full migration
  range as of run-09: **0001 → 0031** (with the duplicate 0016 below).
- **Duplicate 0016 migration.** Two files share the number 0016 (`0016_gym_sessions.sql` and
  `0016_remove_hardcoded_owner_email.sql`) — both must be applied.
- **Next 16 ≠ your training data.** Read `node_modules/next/dist/docs/` before writing Next code
  (see the top block). Example that already bit us: `turbopack.root` auto-detection after the
  repo-root move.
- **Chunk-measure method (run-08+).** Next 16 (webpack) no longer prints per-route "First
  Load JS": the honest size measure is the route client chunk,
  `.next/static/chunks/app/(app)/page-*.js` (raw bytes + gzip). Run-report budgets use this.
- **No sync setState in effects.** `react-hooks/set-state-in-effect` fires on synchronous
  `setState` inside `useEffect`. House idioms: module-level store + `useSyncExternalStore`
  (pwa-store, focus/use-focus) or a LAZY `useState(() => …)` initializer (SSR-guarded) for
  initial reads — and never `Date.now()`/`new Date()` in render (event handlers and lazy
  initializers only; ticking clocks live in interval effects, see settimana `useNowHhmm`).
- **Derived-id convergence recipe.** "One row per (entity, day/week)" derives the PK:
  `deriveUuidV8("lifeos:<prefix>:<parts>")` — sera-day, body-day, habit-log, slot-check,
  meal-log, task-recur. Every NEW prefix gets a byte-pinned golden in `data/ids.test.ts`.
  Un-doing travels by writing the neutral state on the SAME row (eaten:false, state:null),
  never by deleting. `crypto.subtle` is a native promise: derive ids BEFORE opening a Dexie
  transaction (inside, the transaction commits early).
- **Long-press pattern (run-08).** 450ms pointer-based long-press = secondary action (slot
  "saltato"), with keyboard fallback ("s") and an aria-label that declares the gesture —
  reuse settimana/week-board SlotRow before inventing a new gesture.
- **Deno exception (run-09).** `supabase/functions/**` is Deno: pinned `jsr:`/URL imports
  are the platform convention — the ONLY sanctioned dependency exception (`package.json`
  stays byte-identical). The folder is excluded from tsconfig/eslint; the platform validates
  it at deploy. Sessions never deploy: activation lives in
  `docs/plans/lifeos-rebuild/17-activation-checklist.md`.
- **Diet math is integer math.** kcal are integers, macros are INTEGER DECIGRAMS
  (`data/diet.ts`): one rounding in `itemTotals`, then only integer sums (the spese-cents
  lesson). Display divides by 10 at the very end (`formatGramsFromDg`), never mid-math.
- **Chunk residency (runs 11-13, measured four times).** webpack does NOT tree-shake exports
  between modules: every new export travels with its module into every chunk that imports it.
  A new export on a module the home imports = bytes on the frozen Oggi chunk. Known
  home-modules: `gym/logic`, `gym/card-history`, `stats/logic`, `corpo/logic`,
  `_components/*`. New derivations get their OWN module (precedents: `gym/pr.ts`,
  `stats/recap-logic.ts`, `corpo/trend.ts`). Honest A/B measurements: `git stash -u` +
  `rm -rf .next` + fresh build — an A/B with a dirty tree produced a false baseline once.
- **React.lazy, never next/dynamic, in the (app) group.** A second `next/dynamic` consumer
  materializes its interop shim INSIDE the home chunk (+78 B, measured run-12). Lazy bodies
  load on user gesture with `React.lazy` + `Suspense`; harden the factory with
  `.catch(() => ({ default: () => null }))` so a chunk that never arrives degrades instead of
  crashing the shell (run-13 P5c). Once loaded, keep sheets MOUNTED (ever-mounted gate) so
  exit animations survive close.
- **The motion layer (run-13).** Durations `--em-dur-tap/control/card/screen` + easings
  `--em-ease-out` (enters) / `--em-ease-in` (exits) / `--em-ease-in-out`; exits are SHORTER
  than enters and use the `em-*-out` keyframes; overlay primitives own a closing phase and
  unmount on `animationend` (+400ms timeout fallback). The reduced-motion gate in `ember.css`
  is property-based under `.em-scope *`: it covers every NEW animation automatically — never
  add a second gate, never bypass `.em-scope` (portals re-apply it). `.em-hit` grows a tap
  target to 44px with zero visual change (not on `<input>` — pseudo-elements don't render on
  replaced elements). Accent AS TEXT uses the `--em-*-text` variants, never the raw palette
  (raw fills fail AA in light theme).
- **Page width tokens (run-10).** Reading width is the default; a surface that SPENDS the
  width (boards, grids) sets `data-page-width="wide"` on its root and the shell opens to
  `--em-page-wide` (88rem) from md up via `:has()` — mobile never changes. Wide is per-view:
  /dieta flips it only on the Piano tab.
- **"Committato ≠ mergiato" (run-11 lesson, P0 pattern).** A run brief saying "run N is
  merged" is a claim to VERIFY: from `main`, `git ls-files docs/plans/lifeos-rebuild | grep
  <report-slug>`. Present → branch from `main`. Absent but the feature branch exists → branch
  from its tip and declare the lineage delta loudly (one merge then carries both runs).
