import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  __resetKeyCacheForTests,
  decryptToken,
  encryptToken,
} from "./token-cipher";

const ORIGINAL_ENV = process.env.TOKEN_ENCRYPTION_KEY;

function freshKey(): string {
  return randomBytes(32).toString("base64");
}

function setKey(b64: string | undefined): void {
  if (b64 === undefined) {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.TOKEN_ENCRYPTION_KEY = b64;
  }
  __resetKeyCacheForTests();
}

beforeEach(() => {
  setKey(freshKey());
});

afterEach(() => {
  setKey(ORIGINAL_ENV);
});

describe("encryptToken / decryptToken roundtrip", () => {
  it("roundtrips a typical OAuth-style token", () => {
    const plaintext = "sample-refresh-token-abc-123";
    const payload = encryptToken(plaintext);
    expect(decryptToken(payload)).toBe(plaintext);
  });

  it("roundtrips multibyte unicode (emoji, accents)", () => {
    const plaintext = "événement — 📅 prossimo";
    const payload = encryptToken(plaintext);
    expect(decryptToken(payload)).toBe(plaintext);
  });

  it("produces a 3-segment dotted payload", () => {
    const payload = encryptToken("anything");
    expect(payload.split(".").length).toBe(3);
  });

  it("uses a fresh IV per call (same plaintext → different ciphertext)", () => {
    const a = encryptToken("identical-plaintext");
    const b = encryptToken("identical-plaintext");
    expect(a).not.toBe(b);
    // Both still decrypt back to the same value.
    expect(decryptToken(a)).toBe("identical-plaintext");
    expect(decryptToken(b)).toBe("identical-plaintext");
  });
});

describe("decryptToken — tamper resistance", () => {
  it("throws when the ciphertext segment is mutated", () => {
    const payload = encryptToken("untouched-token");
    const [iv, ct, tag] = payload.split(".");
    // Flip the first character of the ciphertext to a guaranteed-different one.
    const swapped = ct[0] === "A" ? "B" : "A";
    const tampered = [iv, swapped + ct.slice(1), tag].join(".");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when the auth tag is mutated", () => {
    const payload = encryptToken("untouched-token");
    const [iv, ct, tag] = payload.split(".");
    const swapped = tag[0] === "A" ? "B" : "A";
    const tampered = [iv, ct, swapped + tag.slice(1)].join(".");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when the IV is mutated", () => {
    const payload = encryptToken("untouched-token");
    const [iv, ct, tag] = payload.split(".");
    const swapped = iv[0] === "A" ? "B" : "A";
    const tampered = [swapped + iv.slice(1), ct, tag].join(".");
    expect(() => decryptToken(tampered)).toThrow();
  });
});

describe("decryptToken — wrong master key", () => {
  it("throws when the master key changes between encrypt and decrypt", () => {
    const payload = encryptToken("locked-with-key-A");
    setKey(freshKey()); // rotate to a different key
    expect(() => decryptToken(payload)).toThrow();
  });
});

describe("input validation", () => {
  it("encryptToken throws on empty string", () => {
    expect(() => encryptToken("")).toThrow(/non-empty/);
  });

  it("decryptToken throws on empty string", () => {
    expect(() => decryptToken("")).toThrow(/non-empty/);
  });

  it("decryptToken throws on malformed (wrong segment count) payload", () => {
    expect(() => decryptToken("only.two")).toThrow(/3 segments/);
    expect(() => decryptToken("a.b.c.d")).toThrow(/3 segments/);
  });
});

describe("env validation", () => {
  it("throws a clear error when TOKEN_ENCRYPTION_KEY is missing", () => {
    setKey(undefined);
    expect(() => encryptToken("anything")).toThrow(/TOKEN_ENCRYPTION_KEY is not set/);
  });

  it("throws a clear error when TOKEN_ENCRYPTION_KEY decodes to wrong byte length", () => {
    // 16 bytes instead of 32.
    setKey(randomBytes(16).toString("base64"));
    expect(() => encryptToken("anything")).toThrow(/exactly 32 bytes/);
  });

  it("accepts base64url-encoded keys (with - and _ chars)", () => {
    // Force a key whose base64 happens to contain '+' or '/', then convert
    // to base64url form. This proves loadKey accepts both encodings.
    let raw = randomBytes(32).toString("base64");
    while (!raw.includes("+") && !raw.includes("/")) {
      raw = randomBytes(32).toString("base64");
    }
    const urlSafe = raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    setKey(urlSafe);

    const payload = encryptToken("works-with-url-safe-key");
    expect(decryptToken(payload)).toBe("works-with-url-safe-key");
  });
});
