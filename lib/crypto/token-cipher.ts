/**
 * AES-256-GCM symmetric cipher for OAuth tokens at rest.
 *
 * Tokens (Google access_token / refresh_token, Apple app-specific
 * passwords later) are stored encrypted in `external_calendar_accounts`
 * and decrypted only in-memory on the server right before calling the
 * provider's API. The master key never leaves the server; it lives in
 * the `TOKEN_ENCRYPTION_KEY` env var (32 bytes, base64-encoded).
 *
 * Payload wire format: "<iv>.<ciphertext>.<authTag>" where each
 * segment is base64url WITHOUT padding. Three '.'-separated parts.
 *
 * Generate a fresh master key with:
 *   openssl rand -base64 32
 *
 * If TOKEN_ENCRYPTION_KEY is missing, encrypt/decrypt throw — failure
 * is loud, never silent.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const IV_BYTES = 12;        // 96-bit IV is the GCM standard
const AUTH_TAG_BYTES = 16;  // 128-bit auth tag
const KEY_BYTES = 32;        // 256-bit key

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` and add it to .env.local.",
    );
  }

  // Accept base64 or base64url input.
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const buf = Buffer.from(normalized, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes ` +
        `(got ${buf.length}). Regenerate with \`openssl rand -base64 32\`.`,
    );
  }

  cachedKey = buf;
  return buf;
}

/**
 * Test-only hook to reset the cached key after mutating
 * process.env.TOKEN_ENCRYPTION_KEY in unit tests. Not for production use.
 *
 * @internal
 */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  // Restore padding so Buffer.from('base64') decodes deterministically.
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

/**
 * Encrypt a UTF-8 plaintext token. Returns "iv.ciphertext.authTag" in
 * base64url. Throws if the env key is missing or invalid.
 */
export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptToken: plaintext must be a non-empty string");
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [toBase64Url(iv), toBase64Url(ct), toBase64Url(tag)].join(".");
}

/**
 * Decrypt a payload produced by encryptToken. Throws on:
 *  - malformed input (wrong segment count, bad base64)
 *  - tampered ciphertext or auth tag (GCM authentication failure)
 *  - wrong master key
 */
export function decryptToken(payload: string): string {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("decryptToken: payload must be a non-empty string");
  }

  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `decryptToken: malformed payload (expected 3 segments, got ${parts.length})`,
    );
  }

  const [ivB64, ctB64, tagB64] = parts;
  const iv = fromBase64Url(ivB64);
  const ct = fromBase64Url(ctB64);
  const tag = fromBase64Url(tagB64);

  if (iv.length !== IV_BYTES) {
    throw new Error(
      `decryptToken: bad IV length ${iv.length} (expected ${IV_BYTES})`,
    );
  }
  if (tag.length !== AUTH_TAG_BYTES) {
    throw new Error(
      `decryptToken: bad auth tag length ${tag.length} (expected ${AUTH_TAG_BYTES})`,
    );
  }

  const key = loadKey();
  const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
