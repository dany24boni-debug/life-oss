# Run 06 — Dead Residue Cleanup + Repo Root Move + CI + Docs

**Model:** Opus 4.8, Effort Max. **Session:** unattended, auto mode.
**Branch:** `feat/run-06` (off `main` @ `d6bc83d`). Never pushed, never merged.
**Prime directive:** ZERO product-behavior changes, one sanctioned exception (proxy tidy, Prompt 1).

This report is fence-exempt and appended per checkpoint.

---

## Pre-flight gate

**1. Clean tree + run-05 in HEAD.**
- `git status --porcelain` on `main` → EMPTY. ✓
- `git ls-files` confirms run-05 artifacts present:
  - `life-os/public/sw.js` ✓
  - `life-os/app/(app)/sera/page.tsx` ✓
  - `life-os/supabase/migrations/0023_lo_sera.sql` ✓
  - `life-os/lib/auth/actions.ts` ✓
- Not STOP: run-05 is merged.

**2. Branch + HEAD recorded.**
- Starting branch: `main`, HEAD `d6bc83d6cf662b34efdc64e9af93de30430f12f4`.
- Created `feat/run-06` and switched to it.

**3. Baseline green (all from `life-os/`).**
- `npm run lint` → clean (no output). ✓
- `npx tsc --noEmit` → clean. ✓
- `npm run build` (`next build --webpack`) → success, all routes compiled. ✓
- `npm test` (`vitest run`) → **Test Files 55 passed (55) · Tests 656 passed (656)**. ✓
- Baseline test count: **656**. (Brief expected ~656.)

**4. Root inventory.**
- Tracked/present at repo root: `.DS_Store` (tracked — audit A6 finding), `docs/`, `life-os/`, `.git/`.
- Nothing else found at root. Matches brief expectation.

**Note on `life-os/` top-level scope (beyond brief's illustrative list).** The brief's
examples named a subset; the full tracked top-level set that will move in Prompt 2 is:
`.env.local.example`, `.gitattributes`, `.github/`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`,
`PARTNER-SETUP.md`, `README-START-HERE.md`, `README.md`, `app/`, `components/`, `data/`,
`eslint.config.mjs`, `lib/`, `next.config.ts`, `package-lock.json`, `package.json`,
`postcss.config.mjs`, `proxy.ts`, `public/`, `scripts/`, `supabase/`, `tsconfig.json`,
`ui/`, `vitest.config.ts`. Untracked essentials: `.env.local`, `node_modules/`, `.next/`,
`next-env.d.ts`, `tsconfig.tsbuildinfo`, `life-os/.DS_Store` (untracked).
Extras not enumerated in the brief but present and tracked: `ui/` (25 design-system files),
`.gitattributes` (private-boot merge=ours rule), `README-START-HERE.md`, `PARTNER-SETUP.md`.
All handled in Prompt 2.

Pre-flight PASS.

---

## Prompt 1 — Dead residue cleanup + proxy tidy

**Checkpoint:** lint ✓ · tsc ✓ · build ✓ · test **648 passed (54 files)**.

### Test-count reconciliation (656 → 648)
- **+3 golden** tests (added FIRST, before touching derivation code):
  - `data/ids.test.ts`: +2 (`deriveUuidV8` golden + shape/determinism).
  - `app/(app)/gym/importer.test.ts`: +1 (`deriveId` golden).
- **−7** `lib/validation/local-storage.test.ts` (whole file deleted).
- **−4** `lib/validation/form-inputs.test.ts` (2 `EveningCheckinSchema` + 2 `ToggleCarryoverSchema` its).
- Net: 656 + 3 − 11 = **648**. Files 55 → 54 (`local-storage.test.ts` gone).

### 1. Golden tests (id-derivation contract, pinned byte-exact)
Computed the current output of the live functions, pinned as literals, ran green against
the **un-refactored** code first:
- `deriveUuidV8("lifeos:sera-day:2026-05-02")` = `85c0bff0-b588-87da-af69-f7ced06a5cbb`
- `deriveUuidV8("lifeos-import:gym_sessions:aaaa1111-0000-4000-8000-000000000001")` = `91a203fa-12a1-8068-90be-8ea08215136a`
- `deriveUuidV8("prova:1")` = `05c038c1-68c7-8020-bc3b-1cb475fc165e`
- Same `…gym_sessions…` literal pinned in **both** `data/ids.test.ts` and `gym/importer.test.ts`
  → proves the two entry points are the same function post-unification.

### 2. Unified id derivation
`deriveUuidV8` (data/ids.ts) and `deriveId` (gym/importer.ts) were byte-identical (same
SHA-256 → 16 bytes → v8/variant → 8-4-4-4-12 hex; `format()` vs manual hex are equal). Kept
the single impl in `data/ids.ts`; deleted the duplicate body in the gym importer.

**Anchored edit — `app/(app)/gym/importer.ts`** (import added + duplicate replaced by re-export):
```
- export async function deriveId(key: string): Promise<string> {
-   const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
-   const b = new Uint8Array(digest).slice(0, 16);
-   b[6] = 0x80 | (b[6] & 0x0f); b[8] = 0x80 | (b[8] & 0x3f);
-   const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
-   return `${hex.slice(0,8)}-…-${hex.slice(20)}`;
- }
+ import { deriveUuidV8 as deriveId } from "@/data/ids";   // top of file
+ export { deriveId };   // re-export the canonical fn under the historic name
```
**Anchored edit — `app/(app)/calendar/importer.ts`** (fence: "import-source swap only"):
```
- import { deriveId } from "../gym/importer";
+ import { deriveUuidV8 as deriveId } from "@/data/ids";
```
`data/ids.ts` doc comment updated present-tense (now the single implementation).

**DELTA vs brief (documented).** The brief's fence named only gym + calendar, but the grep
below shows `deriveId` **also** consumed by `spese/importer.ts` and `esami/importer.ts`
(out of fence) and by the gym importer test:
```
$ grep -rn "deriveId" --include=*.ts .
app/(app)/spese/importer.ts:11:import { deriveId } from "../gym/importer";
app/(app)/spese/importer.ts:65:      id: await deriveId(`lifeos-import:personal_expenses:${row.id}`),
app/(app)/esami/importer.ts:12:import { deriveId } from "../gym/importer";
app/(app)/esami/importer.ts:64:      id: await deriveId(`lifeos-import:exams:${row.id}`),
app/(app)/calendar/importer.ts:16:import { deriveId } from "../gym/importer";   (swapped)
app/(app)/gym/importer.test.ts:5:  deriveId,                                    (unchanged)
```
Per the grep-gate rule (live consumers outside the deletion set → adapt, don't break), I kept
a one-line **re-export** of `deriveId` in `gym/importer.ts`. This deletes the duplicate *body*
(brief's requirement) while spese/esami and the gym importer test keep resolving to the single
canonical `deriveUuidV8` **with zero out-of-fence edits and all importer tests unchanged**.
A future cleanup could point spese/esami directly at `@/data/ids` and drop the shim.

All 4 importer test suites + ids test green after refactor (29 tests).

### 3. Dead residue deleted (each grep-gated)

**(a) `components/ui/todays-call-banner.tsx`** — only self-references, zero consumers:
```
$ grep -rn "todays-call-banner\|TodaysCallBanner" --include=*.ts* .
components/ui/todays-call-banner.tsx:1:// TodaysCallBanner — Pulse handoff §A.
components/ui/todays-call-banner.tsx:62:export function TodaysCallBanner({
```
→ whole file deleted (`git rm`).

**(b) diary section of `lib/validation/local-storage.ts` (`parseDiaryDraft`, `DiaryDraftSchema`)**
— consumers only the file + its test; no module-path importer anywhere:
```
$ grep -rn "parseDiaryDraft\|DiaryDraftSchema" --include=*.ts* .   → only local-storage.ts + .test.ts
$ grep -rn "validation/local-storage" --include=*.ts* .            → NONE (only the file + its test)
```
The commute section was removed in run-05, so the diary section is all that remained → the
whole file (and its all-diary test) is dead. **Deleted both files** (`git rm`).

**(c) `EveningCheckinSchema` / `ToggleCarryoverSchema` in `lib/validation/form-inputs.ts`**
— two schemas + their inferred types; consumers only their own test. IMPORTANT: a **different,
LIVE** `EveningCheckinSchema` exists in `data/schemas.ts` (used by `data/sync/tables.ts`) — NOT
touched. Guard grep confirmed `SaveDiaryEntrySchema`/`parseFormData` stay live (sera actions +
finance), so they were kept:
```
$ grep -rn "EveningCheckinSchema\|ToggleCarryoverSchema" --include=*.ts* .
lib/validation/form-inputs.ts        (defs — DELETED)
lib/validation/form-inputs.test.ts   (tests — DELETED)
data/schemas.ts:273 / data/sync/tables.ts:20,105  → the OTHER, LIVE schema — KEPT
$ grep -rn "EveningCheckinInput\|ToggleCarryoverInput" .   → only self-defs → deleted with schemas
$ grep -rn "SaveDiaryEntrySchema\|parseFormData" .   → sera/actions.ts + finance/expense-actions.ts → KEPT
```
Removed lines 98-110 of `form-inputs.ts` (short tombstone note left, house style) and the two
`describe` blocks + their imports from `form-inputs.test.ts`. `UuidSchema`/`trimmedOptional`
still in use → no orphaned helpers.

**(d) one-shot scripts.** Grepped package.json, CI yaml, docs, whole repo:
```
$ grep -rn "fix-and-test\|run-0004\|setup-git" .  (excl .git/node_modules)
scripts/setup-git.mjs:1,18   (self)
lib/modules/README.md:69:node --env-file=.env.local scripts/setup-git.mjs   ← LIVE doc reference
(fix-and-test, run-0004: NO references anywhere)
```
- `scripts/fix-and-test.mjs`, `scripts/run-0004.mjs` → zero references → **deleted** (`git rm`).
- **DELTA vs brief: `scripts/setup-git.mjs` KEPT.** Audit A8 listed it as one-shot, but it is a
  live ops script (registers the `merge=ours` driver that `.gitattributes` needs for the
  `private-boot.ts` personal↔shared branch split) and is documented in `lib/modules/README.md`.
  The brief's own keep-rule ("KEEP … any others referenced anywhere") + the grep-gate rule →
  keep it. (Also note: brief's keep-list says `diagnose-auth.mjs`; the actual file is
  `diag-auth.mjs` — same script, kept.)

### 4. Tracked `.DS_Store` + root `.gitignore`
- `git rm --cached .DS_Store` (root) — untracked (audit A6). File still on disk, now ignored.
- Created root `.gitignore` with `.DS_Store`. Will be unioned with `life-os/.gitignore` in Prompt 2.

### 5. Proxy tidy — the ONE sanctioned behavior change
**Verified first** (must not unprotect a route that renders real content): `app/dashboard/page.tsx`
is a pure `redirect("/")`; `app/agenda/page.tsx` is `redirect("/calendar")` (+ OAuth param
forward); no `/commute` route exists (404).

**Anchored edit — `proxy.ts`** (removed 3 entries from `PROTECTED_PREFIXES`, added rationale):
```
- const PROTECTED_PREFIXES = [
-   "/dashboard",
    "/onboarding", "/settings", "/recap", "/body",
    …
-   "/agenda",
    …
-   "/commute",
  ];
+ // "/dashboard" e "/agenda" rimossi … ora redirect server verso superfici PUBBLICHE
+ // (/dashboard → "/", /agenda → /calendar) … "/commute" rimosso: la rotta non esiste più (404).
```

**Runtime verification (dev on :3117 AND prod `next start` on :3118, logged-out / no cookies):**
| route | before (implied) | after — observed |
| --- | --- | --- |
| `/dashboard` | proxy 307 → `/login` | proxy passes; page redirect → `/` (`content="1;url=/"`, `NEXT_REDIRECT;replace;/;307;`) |
| `/agenda` | proxy 307 → `/login` | proxy passes; page redirect → `/calendar` |
| `/commute` | proxy 307 → `/login` | **404** (no auth wall) |
| `/health` `/settings` `/body` `/insights` (control) | 307 → `/login` | **307 → `/login`** (proxy still guards live legacy routes) |

(`redirect()` renders as HTTP 200 + meta-refresh in both dev and prod here — a Next streaming
detail, identical across modes, from the *page* not the proxy; the redirect *target* proves the
guest lands on the public surface, not `/login`.)

**Known stale comment, deliberately NOT edited (fence).** `app/dashboard/page.tsx`'s comment
still says "la protezione del proxy resta com'era (gli ospiti finiscono su /login…)", now false
for `/dashboard`. That file is outside the Prompt-1 fence; the authoritative rationale lives in
the `proxy.ts` comment. Flagged here for a trivial future one-liner (not touched to respect the
fence + zero-scope-creep rule).

### git status audit (Prompt 1)
6 deletions (`.DS_Store`, todays-call-banner, local-storage ×2, fix-and-test, run-0004),
8 modifications (ids ×2, gym importer ×2, calendar importer, form-inputs ×2, proxy), 2 new
(`.gitignore`, this report). `diff --stat`: 14 files, +70 / −421.

**Commit:** `chore(cleanup): unify id derivation with golden tests, delete dead residue, tidy proxy prefixes` → `a3ebfc8`

---

## Prompt 2 — The move: `life-os/` → repository root

**Checkpoint (from ROOT):** lint ✓ · tsc ✓ · build ✓ · test **648 passed (54 files)** — unchanged from Prompt 1.

### 1. Collision plan
Root before move (post-P1): `.gitignore`, `docs/`, `life-os/`. `comm -12` of the two
top-level sets found exactly **one** collision — `.gitignore` (expected; merged). `life-os/`
has no `docs/` → no clash with root `docs/`. No STOP.

### 2. Tracked entries moved (`git mv`, history-preserving)
24 tracked top-level entries `git mv`'d to root (dotfiles included): `.env.local.example`,
`.gitattributes`, `.github/`, `AGENTS.md`, `CLAUDE.md`, `PARTNER-SETUP.md`,
`README-START-HERE.md`, `README.md`, `app/`, `components/`, `data/`, `eslint.config.mjs`,
`lib/`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`,
`proxy.ts`, `public/`, `scripts/`, `supabase/`, `tsconfig.json`, `ui/`, `vitest.config.ts`.
Result: **387 rename (R) entries** in `git status`.

**`.gitignore` merge (union, quoted).** Root `.gitignore` (only `.DS_Store`) was overwritten
with the union of both — which is the app's comprehensive Next ruleset (already a superset
containing `.DS_Store`): `/node_modules`, `/.next/`, `/out/`, `/coverage`, `/build`,
`.DS_Store`, `*.pem`, debug logs, `.env*` (+ `!.env*.example`), `.vercel`, `*.tsbuildinfo`,
`next-env.d.ts`, `.claude/`. Deduped the source's doubled `.vercel`. Then `git rm
life-os/.gitignore`. (+44 / −1 on root `.gitignore`; −47 on the deleted app copy.)

### 3. Untracked essentials
- `mv life-os/.env.local .env.local` (Davide's live secrets — kept working).
- `mv life-os/node_modules node_modules` (rename on same FS; avoids reinstall; `npm ci` is the fallback).
- `mv life-os/next-env.d.ts next-env.d.ts` (gitignored, but tsc reads it; content is path-independent).
- `rm -rf life-os/.next` (regenerated; kills the known stale-`.next/dev`-types phantom-error ritual).
- `rm life-os/tsconfig.tsbuildinfo` (stale tsc incremental cache referencing old paths → clean typecheck).
- `rm life-os/.DS_Store` (untracked junk). Then `rmdir life-os` (verified empty).
- Post-move: `git ls-files life-os/` → EMPTY; `life-os/` dir gone.

### 4. Config fixes
**`next.config.ts` — `turbopack.root` removed (doc-based).** Consulted
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md`
§"Root directory": Next auto-detects the root via the lockfile (`package-lock.json`); the
manual `root` override is for "a different project structure … if you don't use workspaces".
Pre-move the app was nested (lockfile at `life-os/`, `.git` at the parent) and `root` was
pinned to `__dirname`. Post-move `next.config.ts` + `package-lock.json` + `.git` are co-located
at the repo root → auto-detection is correct → the override is redundant. Removed it and the
now-unused `import path`:
```
- import path from "path";
  const nextConfig: NextConfig = {
-   turbopack: { root: path.join(__dirname) },
+   // turbopack.root non serve più (run-06): l'app ora vive nella radice del repo … (doc-based)
    async headers() { … }
```
The build story is unchanged (`next build --webpack`).

**Verified (read, no fix needed — all relative, confirmed by the green build/test):**
`tsconfig.json` (`@/*` → `["./*"]`), `vitest.config.ts` (`path.resolve(__dirname,".")` +
`node_modules/server-only/empty.js`), `eslint.config.mjs`, `postcss.config.mjs`, `package.json`
scripts, `scripts/*.mjs` (no hardcoded roots; `run-migration.mjs` takes a cwd-relative arg),
`public/sw.js` (root-relative URLs), `manifest.webmanifest`.
A full `grep -rn "life-os"` over code/config/scripts found **no broken path references** — only
the npm package `name`, log labels (`app/error.tsx`, `setup-git.mjs`), prose comments, and
`PARTNER-SETUP.md`'s `cd life-os` clone-target (deferred to Prompt 4 per its fence).
`CLAUDE.md`/`AGENTS.md` had **zero** `life-os/` path refs → nothing to fix here.

### 5. Full verification from ROOT
- lint ✓ · tsc ✓ · build ✓ · test **648 (54 files)** — identical to Prompt 1.
- `next start` spot-pass (logged-out): `GET /` **200** · `/tasks` **200** · `/login` **200** ·
  `/sw.js` **200** (`application/javascript`) · `/manifest.webmanifest` **200**
  (`application/manifest+json`).
- `GET /dev/ui` → **200** locally (both `npm run start` and explicit `NODE_ENV=production npx
  next start`). The route has `if (process.env.NODE_ENV === "production") notFound()`, but this
  sandbox's local `next build`/`next start` don't reproduce the prod-`NODE_ENV` branch, so it
  renders the 200 playground — the brief's explicitly-accepted "200 in dev" outcome. This is
  **move-independent** (`git mv` preserved the route byte-for-byte, similarity 100%); on Vercel
  (`NODE_ENV=production` at build+runtime) the guard fires and 404s as documented. `/dev/components`
  behaves identically.

### Rename audit
```
$ git status --porcelain: 387 R · 1 D (life-os/.gitignore) · 2 content-M (.gitignore, next.config.ts)
$ git diff --stat --find-renames HEAD | tail -1
  389 files changed, 48 insertions(+), 52 deletions(-)
```
Only content changes: root `.gitignore` (+44/−1), `life-os/.gitignore` (−47 del), `next.config.ts`
(+4/−4). Everything else is a pure 0-line rename → "overwhelmingly R", consistent with the move
plus the two sanctioned config edits.

**Commit:** `chore(repo): move app from life-os/ to repository root` → `fd45df3`

---

## Prompt 3 — CI, alive at the root

**Checkpoint (from ROOT):** lint ✓ · typecheck ✓ · test **648 (54)** · build ✓.

### Why the CI was dead, and why it's alive now
GitHub Actions only discovers workflows in the **repo-root** `.github/workflows/`. Pre-run-06
the workflow lived at `life-os/.github/workflows/ci.yml` (nested) → never discovered → never ran
(audit A9 #3). Prompt 2 `git mv`'d `.github/` to the repo root, so GitHub will now discover it.
This prompt rewrites it correctly (adds the missing build step; routes typecheck through a script).

### 1. `typecheck` script (anchored, `package.json`)
```
  "lint:sentinels": "node scripts/check-sentinels.mjs",
+ "typecheck": "tsc --noEmit",
  "test": "vitest run",
```

### 2. `.github/workflows/ci.yml` rewritten
- **Triggers:** `push` → `[main]`, `pull_request` → `[main]`. (DELTA: narrowed from the old
  `[master, main, shared]` per the brief's "push to `main`"; `master` is dead, and `shared` can
  be re-added to the branch lists if the shared variant should get CI.)
- **Job:** single `verify` on `ubuntu-latest`.
- **Node:** `20` — matches `@types/node ^20` and the committed lockfile (no `engines` field);
  same major as the prior workflow.
- **Steps (brief order):** Checkout → Setup Node (`cache: npm`) → `npm ci --no-audit --no-fund`
  → `npm run lint` → `npm run typecheck` → `node scripts/check-sentinels.mjs` → `npm test` →
  `npm run build`. No deploy steps (Vercel deploys independently).

**Build step needs placeholder public env (discovered + solved).** An env-less `next build`
**fails**: the static `/offline` page constructs a Supabase browser client at prerender and
`@supabase/ssr` throws on empty url/key (`Export encountered an error on /(app)/offline/page`).
Verified locally: with `.env.local` moved aside, a build passes iff `NEXT_PUBLIC_SUPABASE_URL`
+ `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present. These are **public anon-tier values, not secrets**,
and the build never connects — so the Build step sets placeholder values inline:
```
      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
        run: npm run build
```
(`NEXT_PUBLIC_APP_URL` isn't needed — it has a `?? "http://localhost:3000"` fallback.)

### 3. Sanity
- **YAML valid** (parsed with `js-yaml`): `on` = push[main]+pull_request[main], `runs-on:
  ubuntu-latest`, `node-version: 20`, 8 steps in the expected order.
- **No `working-directory` / functional `life-os` remnants** (the only `life-os` strings are the
  explanatory header comment).
- **`npm ci --dry-run --no-audit --no-fund`** against the moved lockfile → success (117 packages,
  lockfile ↔ package.json in sync at root).

### 4. Davide's GitHub-side verification (cannot run in-session)
After merge + push of `main`: open the repo **Actions** tab and confirm this `CI` workflow runs
and goes **green** (lint · types · sentinels · tests · build). Only then is the audit's "dead CI"
finding (A9 #3) closed.

**Commit:** `ci: root workflow with lint, typecheck, sentinels, tests, build` → `c97f1f3`

---

## Prompt 4 — Docs that match reality

**Checkpoint:** lint ✓ · typecheck ✓ · sentinels ✓ (README scanned clean) · test **648** · build ✓.
Git diff is **docs-only** (`README.md`, `AGENTS.md`, `PARTNER-SETUP.md`, `.env.local.example`) —
no code touched.

### `README.md` — full rewrite (Italian)
The old README described the pre-rebuild app (Phases 1-8, dashboard mock, Voglia Engine,
legacy `/gym`/`/health`/`/finance`, `/agenda`). Replaced with the current reality:
- **What LifeOS is now**: guest-first, local-first; nine surfaces; sync for accounts.
- **Clean-clone setup**: `git clone`, `npm install`, `cp .env.local.example .env.local`, `npm run dev`;
  guest-mode works with zero Supabase config.
- **Env-var table** (what each does), incl. `SUPABASE_ACCESS_TOKEN` flagged **ops-only**.
- **Supabase migrations 0001→0023 IN ORDER** with `run-migration.mjs`, calling out the **duplicate
  0016** and the **`lo_push` redeclaration in 0021/0022/0023 (order matters)**.
- **Commands** (dev/build/start/test/typecheck/lint/lint:sentinels) — cross-checked against
  `package.json` scripts.
- **Architecture map** (~10 lines): `(app)` shell · `data/ports.ts` · `data/db.ts`+`data/local/`
  (Dexie) · `data/sync/` (LWW → `lo_*`) · `lo_*` tables · `lib/nlp-it` · `lib/reminders` ·
  `public/sw.js` + kill-switch pointer · importers in Impostazioni · `data/ids.ts`.
- **Deploy (Vercel)** with a **prominent ⚠️ Root Directory = `.`** callout.
- **Honest platform limits**: no active server push (`lo_push_*` written-but-unused), iOS PWA
  caveats, Google Calendar read-only V0.
- Honest note that the legacy D4 surfaces (`/business`, `/health`, `/insights`, … + Overseer)
  remain behind auth, untouched.

### `AGENTS.md` — house style added (Next.js docs block kept)
Kept the `nextjs-agent-rules` block verbatim; appended: the command set; working conventions
(scope fences, anchored edits, grep-gated deletion, golden tests for derived ids,
commit-per-prompt on run branches, never push/merge/touch-live-Supabase); and the landmine list
(stale `.next/dev` types ritual, Italian CLDR grouping `useGrouping:"always"` under 10.000, SW
never caches redirected responses, `lo_push` allowlist redeclaration, duplicate 0016, Next-16
docs-in-`node_modules`).

### `CLAUDE.md` — unchanged (by design)
`CLAUDE.md` is a one-line `@AGENTS.md` import (Claude Code convention). Enriching `AGENTS.md`
updates what `CLAUDE.md` delivers, with a single source of truth and no duplication. Left as-is.

### `PARTNER-SETUP.md` — targeted (per its narrow fence)
- Migration list extended `0017` → `0023` (adds 0018-0020 sync/push + 0021-0023 `lo_*`), with the
  duplicate-0016 + `lo_push`-order note.
- `# Type-check` command `npx tsc --noEmit` → `npm run typecheck`.
- CI line "push to `master`/`main`/`shared`" → "push/PR to `main`" (+ the 5 checks) — corrected
  the staleness Prompt 3 introduced.
- Its `git clone … life-os; cd life-os` (section 2) is now **correct** post-move (app at clone
  root) — left as-is. Its pre-rebuild app-description prose is out of this narrow fence and left
  untouched (candidate for a later refresh).

### `.env.local.example` — comment accuracy
Added an **ops-only comment** documenting `SUPABASE_ACCESS_TOKEN` (needed by the migration
scripts, previously undocumented in the template). Comment only — no new var line (fence).

### Out of fence, deliberately untouched
`README-START-HERE.md` (not in the Prompt-4 fence) still carries pre-rebuild prose — flagged for
a later pass; not edited here.

**Commit:** `docs: README, CLAUDE.md, AGENTS.md rewritten for the root-level rebuilt app`

---

## Final summary

### Test counts (baseline → final)
| Stage | Files | Tests | Δ |
| --- | --- | --- | --- |
| Baseline (`main`) | 55 | **656** | — |
| After Prompt 1 | 54 | **648** | +3 golden, −7 local-storage, −4 form-inputs = **−8** |
| After Prompts 2·3·4 | 54 | **648** | 0 (move/CI/docs don't change tests) |

Itemized P1 delta: **+2** `data/ids.test.ts` (deriveUuidV8 golden), **+1**
`app/(app)/gym/importer.test.ts` (deriveId golden); **−7** `lib/validation/local-storage.test.ts`
(deleted), **−4** `lib/validation/form-inputs.test.ts` (2 EveningCheckin + 2 ToggleCarryover).

### Commit log (`feat/run-06`, off `main` @ `d6bc83d`)
```
a3ebfc8  chore(cleanup): unify id derivation with golden tests, delete dead residue, tidy proxy prefixes
fd45df3  chore(repo): move app from life-os/ to repository root
c97f1f3  ci: root workflow with lint, typecheck, sentinels, tests, build
<P4>     docs: README, CLAUDE.md, AGENTS.md rewritten for the root-level rebuilt app
```
Never pushed, never merged, `main` untouched.

### Deltas vs brief (all documented above, recap)
1. **spese/esami also consumed `deriveId`** (brief named only gym+calendar) → kept a one-line
   re-export shim in `gym/importer.ts` so the two out-of-fence importers + all importer tests stay
   untouched and byte-identical.
2. **`scripts/setup-git.mjs` KEPT** (brief listed it for deletion) — it's a live ops script
   (registers the `merge=ours` driver) referenced in `lib/modules/README.md`; the brief's own
   keep-rule ("any others referenced anywhere") wins.
3. **CI branches narrowed** `[master, main, shared]` → `[main]` per the brief's "push to main"
   (documented; `shared` re-addable).
4. **CI build needs placeholder public Supabase env** (env-less build fails at `/offline`
   prerender) — added inline placeholders (public anon values, not secrets).
5. **`/dev/ui` = 200 locally** (not the brief's expected prod-404) — move-independent
   (byte-identical route); 404s on real Vercel prod.
6. Minor deliberate non-edits (fence): `app/dashboard/page.tsx` stale proxy comment;
   `README-START-HERE.md` pre-rebuild prose.

---

## Davide's FINAL GATE — consolidated checklist (Gates 2-3 merged, in order)

Do these on your machine — the session never touches live Supabase/Vercel/GitHub (session rule 1).

1. **Review + merge.** Read the `feat/run-06` diff, then `git merge --no-ff feat/run-06` into `main`.
2. **Backup first.** JSON export from Impostazioni on **every device that has data** (safety net
   before migrations).
3. **Apply migrations 0019 → 0023 IN ORDER** with the runner, on your project (D6: your project
   now; consolidate via JSON export/import later). From the repo root:
   ```
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0019_sync_tables.sql
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0020_push_subscriptions.sql
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0021_lo_esami.sql
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0022_lo_spese.sql
   node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0023_lo_sera.sql
   ```
   (0021/0022/0023 each redeclare `lo_push` — order matters; verify the runner signature first,
   the session never ran it. `scripts/verify-schema.mjs` to confirm.)
4. **Vercel: set project Root Directory to the repo root (`.`)** — BEFORE/immediately after pushing
   `main`. Then push and watch BOTH: the **Actions** tab (first CI run green = the audit's "dead CI"
   finding A9 #3 is closed) AND the Vercel deploy.
5. **OTP.** Flip the Supabase email template per `03-activation-checklist.md`, then run the
   cross-device code smoke.
6. **Device session (~60-90 min, the accumulated one):**
   - PWA install + **airplane cold start** (Oggi with local data) + update cycle on the next deploy.
   - Two-device **sync convergence** + "Esci → Svuota" test.
   - The **four importers** + second-device verification (imported rows sync).
   - Google connect/sync/disconnect on `/calendar` (two-account: detaches only one).
   - Real gym session with rest timer.
   - Tasks swipe/undo/reorder/chips.
   - Reminders toast + "Mentre eri via" + `.ics` into iOS Calendar.
   - Theme/palette/keyboard tour (cmd+K, `g t`, `n`, `?`; Impostazioni → Tema).
   - Touch spot-checks from 99e item 7 (compact h-8 chip family, /spese 44px chips, /sera energy).

### Optional afterwards
- **Prompt 17** — push notifications (`lo_push_subscriptions` is ready, unused).
- The blueprint's "later" backlog (recurrence tasks, NL on /spese, CalDAV, Google bidirectional).
- **D4 leftovers** (Business/Custom/Overseer/Health/Body/Timeline/Insights/Recap) — untouched by
  design; retire or port explicitly when you decide.
- Trivial doc follow-ups: `app/dashboard/page.tsx` stale proxy comment; `README-START-HERE.md`
  refresh; point `spese`/`esami` importers directly at `@/data/ids` and drop the re-export shim.

**Run 06 complete.** Repository is root-level, dead residue gone, CI revived at the root, docs
match reality. Four checks green throughout; every commit on green; `main` untouched.
