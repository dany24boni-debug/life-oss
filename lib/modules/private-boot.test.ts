import { describe, expect, it } from "vitest";

// Shared-branch variant: `.personal` does not exist on this branch
// (deleted along with `app/business/_private/`). Only `.shared` (no-op
// stub) and `private-boot.ts` (dispatch) are present. The personal
// branch's test file imports both `.personal` and `.shared` and
// asserts the dispatch resolves to "personal"; this shared-branch
// version asserts the dispatch resolves to "shared".

import { PRIVATE_BOOT_MODE as SHARED_MODE } from "./private-boot.shared";
import { PRIVATE_BOOT_MODE as DISPATCH_MODE } from "./private-boot";

describe("private-boot — shared branch variant", () => {
  it("private-boot.shared exposes PRIVATE_BOOT_MODE = 'shared'", () => {
    expect(SHARED_MODE).toBe("shared");
  });

  it("private-boot (dispatch) re-exports the SHARED variant on this branch", () => {
    // On the shared branch the dispatch points to .shared
    // (single-line edit in private-boot.ts, with merge=ours in
    // .gitattributes protecting it from cross-branch merge
    // conflicts).
    expect(DISPATCH_MODE).toBe("shared");
  });
});
