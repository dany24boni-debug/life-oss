import { describe, expect, it } from "vitest";

// Smoke test for the public entry point. Imports must resolve;
// types must be exported under the documented names; the
// boot side-effect must have run by the time we read
// PRIVATE_BOOT_MODE.

import {
  PRIVATE_BOOT_MODE,
  getRegisteredModules,
  lookupById,
  lookupByRoute,
  registerModule,
  registerPrivateModule,
} from "./index";

describe("@/lib/modules public entry point", () => {
  it("exports the registry API (production-safe surface only)", () => {
    expect(typeof registerModule).toBe("function");
    expect(typeof registerPrivateModule).toBe("function");
    expect(typeof getRegisteredModules).toBe("function");
    expect(typeof lookupById).toBe("function");
    expect(typeof lookupByRoute).toBe("function");
    // __resetRegistryForTests intentionally NOT re-exported — only
    // available via direct import from `./registry`. Closes ECC S1
    // HIGH (test-only helper out of public barrel).
  });

  it("re-exports PRIVATE_BOOT_MODE = 'shared' on this branch", () => {
    expect(PRIVATE_BOOT_MODE).toBe("shared");
  });

  it("boot side-effect has run by the time the import resolves", () => {
    // On the shared branch the boot stub is a no-op (no private
    // modules to register). The point of this test isn't to assert
    // presence — it's to assert that the boot import didn't crash
    // the load and getRegisteredModules() is callable.
    expect(() => getRegisteredModules()).not.toThrow();
  });
});
