/**
 * Module registry — public entry point.
 *
 * SERVER-ONLY. Importing this file from a Client Component
 * triggers Next.js's `server-only` guard at build time. This
 * prevents the entire registry (including labels and routes of
 * PRIVATE modules) from being serialized into the client JS
 * bundle, where any visitor inspecting devtools could enumerate
 * "what private business modules does this account own?".
 *
 * If a Client Component needs to know about a module, the server
 * passes that subset down via props (see `BusinessTabs` after
 * S2: server fetches `getRegisteredModules().filter(...)` and
 * forwards only the visible-to-this-user slice). Closes ECC S1
 * Code-M2.
 *
 * Consumers should always import from `@/lib/modules`, not from
 * `./registry` or `./types` directly. This entry point:
 *
 *   1. Re-exports the public registry API (ModuleDefinition,
 *      registerModule, getRegisteredModules, lookupByRoute,
 *      lookupById).
 *   2. Imports `./private-boot` for its side effect — that
 *      import triggers the boot dispatch which (on the personal
 *      branch) loads each private module's register.ts, each of
 *      which calls registerPrivateModule.
 *
 * Because the boot side-effect lives here, any consumer that
 * imports a VALUE from `@/lib/modules` automatically pulls the
 * registry into a "populated" state in the current isolate
 * BEFORE the consumer's code runs. No explicit "init" call is
 * needed at the consumer site.
 *
 * ⚠️ TYPE-ONLY IMPORTS ELIDE THE BOOT (ECC S1 TS-M1)
 *
 * A consumer that imports ONLY types (e.g. `import type { ModuleDefinition }`)
 * gets the type erased by TS/bundler and the `import "./private-boot"`
 * side-effect NEVER runs. If you need the registry populated,
 * import at least one value:
 *
 *   import { getRegisteredModules, type ModuleDefinition }
 *     from "@/lib/modules";   // ← value+type, side-effect runs
 *
 *   import type { ModuleDefinition } from "@/lib/modules"; // ← side-effect ELIDED
 *
 * Idempotency: ES modules cache imports per isolate, so the
 * side-effect runs exactly once per server bundle lifetime.
 * Re-importing `@/lib/modules` from a different file does NOT
 * re-run the boot — the cached module is reused.
 *
 * Note on `__resetRegistryForTests`: intentionally NOT re-exported
 * from this barrel. Test files import it directly from
 * `./registry`. Keeps the public surface free of test-only escape
 * hatches.
 */

// Server-only marker. Throws a clear error at build time if a
// Client Component tries to import this module. See JSDoc above.
import "server-only";

// Side-effect imports — public (non-private) module registrations.
// Each register.ts calls `registerModule(...)` against the registry
// Map. Order doesn't matter for correctness but affects insertion-
// order tiebreakers (see `lookupByRoute` JSDoc).
import "@/app/business/chameleon-os/register";

// Side effect: runs the private-boot dispatch (which may import
// individual register.ts files). Must come BEFORE the re-exports
// below so that by the time a consumer destructures
// `getRegisteredModules`, the registry is already populated.
import "./private-boot";

export type {
  ModuleDefinition,
  ModuleOverseerHook,
  ModuleTaskHook,
} from "./types";

export {
  getRegisteredModules,
  lookupById,
  lookupByRoute,
  registerModule,
  registerPrivateModule,
} from "./registry";

export { PRIVATE_BOOT_MODE } from "./private-boot";
