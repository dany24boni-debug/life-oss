/**
 * Google Calendar API client — V0 (read-only, server-side only).
 *
 * Uses fetch directly against Google's public REST endpoints. No SDK
 * dependency. Exposes only what /agenda V0 needs:
 *   - buildAuthorizationUrl   → construct the OAuth consent URL
 *   - exchangeCodeForTokens   → swap the auth code for access + refresh
 *   - refreshAccessToken      → use a refresh token to mint a new access
 *   - getUserEmail            → fetch the linked Google account email
 *   - listEvents              → fetch calendar events in a time window
 *   - revokeToken             → revoke a token at /revoke
 *
 * All functions throw on non-2xx responses with the error body included.
 * Token plaintext is passed in as argument and never logged.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/** OAuth scope for V0: read-only access to event data. */
export const GOOGLE_SCOPE_CALENDAR_READONLY =
  "https://www.googleapis.com/auth/calendar.events.readonly";

/**
 * OAuth scope for the diario feature (Sprint A): per-file access.
 * `drive.file` only grants visibility to files the app itself creates
 * or that the user opens with the app — it does NOT read the user's
 * existing Drive. Strict by design.
 */
export const GOOGLE_SCOPE_DRIVE_FILE =
  "https://www.googleapis.com/auth/drive.file";

/** Additional scopes always requested for the userinfo lookup. */
const STATIC_SCOPES = ["openid", "email"];

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null; // refresh only returned on first consent
  expiresAt: Date;             // absolute, computed from expires_in + Date.now()
  scope: string;
  tokenType: string;
};

export type NormalizedEvent = {
  externalId: string;
  calendarId: string;
  title: string | null;
  description: string | null;
  location: string | null;
  startsAt: string;            // ISO-8601 UTC
  endsAt: string | null;       // ISO-8601 UTC, null when omitted
  allDay: boolean;
  status: string | null;       // 'confirmed' | 'tentative' | 'cancelled' | null
  htmlLink: string | null;
};

type RawTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type RawUserinfoResponse = {
  id: string;
  email: string;
  verified_email?: boolean;
};

type RawEventTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

type RawEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: RawEventTime;
  end?: RawEventTime;
  status?: string;
  htmlLink?: string;
};

type RawEventsResponse = {
  items?: RawEvent[];
  nextPageToken?: string;
};

/**
 * Build the URL the user is redirected to for OAuth consent.
 * Caller is responsible for generating + verifying `state`.
 */
export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const scopes = params.scopes ?? [GOOGLE_SCOPE_CALENDAR_READONLY, ...STATIC_SCOPES];
  const search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",          // request a refresh_token
    prompt: "consent",                // force refresh_token even on re-auth
    include_granted_scopes: "true",
    state: params.state,
  });
  return `${GOOGLE_AUTH_URL}?${search.toString()}`;
}

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
}

async function readJsonOrThrow(res: Response, what: string): Promise<unknown> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Truncate to keep errors readable while still surfacing useful detail.
    const snippet = text.length > 400 ? text.slice(0, 400) + "…" : text;
    throw new Error(`${what} failed: ${res.status} ${res.statusText} — ${snippet}`);
  }
  return (await res.json()) as unknown;
}

function parseTokenResponse(raw: RawTokenResponse): GoogleTokens {
  // Google's expires_in is seconds-from-now. Convert to absolute Date.
  const expiresAt = new Date(Date.now() + raw.expires_in * 1000);
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresAt,
    scope: raw.scope,
    tokenType: raw.token_type,
  };
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const res = await postForm(GOOGLE_TOKEN_URL, {
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  const raw = (await readJsonOrThrow(res, "exchangeCodeForTokens")) as RawTokenResponse;
  return parseTokenResponse(raw);
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokens> {
  const res = await postForm(GOOGLE_TOKEN_URL, {
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
  });
  const raw = (await readJsonOrThrow(res, "refreshAccessToken")) as RawTokenResponse;
  // Refresh responses don't include a refresh_token; carry forward the existing one.
  const tokens = parseTokenResponse(raw);
  if (!tokens.refreshToken) {
    tokens.refreshToken = params.refreshToken;
  }
  return tokens;
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const raw = (await readJsonOrThrow(res, "getUserEmail")) as RawUserinfoResponse;
  if (!raw.email) {
    throw new Error("getUserEmail: response missing 'email' field");
  }
  return raw.email;
}

/**
 * Convert a Google event's start/end into an ISO-8601 UTC string.
 * For all-day events Google returns { date: "YYYY-MM-DD" } with no time;
 * we synthesise midnight UTC so downstream sort/merge logic stays uniform.
 */
function normalizeTime(t: RawEventTime | undefined): { iso: string | null; allDay: boolean } {
  if (!t) return { iso: null, allDay: false };
  if (t.dateTime) {
    // Already RFC3339; force UTC by relying on ISO parser.
    const d = new Date(t.dateTime);
    if (Number.isNaN(d.getTime())) return { iso: null, allDay: false };
    return { iso: d.toISOString(), allDay: false };
  }
  if (t.date) {
    const d = new Date(`${t.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return { iso: null, allDay: true };
    return { iso: d.toISOString(), allDay: true };
  }
  return { iso: null, allDay: false };
}

/**
 * Strict URL validation for the Google-supplied htmlLink. Anything
 * that doesn't parse as https://*.google.com is dropped. Defence
 * against stored-XSS via javascript:/data: URLs ever landing in the
 * DB and being rendered as <a href> by AgendaEventRow.
 */
function safeHtmlLink(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith(".google.com")) return null;
    return raw;
  } catch {
    return null;
  }
}

export function normalizeEvent(raw: RawEvent, calendarId: string): NormalizedEvent | null {
  const startN = normalizeTime(raw.start);
  if (!startN.iso) return null; // events without a start are unusable
  const endN = normalizeTime(raw.end);
  return {
    externalId: raw.id,
    calendarId,
    title: raw.summary ?? null,
    description: raw.description ?? null,
    location: raw.location ?? null,
    startsAt: startN.iso,
    endsAt: endN.iso,
    allDay: startN.allDay,
    status: raw.status ?? null,
    htmlLink: safeHtmlLink(raw.htmlLink),
  };
}

export async function listEvents(params: {
  accessToken: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
}): Promise<NormalizedEvent[]> {
  const calendarId = params.calendarId ?? "primary";
  const search = new URLSearchParams({
    timeMin: params.timeMin.toISOString(),
    timeMax: params.timeMax.toISOString(),
    singleEvents: "true",            // expand recurring → individual instances
    orderBy: "startTime",
    maxResults: String(params.maxResults ?? 250),
  });
  const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${search.toString()}`;

  const out: NormalizedEvent[] = [];
  let pageUrl = url;
  // Hard cap on pagination to avoid pathological loops (250 × 5 = 1250 events).
  for (let page = 0; page < 5; page++) {
    const res = await fetch(pageUrl, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      cache: "no-store",
    });
    const raw = (await readJsonOrThrow(res, "listEvents")) as RawEventsResponse;
    for (const ev of raw.items ?? []) {
      const norm = normalizeEvent(ev, calendarId);
      if (norm) out.push(norm);
    }
    if (!raw.nextPageToken) break;
    const nextSearch = new URLSearchParams(search);
    nextSearch.set("pageToken", raw.nextPageToken);
    pageUrl = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${nextSearch.toString()}`;
  }
  return out;
}

export async function revokeToken(token: string): Promise<void> {
  const res = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    cache: "no-store",
  });
  // Google returns 200 on success or 400 if the token is already invalid;
  // both outcomes mean "the token is no longer usable", which is what we want.
  if (!res.ok && res.status !== 400) {
    const text = await res.text().catch(() => "");
    throw new Error(`revokeToken failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
}
