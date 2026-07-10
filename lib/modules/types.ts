/**
 * Module registry — type definitions.
 *
 * The module registry decouples the "shared" codebase from
 * knowledge of which specific business / private modules are
 * installed in a given branch. Code that lists modules in UI
 * (BusinessTabs, dashboard intervention menu), generates
 * suggested tasks, or builds the Overseer prompt context goes
 * through the registry instead of importing module names
 * directly.
 *
 * The owner branch boots both base modules and private modules.
 * The shared branch boots only the base ones — private module
 * files are absent from the tree entirely. Switching branches =
 * swapping `private-boot.ts` between `personal` and `shared`
 * variants (see README in this folder).
 *
 * Why interfaces / function shapes here, not classes:
 * registration is data-driven. A module declares its shape
 * (id, label, where it appears in the UI, optional hooks for
 * task generation / Overseer context) and the registry
 * remembers it. No subclassing, no lifecycle methods — keeps
 * the surface area minimal and easy to test.
 */

import type { State, Weight } from "@/lib/tasks/generator";

/**
 * Optional hook a module may register so the daily task
 * generator (`lib/tasks/generator.ts`) can ask each registered
 * module "do you want to contribute tasks for this state?".
 *
 * The generator core stays state-aware (Esami / Scaling / etc);
 * modules only return tasks they'd like to attach.
 */
export type ModuleTaskHook = (
  state: State,
  isActive: boolean,
) => Array<{ title: string; weight: Weight }>;

/**
 * Optional hook a module may register so the Overseer system
 * prompt builder (`lib/overseer/context.ts`) can pull a one-line
 * description of the module per user.
 */
export type ModuleOverseerHook = (ctx: {
  /** Whether the module is active for the current user. */
  isActive: boolean;
}) => string;

/**
 * The full shape a module registers with the registry. All
 * fields except `id`, `label`, `emoji`, `route` are optional —
 * a module can opt into UI surfaces or behavioural hooks as
 * needed.
 */
export interface ModuleDefinition {
  /**
   * Stable slug used everywhere (DB rows, EventKind prefix, URL
   * segment under /business or /...). Must be unique across
   * registered modules. Example: "chameleon_os".
   */
  id: string;

  /** Human-facing name shown in tabs / cards. */
  label: string;

  /** Short emoji glyph used as visual ID across the UI. */
  emoji: string;

  /**
   * URL path the module's main page lives at. Used by
   * `lookupByRoute(pathname)` to resolve "which module is the
   * user on?" — useful for nav highlighting and 404 fallback
   * in the proxy pages introduced in S2/S3.
   */
  route: string;

  /**
   * Numeric order within the Business tabs. Lower = leftmost.
   * Modules without a tabOrder render after numbered ones in
   * registration order.
   */
  tabOrder?: number;

  /**
   * If true, this module appears in the BusinessTabs nav
   * (top of /business sub-pages). Modules without this flag
   * still live in the registry but don't get a tab.
   */
  businessTab?: boolean;

  /**
   * Reserved for S2+ — flags whether the module contributes a
   * widget to /dashboard.
   */
  dashboardWidget?: boolean;

  /**
   * True if the module was registered via the PRIVATE boot file
   * (auto-set by `registerPrivateModule`). The registry uses
   * this to filter at consumer sites when needed, and the smoke
   * test on the shared branch asserts no private modules
   * registered.
   */
  private?: boolean;

  /** Optional task generation contribution. See ModuleTaskHook. */
  taskGenerator?: ModuleTaskHook;

  /** Optional Overseer prompt contribution. See ModuleOverseerHook. */
  overseerContext?: ModuleOverseerHook;
}
