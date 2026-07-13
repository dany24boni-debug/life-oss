/**
 * Google Drive journal helper — Sprint A feature 3.
 *
 * Stores the user's daily journal entries as .md files in a
 * dedicated Drive folder: /Life-OS/Diario/YYYY-MM-DD.md
 *
 * Storage philosophy: Drive is PRIMARY. Supabase only holds the
 * folder ID (profiles.diario_drive_folder_id) for cheap lookup —
 * actual content and mood live exclusively on the user's Drive.
 * If the user revokes access, their data stays with them.
 *
 * OAuth scope: drive.file (per-file). The app only sees files it
 * creates or that the user opens with the app — NOT the rest of
 * their Drive. Strictest possible Drive scope.
 *
 * All calls use fetch directly against Drive REST API v3. No SDK
 * dependency.
 */

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType, infer as zInfer } from "zod";
import {
  getValidAccessToken,
  TOKEN_ACCOUNT_COLUMNS,
  type PreloadedTokenAccount,
} from "./token-store";
import { hasDriveFileScope } from "./scope-check";
import {
  DriveFilesListSchema,
  DriveFileCreateSchema,
} from "@/lib/validation/drive-api";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MARKDOWN_MIME = "text/markdown";
const ROOT_FOLDER_NAME = "Life-OS";
const JOURNAL_FOLDER_NAME = "Diario";

/** Date format the filenames follow: YYYY-MM-DD.md */
const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

/** Strict YYYY-MM-DD shape used to gate every entry-by-date call. */
const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date: string): void {
  if (!DATE_PARAM_RE.test(date)) {
    throw new Error("bad_date");
  }
}

export type JournalEntry = {
  date: string;          // YYYY-MM-DD
  fileId: string;
  content: string;       // markdown body (frontmatter stripped)
  mood: string | null;   // pulled from frontmatter if present
};

/**
 * Frontmatter builder. Spec: include `mood` only when non-null,
 * non-empty after trim. No fallback chain — caller decides what
 * value to pass.
 *
 * Output shape:
 *   ---
 *   date: 2026-05-12
 *   mood: stanco ma ok      ← present only when caller passes non-null
 *   ---
 */
export function buildFrontmatter(date: string, mood: string | null): string {
  const lines = ["---", `date: ${date}`];
  if (mood && mood.trim().length > 0) {
    // YAML scalars without special chars don't need quoting.
    // Belt-and-suspenders: escape newlines and double-quotes if any.
    const safe = mood.replace(/\r?\n/g, " ").replace(/"/g, '\\"');
    if (/[:#&*!|>%@`]/.test(safe)) {
      lines.push(`mood: "${safe}"`);
    } else {
      lines.push(`mood: ${safe}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Parse a markdown document with optional YAML frontmatter. Returns
 * the body separately so the editor can show just the user-facing
 * content. Tolerates missing or malformed frontmatter (returns the
 * whole document as body + null fields).
 */
export function parseFrontmatter(md: string): {
  date: string | null;
  mood: string | null;
  body: string;
} {
  // Must START with "---" on its own line.
  if (!md.startsWith("---\n") && !md.startsWith("---\r\n")) {
    return { date: null, mood: null, body: md };
  }
  // Find the closing "---" line.
  const lines = md.split(/\r?\n/);
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) {
    return { date: null, mood: null, body: md };
  }
  let date: string | null = null;
  let mood: string | null = null;
  for (let i = 1; i < closeIdx; i++) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    if (key === "date") date = value || null;
    else if (key === "mood") mood = value || null;
  }
  // Body starts AFTER the closing "---" line, skipping a single
  // blank line if present.
  let bodyStart = closeIdx + 1;
  if (lines[bodyStart] === "") bodyStart += 1;
  const body = lines.slice(bodyStart).join("\n");
  return { date, mood, body };
}

// ============================================================
// HTTP helpers
// ============================================================

/**
 * Internal helper — exposed only for tests via `__driveJsonForTests`
 * below so we can exercise the schema-validation branch without
 * stubbing Supabase. NOT a public API: production code calls this
 * through saveJournalEntry / getJournalEntry / etc.
 */
async function driveJson<S extends ZodType>(
  url: string,
  init: RequestInit,
  what: string,
  schema: S,
): Promise<zInfer<S>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text.length > 200 ? text.slice(0, 200) + "…" : text;
    throw new Error(`drive_api_error: ${what} ${res.status} ${res.statusText} — ${snippet}`);
  }
  const raw: unknown = await res.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Distinct error slug from the http-status drive_api_error so the
    // UI / caller can react differently (e.g. log + retry once, or
    // surface a "Google returned an unexpected shape" hint).
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`drive_api_invalid_response: ${what} — ${issues.slice(0, 200)}`);
  }
  return parsed.data as zInfer<S>;
}

/** Test-only re-export. See JSDoc on `driveJson` above. */
export const __driveJsonForTests = driveJson;

async function driveText(url: string, init: RequestInit, what: string): Promise<string> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text.length > 200 ? text.slice(0, 200) + "…" : text;
    throw new Error(`drive_api_error: ${what} ${res.status} ${res.statusText} — ${snippet}`);
  }
  return await res.text();
}

// ============================================================
// Account + scope guard
//
// loadAccount is intentionally fat: it SELECTs every column
// getValidAccessToken needs, so we can pass the row straight to
// the token-store via its `preloaded` arg and skip a second
// SELECT in the same request. Cost is one extra SELECT in the
// path where scope is missing (we'd have bailed early before
// loading tokens), but that's the cold/error branch — the hot
// path is "scope present + token valid" and that's where we
// win 1-2 DB roundtrips per /sera render.
// ============================================================

type AccountWithTokens = PreloadedTokenAccount & { scope: string | null };

async function loadAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountWithTokens> {
  // Semantica a LISTA (run-09 prompt 6): con DUE account Google
  // collegati il vecchio `.maybeSingle()` falliva (PostgREST rifiuta
  // le righe multiple) e l'export del diario si rompeva. Ora si sceglie
  // in modo DETERMINISTICO l'account più recentemente attivo
  // (last_synced_at, poi created_at — la tabella non ha updated_at);
  // zero account = lo stesso errore tipizzato di sempre.
  const { data } = await supabase
    .from("external_calendar_accounts")
    .select(`${TOKEN_ACCOUNT_COLUMNS}, scope, last_synced_at, created_at`)
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<AccountWithTokens[]>();
  const account = data?.[0];
  if (!account) throw new Error("account_missing");
  if (!hasDriveFileScope(account.scope)) throw new Error("scope_missing");
  return account;
}

// ============================================================
// Folder bootstrap
// ============================================================

async function createFolderOnDrive(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string> {
  const body: Record<string, unknown> = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) body.parents = [parentId];

  const res = await driveJson(
    `${DRIVE_API_BASE}/files?fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    `create_folder ${name}`,
    DriveFileCreateSchema,
  );
  return res.id;
}

async function findFolderByName(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  // q syntax: name = 'X' and mimeType = 'folder' and 'parent' in parents
  const qParts = [
    `name = '${escaped}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const q = qParts.join(" and ");

  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`;
  const res = await driveJson(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    `find_folder ${name}`,
    DriveFilesListSchema,
  );
  return res.files?.[0]?.id ?? null;
}

/**
 * Internal: find or create /Life-OS/Diario/ given an already-valid
 * access token. Persists the resulting folder ID on
 * profiles.diario_drive_folder_id so the lookup is O(1) next time.
 *
 * Separated from the account/token bootstrap so the same render
 * can resolve account → token → folder once and reuse the folder
 * id across multiple journal calls (see getJournalContext).
 */
async function bootstrapJournalFolder(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<string> {
  // Fast path: cached folder ID in profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("diario_drive_folder_id")
    .eq("id", userId)
    .single<{ diario_drive_folder_id: string | null }>();
  if (profile?.diario_drive_folder_id) {
    return profile.diario_drive_folder_id;
  }

  // Find or create the Life-OS root folder.
  let rootId = await findFolderByName(accessToken, ROOT_FOLDER_NAME, null);
  if (!rootId) {
    rootId = await createFolderOnDrive(accessToken, ROOT_FOLDER_NAME, null);
  }

  // Then the Diario subfolder.
  let diarioId = await findFolderByName(accessToken, JOURNAL_FOLDER_NAME, rootId);
  if (!diarioId) {
    diarioId = await createFolderOnDrive(accessToken, JOURNAL_FOLDER_NAME, rootId);
  }

  // Persist for next call.
  await supabase
    .from("profiles")
    .update({ diario_drive_folder_id: diarioId })
    .eq("id", userId);

  return diarioId;
}

/**
 * Per-request shared context: the account row + a valid access
 * token + the journal folder id. Wrapped in React's `cache()` so
 * that when /sera triggers `getJournalEntry` and
 * `listRecentJournalEntries` in the same render (Promise.all),
 * the SELECTs and the (rare) token refresh + folder bootstrap
 * happen exactly once — not once per call.
 *
 * Cache key: (supabase, userId). The supabase client is created
 * per request via createClient(), so identity isolation per
 * request is automatic. Across requests, a fresh client = fresh
 * cache entry. No cross-user bleed possible.
 */
type JournalContext = {
  account: AccountWithTokens;
  accessToken: string;
  folderId: string;
};

const getJournalContext = cache(
  async (
    supabase: SupabaseClient,
    userId: string,
  ): Promise<JournalContext> => {
    const account = await loadAccount(supabase, userId);
    const accessToken = await getValidAccessToken(
      supabase,
      account.id,
      userId,
      account,
    );
    const folderId = await bootstrapJournalFolder(supabase, userId, accessToken);
    return { account, accessToken, folderId };
  },
);

/**
 * Find or create /Life-OS/Diario/ on the user's Drive. Returns the
 * folder ID. Memoized per render via getJournalContext.
 */
export async function ensureJournalFolder(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  return (await getJournalContext(supabase, userId)).folderId;
}

// ============================================================
// Entry operations
// ============================================================

async function findEntryFileId(
  accessToken: string,
  folderId: string,
  date: string,
): Promise<string | null> {
  const name = `${date}.md`;
  const escaped = name.replace(/'/g, "\\'");
  const q = [
    `name = '${escaped}'`,
    `'${folderId}' in parents`,
    "trashed = false",
  ].join(" and ");
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=2`;
  const res = await driveJson(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    `find_entry ${date}`,
    DriveFilesListSchema,
  );
  return res.files?.[0]?.id ?? null;
}

/**
 * Upsert a journal entry. If a YYYY-MM-DD.md file already exists in
 * the folder, its content is replaced (PATCH). Otherwise a new file
 * is created (POST). Returns the file ID.
 *
 * Frontmatter is built from (date, mood) per the project convention
 * — no fallback when mood is null/empty.
 */
export async function saveJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  content: string,
  mood: string | null,
): Promise<{ fileId: string }> {
  // Defence in depth: don't trust any caller's date validation —
  // re-check here so a future code path can't smuggle a malformed
  // date into the Drive q= query construction.
  assertValidDate(date);
  const { accessToken, folderId } = await getJournalContext(supabase, userId);

  const frontmatter = buildFrontmatter(date, mood);
  const fullContent = `${frontmatter}\n\n${content}`;

  const existing = await findEntryFileId(accessToken, folderId, date);

  if (existing) {
    // PATCH content.
    await driveText(
      `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(existing)}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": MARKDOWN_MIME,
        },
        body: fullContent,
        cache: "no-store",
      },
      `patch_entry ${date}`,
    );
    return { fileId: existing };
  }

  // POST new file — multipart upload to set both metadata and body.
  const boundary = "lifeos_diario_" + Math.random().toString(36).slice(2, 12);
  const metadata = {
    name: `${date}.md`,
    parents: [folderId],
    mimeType: MARKDOWN_MIME,
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${MARKDOWN_MIME}\r\n\r\n` +
    fullContent +
    `\r\n--${boundary}--`;

  const res = await driveJson(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      cache: "no-store",
    },
    `create_entry ${date}`,
    DriveFileCreateSchema,
  );
  return { fileId: res.id };
}

/**
 * Fetch a single entry by date. Returns null when the file doesn't
 * exist (most days won't have one yet).
 */
export async function getJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<JournalEntry | null> {
  assertValidDate(date);
  const { accessToken, folderId } = await getJournalContext(supabase, userId);

  const fileId = await findEntryFileId(accessToken, folderId, date);
  if (!fileId) return null;

  const md = await driveText(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    `fetch_entry ${date}`,
  );
  const parsed = parseFrontmatter(md);
  return {
    date,
    fileId,
    content: parsed.body,
    mood: parsed.mood,
  };
}

/**
 * List the most recent N entries in the diario folder, sorted by
 * filename desc (newest first). Used by /sera for the "vedi ieri"
 * / "vedi 7 giorni fa" link affordances.
 *
 * Returns only metadata (no content body). Callers wanting the body
 * call getJournalEntry(date) for the specific day they want.
 */
export async function listRecentJournalEntries(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 30,
): Promise<{ date: string; fileId: string }[]> {
  const { accessToken, folderId } = await getJournalContext(supabase, userId);

  const q = [
    `'${folderId}' in parents`,
    `mimeType = '${MARKDOWN_MIME}'`,
    "trashed = false",
  ].join(" and ");
  const cappedLimit = Math.min(Math.max(1, limit), 100);
  const url =
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name)&orderBy=name desc&pageSize=${cappedLimit}`;

  const res = await driveJson(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    `list_entries`,
    DriveFilesListSchema,
  );

  const out: { date: string; fileId: string }[] = [];
  for (const f of res.files ?? []) {
    // Schema marks `name` optional (defence: Drive could theoretically
    // omit it). Skip nameless entries — we can't classify them as
    // diary files without the date-shaped filename.
    if (!f.name) continue;
    const m = f.name.match(DATE_FILE_RE);
    if (!m) continue; // ignore files not following our naming
    out.push({ date: m[1], fileId: f.id });
  }
  return out;
}
