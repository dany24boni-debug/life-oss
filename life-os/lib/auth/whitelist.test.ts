import { describe, it, expect } from "vitest";
import { hasAnyPrivate, PRIVATE_SLUGS } from "./whitelist";

describe("hasAnyPrivate", () => {
  it("returns false on an empty whitelist", () => {
    expect(hasAnyPrivate(new Set())).toBe(false);
  });

  it("returns true when at least one slug is present", () => {
    expect(hasAnyPrivate(new Set(["chameleon_os"]))).toBe(true);
  });

  it("doesn't care which slug — any non-empty set qualifies", () => {
    expect(hasAnyPrivate(new Set(["random_slug"]))).toBe(true);
  });
});

describe("PRIVATE_SLUGS", () => {
  it("contains the chameleon_os private module", () => {
    expect([...PRIVATE_SLUGS]).toContain("chameleon_os");
  });
});
