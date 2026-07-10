<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LifeOS — house style for agents

The app lives at the **repository root** (moved out of `life-os/` in run-06). Run every
command from the root. LifeOS is a guest-first, local-first life dashboard: nine surfaces
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
- **Golden tests for derived ids.** `data/ids.ts#deriveUuidV8` (re-exported as `deriveId` from
  `app/(app)/gym/importer.ts`) is pinned byte-for-byte in `data/ids.test.ts` and
  `app/(app)/gym/importer.test.ts`. If those fail, every importer's idempotency is broken —
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
- **`lo_push` allowlist redeclaration.** Migrations 0021 / 0022 / 0023 each redeclare
  `lo_push_subscriptions` with a growing allowlist — apply them IN ORDER (0023 is final).
- **Duplicate 0016 migration.** Two files share the number 0016 (`0016_gym_sessions.sql` and
  `0016_remove_hardcoded_owner_email.sql`) — both must be applied.
- **Next 16 ≠ your training data.** Read `node_modules/next/dist/docs/` before writing Next code
  (see the top block). Example that already bit us: `turbopack.root` auto-detection after the
  repo-root move.
