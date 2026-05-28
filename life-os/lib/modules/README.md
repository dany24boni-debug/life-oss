# `lib/modules` — Module registry

Plugin-style registry that lets the codebase enumerate / look up "what modules exist on this branch" without hardcoding their names. Used by UI nav (tabs, dashboard widgets), task generation, and the Overseer prompt builder so that shipping a branch with a different set of registered modules is a one-line edit.

## Why this exists

Before this layer, private modules were hardcoded as string literals everywhere — inline arrays in BusinessTabs, `if (has("foo")) out.push(...)` branches in `lib/tasks/generator.ts`, slug names baked into the Overseer prompt's `BASE_SYSTEM`. To make the codebase shareable across branches that boot different module sets, we extracted a registry boundary instead of forking.

## File map

```
lib/modules/
├── README.md                       ← this file
├── index.ts                        ← public entry point — always import from here
├── types.ts                        ← ModuleDefinition + hook types
├── registry.ts                     ← runtime store + register/lookup
├── registry.test.ts                ← 16 unit cases
├── private-boot.ts                 ← branch-dispatch file (merge=ours)
├── private-boot.personal.ts        ← boots private modules (owner branch only)
├── private-boot.shared.ts          ← no-op stub for the shared branch
└── private-boot.test.ts            ← 3 dispatch cases
```

## Adding a new module

1. Create `app/<area>/<module>/page.tsx` and `actions.ts` as normal.
2. Add a `register.ts` next to them:
   ```ts
   // IMPORTANT: import from "@/lib/modules/registry" (low-level),
   // NOT "@/lib/modules" (public barrel). The barrel does a
   // side-effect import of THIS register.ts → circular → the
   // imported `registerModule` is undefined when the side-effect
   // runs.
   import { registerModule } from "@/lib/modules/registry";

   registerModule({
     id: "my_module",
     label: "My Module",
     emoji: "✨",
     route: "/area/my-module",
     tabOrder: 30,
     businessTab: true,  // appears in BusinessTabs nav
   });
   ```
3. Wire the side-effect import. Where depends on visibility:
   - **Public module** (everyone sees it): add `import "@/app/<area>/<module>/register"` directly in `lib/modules/index.ts` above the `export type` line — runs on every branch.
   - **Private module** (only on the owner branch): add the import in `lib/modules/private-boot.personal.ts`. Use `registerPrivateModule(...)` instead of `registerModule(...)` so the entry is flagged `private: true` and the shared-branch smoke test can assert no private leaks.

After adding, consumers see your module via `getRegisteredModules()` filtered as needed:
```ts
import { getRegisteredModules } from "@/lib/modules";

const businessTabs = getRegisteredModules().filter((m) => m.businessTab);
```

⚠️ **Boot side-effect requires a value import**. If a consumer does `import type { ModuleDefinition } from "@/lib/modules"` ONLY, the bundler erases the import entirely and the registry-populating side-effect never runs. Always pair type imports with at least one value import:
```ts
import { getRegisteredModules, type ModuleDefinition } from "@/lib/modules"; // ✓
import type { ModuleDefinition } from "@/lib/modules";                       // ✗ boot elided
```

## Branch switch — personal ↔ shared

### Setup (one-time, per machine)

⚠️ **Critical**: the `merge=ours` driver referenced in `.gitattributes` is a CUSTOM merge driver, NOT the built-in `-s ours` strategy. Git silently ignores it unless you register the driver in your local config:

```powershell
node --env-file=.env.local scripts/setup-git.mjs
```

Or manually:

```powershell
git config --local merge.ours.driver true
```

The script does the same one-liner + verifies the config landed. Without this step, cross-branch merges WILL produce conflicts on `private-boot.ts` — exactly the case the `.gitattributes` rule was designed to prevent.

### Branch swap (one-time, on the shared branch)

In `lib/modules/private-boot.ts`, change the single line:
```ts
export * from "./private-boot.personal";
```
to:
```ts
export * from "./private-boot.shared";
```
Commit. Done — the shared branch now boots without private modules.

### Cross-branch merges don't conflict on this file (when driver is set)

With `merge.ours.driver` registered (see Setup above), when you merge the owner branch into shared (or vice versa), git keeps the current branch's version of `private-boot.ts`. No conflict prompt.

The `.personal` and `.shared` variants merge normally, so logic improvements on either side propagate when you merge.

### Verifying the driver is active

```powershell
git config --get merge.ours.driver
# Expected output: true
```

If empty or missing, the driver is not set — re-run the setup step above.

### Verifying which mode is active

```ts
import { PRIVATE_BOOT_MODE } from "@/lib/modules";
console.log(PRIVATE_BOOT_MODE); // "personal" | "shared"
```

The unit test `private-boot.test.ts` asserts the dispatch points to the correct variant for the current branch.

## Tests

- `registry.test.ts` — 16 cases. Register, duplicate-throw, lookup, route prefix matching, ordering, filter, reset.
- `private-boot.test.ts` — 3 cases. Load + dispatch mode.
- `index.test.ts` — 3 cases. Public API surface + boot side-effect.

Run them isolated:
```powershell
npx vitest run lib/modules --no-file-parallelism
```
