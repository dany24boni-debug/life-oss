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

**Commit:** `chore(cleanup): unify id derivation with golden tests, delete dead residue, tidy proxy prefixes`

---
