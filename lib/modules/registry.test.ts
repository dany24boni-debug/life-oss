import { afterEach, describe, expect, it } from "vitest";
import {
  __resetRegistryForTests,
  getRegisteredModules,
  lookupById,
  lookupByRoute,
  registerModule,
  registerPrivateModule,
} from "./registry";
import type { ModuleDefinition } from "./types";

// Test fixtures use `Omit<..., "private">` because that's the
// shape `registerModule` accepts (ECC S1 TS-H2: `private` is
// reserved for `registerPrivateModule` to set). The fixture
// type matches the public API, so a future refactor that
// tightens the constraint surfaces test-side at compile time.
type PublicModuleDef = Omit<ModuleDefinition, "private">;

// Synthetic test fixtures — intentionally neutral identifiers
// (no real product names, no user-specific personal data) so
// this test file is share-safe.
const ALPHA: PublicModuleDef = {
  id: "alpha",
  label: "Alpha",
  emoji: "🅰️",
  route: "/x/alpha",
  tabOrder: 10,
  businessTab: true,
};

const BETA: PublicModuleDef = {
  id: "beta",
  label: "Beta",
  emoji: "🅱️",
  route: "/x/beta",
  tabOrder: 20,
  businessTab: true,
};

const GAMMA_NO_ORDER: PublicModuleDef = {
  id: "gamma",
  label: "Gamma",
  emoji: "Γ",
  route: "/x/gamma",
};

afterEach(() => {
  // Each test starts from a clean registry. Without this, the
  // module-level Map would accumulate registrations across the
  // suite and `registerModule` would throw on duplicates.
  __resetRegistryForTests();
});

describe("registerModule", () => {
  it("registers a module and exposes it via getRegisteredModules", () => {
    registerModule(ALPHA);
    const all = getRegisteredModules();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("alpha");
  });

  it("throws when the same id is registered twice", () => {
    registerModule(ALPHA);
    expect(() => registerModule(ALPHA)).toThrow(
      /duplicate registration for id "alpha"/,
    );
  });

  it("throws when two definitions share an id (different objects)", () => {
    registerModule(ALPHA);
    const clashing: PublicModuleDef = {
      ...ALPHA,
      label: "Alpha v2",
    };
    expect(() => registerModule(clashing)).toThrow(
      /duplicate registration for id "alpha"/,
    );
  });
});

describe("registerPrivateModule", () => {
  it("stamps `private: true` on the registered definition", () => {
    registerPrivateModule({
      id: "private_x",
      label: "Private X",
      emoji: "🔒",
      route: "/x/private",
    });
    const def = lookupById("private_x");
    expect(def).toBeDefined();
    expect(def?.private).toBe(true);
  });

  it("uses the same id-uniqueness rule as registerModule", () => {
    registerPrivateModule({
      id: "private_y",
      label: "Private Y",
      emoji: "🔒",
      route: "/x/y",
    });
    expect(() =>
      registerPrivateModule({
        id: "private_y",
        label: "Private Y (dup)",
        emoji: "🔒",
        route: "/x/y2",
      }),
    ).toThrow(/duplicate registration/);
  });
});

describe("getRegisteredModules — ordering", () => {
  it("returns modules with explicit tabOrder ascending first", () => {
    registerModule(BETA);
    registerModule(ALPHA);
    const out = getRegisteredModules();
    expect(out.map((m) => m.id)).toEqual(["alpha", "beta"]);
  });

  it("places modules without tabOrder after numbered ones, in registration order", () => {
    registerModule(GAMMA_NO_ORDER);
    registerModule(ALPHA);
    const DELTA_NO_ORDER: PublicModuleDef = {
      id: "delta",
      label: "Delta",
      emoji: "Δ",
      route: "/x/delta",
    };
    registerModule(DELTA_NO_ORDER);
    const out = getRegisteredModules();
    expect(out.map((m) => m.id)).toEqual(["alpha", "gamma", "delta"]);
  });

  it("returns an empty array when no modules registered", () => {
    expect(getRegisteredModules()).toEqual([]);
  });
});

describe("lookupById", () => {
  it("returns the registered definition", () => {
    registerModule(ALPHA);
    expect(lookupById("alpha")).toEqual(ALPHA);
  });

  it("returns undefined for unknown ids", () => {
    expect(lookupById("nonexistent")).toBeUndefined();
  });
});

describe("lookupByRoute", () => {
  it("matches exact route", () => {
    registerModule(ALPHA);
    expect(lookupByRoute("/x/alpha")?.id).toBe("alpha");
  });

  it("matches sub-paths under the module route", () => {
    registerModule(ALPHA);
    expect(lookupByRoute("/x/alpha/subpage")?.id).toBe("alpha");
    expect(lookupByRoute("/x/alpha/nested/deep")?.id).toBe("alpha");
  });

  it("does NOT match an unrelated route that happens to share a prefix substring", () => {
    registerModule(ALPHA);
    // "/x/alphabeta" should not match "/x/alpha" because the
    // boundary check requires the next char to be "/" or end-of-string.
    expect(lookupByRoute("/x/alphabeta")).toBeUndefined();
  });

  it("returns undefined when the pathname has no registered module", () => {
    registerModule(ALPHA);
    expect(lookupByRoute("/y/unrelated")).toBeUndefined();
  });
});

describe("filtering — businessTab consumers", () => {
  it("consumers can filter getRegisteredModules to businessTab=true", () => {
    registerModule(ALPHA); // businessTab: true
    registerModule(BETA); // businessTab: true
    registerModule(GAMMA_NO_ORDER); // no businessTab
    const businessOnly = getRegisteredModules().filter(
      (m) => m.businessTab,
    );
    expect(businessOnly.map((m) => m.id)).toEqual(["alpha", "beta"]);
  });
});

describe("__resetRegistryForTests", () => {
  it("clears all registered modules", () => {
    registerModule(ALPHA);
    registerModule(BETA);
    expect(getRegisteredModules()).toHaveLength(2);
    __resetRegistryForTests();
    expect(getRegisteredModules()).toHaveLength(0);
  });
});
