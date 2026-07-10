/**
 * Private modules boot — DISPATCH file.
 *
 * On the personal/refactor branches this re-exports from
 * `./private-boot.personal` (which itself imports each private
 * module's `register.ts` for side effects, populating the
 * registry).
 *
 * On the shared branch (cleaned for partner Chameleon), this
 * file is rewritten to re-export from `./private-boot.shared`
 * (no-op marker). The shared branch's tree doesn't include the
 * private module source files, so re-exporting `.personal` on
 * the shared branch would fail at compile time — the swap is
 * mandatory.
 *
 * Branch switching: this file (and only this file) carries
 * `merge=ours` in .gitattributes — see that file for rationale.
 * Cross-branch merges preserve the current branch's version
 * here, avoiding spurious conflicts on a file whose contents
 * are SUPPOSED to differ per branch.
 *
 * To verify which mode is active at runtime:
 *   import { PRIVATE_BOOT_MODE } from "@/lib/modules/private-boot";
 *   console.log(PRIVATE_BOOT_MODE); // "personal" or "shared"
 */
export * from "./private-boot.shared";
