/**
 * Module registry — runtime store + register/lookup API.
 *
 * The registry is a single module-level Map keyed by module id.
 * Each ModuleDefinition is registered exactly once, at module
 * boot time (via side-effect import from `private-boot.ts` or
 * direct `import` of a module's `register.ts`).
 *
 * Why a module-level Map and not a class instance:
 * - Singleton without singleton boilerplate. The TS module
 *   system already gives us one-instance-per-isolate semantics.
 * - Server (Next.js RSC) bundle only — `import "server-only"`
 *   below blocks Client Component imports. Without this, a
 *   Client Component importing directly from registry.ts (not
 *   the barrel) would bypass the server-only guard in
 *   `index.ts` and ship registry metadata (labels, routes, ids
 *   of private modules) to the browser bundle. Closes ECC S2
 *   Sec-M2.
 *
 * Why throw on duplicate registration:
 * - Two modules sharing an id is always a bug (DB foreign keys,
 *   EventKind discriminants, URL routes all assume unique ids).
 *   Failing fast at boot is better than silently overwriting.
 */

import "server-only";
import type { ModuleDefinition } from "./types";

/**
 * Backing store. Module id → definition. Order of insertion is
 * preserved by Map iteration, which `getRegisteredModules` uses
 * to seed the tab/widget order when a module omits `tabOrder`.
 */
const REGISTRY = new Map<string, ModuleDefinition>();

/**
 * Internal: insert into the registry, throw on duplicate id.
 * Used by both `registerModule` (with a public, type-constrained
 * signature) and `registerPrivateModule` (which stamps the
 * private flag before delegating). Not exported — the API
 * surface is the two typed wrappers below.
 */
function insertIntoRegistry(def: ModuleDefinition): void {
  if (REGISTRY.has(def.id)) {
    throw new Error(
      `[modules] duplicate registration for id "${def.id}" — a module with this id is already registered`,
    );
  }
  REGISTRY.set(def.id, def);
}

/**
 * Register a module. Throws if the id is already in use — the
 * caller is expected to catch this at boot time (typically
 * never; tests for the duplicate-throw branch).
 *
 * NOTE: registration is intentionally side-effecting on the
 * module-level Map. Idempotency is NOT a goal — re-registering
 * the same id MUST surface as an error so accidental duplicate
 * imports are caught.
 *
 * Type constraint: the `private` flag is RESERVED for
 * `registerPrivateModule` to set. Callers of `registerModule`
 * must NOT pass `private: true` directly — the `private?: never`
 * constraint surfaces this as a compile-time error so the
 * invariant "private flag is only set via registerPrivateModule"
 * is mechanically enforced. Closes ECC S1 TS-H2.
 */
export function registerModule(
  def: Omit<ModuleDefinition, "private"> & { private?: never },
): void {
  insertIntoRegistry(def);
}

/**
 * Same as `registerModule` but stamps `private: true` on the
 * definition. Private modules are registered exclusively via
 * `private-boot.personal.ts`; the shared branch's private-boot
 * file is a no-op, so on the shared branch the registry contains
 * only base (non-private) modules.
 */
export function registerPrivateModule(
  def: Omit<ModuleDefinition, "private">,
): void {
  insertIntoRegistry({ ...def, private: true });
}

/**
 * Return all registered modules in a deterministic order:
 *   1. Modules with an explicit `tabOrder`, sorted ascending.
 *   2. Modules without `tabOrder`, in registration order.
 *
 * Returns a fresh array each call — callers may mutate (filter,
 * sort) freely. The underlying Map is preserved.
 */
export function getRegisteredModules(): ModuleDefinition[] {
  const all = Array.from(REGISTRY.values());
  const ordered = all
    .filter((m) => m.tabOrder !== undefined)
    .sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));
  const unordered = all.filter((m) => m.tabOrder === undefined);
  return [...ordered, ...unordered];
}

/**
 * Resolve `id → ModuleDefinition`, or undefined when not
 * registered. Use for lookup-by-EventKind-prefix patterns and
 * cross-reference resolution.
 */
export function lookupById(id: string): ModuleDefinition | undefined {
  return REGISTRY.get(id);
}

/**
 * Resolve a URL pathname to its owning module, or undefined.
 * The match is on prefix (`pathname.startsWith(module.route)`)
 * so sub-pages of a module still resolve to the module.
 *
 * Example: `lookupByRoute("/business/chameleon-os/milestones")` →
 * the chameleon_os module (if registered with route
 * "/business/chameleon-os").
 *
 * Iteration order: insertion order (Map default), NOT the
 * `tabOrder`-sorted view exposed by `getRegisteredModules`. For
 * overlapping routes (e.g. "/business" and
 * "/business/chameleon-os"), the FIRST-REGISTERED match wins.
 * Today no two modules share overlapping routes; if you ever
 * add a module whose `route` is a prefix of another's, register
 * the more-specific module first. Closes ECC S1 LOW1.
 */
export function lookupByRoute(
  pathname: string,
): ModuleDefinition | undefined {
  for (const m of REGISTRY.values()) {
    if (pathname === m.route || pathname.startsWith(m.route + "/")) {
      return m;
    }
  }
  return undefined;
}

/**
 * Test-only escape hatch. Resets the registry between tests so
 * each test starts from a clean slate without cross-test
 * contamination from `registerModule` side effects.
 *
 * Named with the `__forTests` convention used elsewhere in this
 * codebase (see `lib/google/drive-journal.ts`) so the intent is
 * unmistakable.
 *
 * Runtime guard: throws in production. Closes ECC S1 HIGH (TS-H1
 * + Code-H2) — the production bundle still SHIPS this function
 * for tree-shaking reasons, but a stray call at runtime is now
 * a loud failure instead of silently wiping the registry mid-
 * request.
 *
 * Not re-exported from `lib/modules/index.ts` (public barrel) —
 * test files import directly from `./registry`. The public
 * surface stays clean.
 */
export function __resetRegistryForTests(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[modules] __resetRegistryForTests called in production — this is a test-only escape hatch",
    );
  }
  REGISTRY.clear();
}
