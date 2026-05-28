/**
 * Private modules boot file — SHARED branch variant.
 *
 * Used on the shared branch. No owner-private modules are
 * registered: their source files are physically absent from
 * this branch tree, so even if this file did try to import
 * them, the import would fail to resolve at compile time.
 *
 * Keep this file intentionally minimal — its sole job is to
 * be a drop-in replacement for `private-boot.personal.ts` so
 * that `private-boot.ts` (the dispatch file) can re-export
 * either one with a single-line edit.
 *
 * Why a marker export instead of just `export {}`:
 * static analyzers treat empty modules as "no side effects"
 * and may tree-shake their imports out. The const below makes
 * the import meaningful; it's also useful at runtime to assert
 * "we're definitely on the shared branch" (e.g. in tests or
 * boot logs).
 */
export const PRIVATE_BOOT_MODE = "shared" as const;
