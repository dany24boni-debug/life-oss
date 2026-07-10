/**
 * Helpers for inspecting the OAuth `scope` string Google returns at
 * token exchange / refresh time. Stored on
 * external_calendar_accounts.scope as a space-separated list.
 *
 * Pure functions: caller passes the stored string in, we tell them
 * whether a given capability is currently granted.
 */

import { GOOGLE_SCOPE_DRIVE_FILE } from "./calendar-client";

/**
 * Parse a Google scope string into a Set of individual scope URLs.
 * Tolerates leading/trailing whitespace + multiple separators.
 */
function parseScopes(scopeStr: string | null | undefined): Set<string> {
  if (!scopeStr) return new Set();
  return new Set(scopeStr.trim().split(/\s+/).filter(Boolean));
}

/**
 * True when the user's token grants `drive.file` (per-app file
 * visibility — the only Drive scope life-os ever requests).
 */
export function hasDriveFileScope(
  scopeStr: string | null | undefined,
): boolean {
  return parseScopes(scopeStr).has(GOOGLE_SCOPE_DRIVE_FILE);
}
