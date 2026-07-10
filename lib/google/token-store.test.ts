/**
 * Tests for the defence-in-depth checks on the `preloaded` path of
 * getValidAccessToken. These checks fire before any Supabase or
 * crypto code runs, so the tests use a stub Supabase client that
 * would error loudly if it were touched.
 *
 * Hot-path coverage (decrypt, refresh, persist) is exercised
 * indirectly via the agenda sync integration tests — not duplicated
 * here.
 */

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getValidAccessToken,
  type PreloadedTokenAccount,
} from "./token-store";

const SUPABASE_NEVER_CALLED = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(
        `supabase.${String(prop)} was called — defence check should have thrown first`,
      );
    },
  },
) as unknown as SupabaseClient;

function row(overrides: Partial<PreloadedTokenAccount> = {}): PreloadedTokenAccount {
  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    user_id: "00000000-0000-0000-0000-0000000000bb",
    provider: "google",
    access_token_ciphertext: "ct_access",
    refresh_token_ciphertext: "ct_refresh",
    access_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("getValidAccessToken — preloaded defence checks", () => {
  it("throws when preloaded.id does not match the stated accountId", async () => {
    const preloaded = row({ id: "id-A" });
    await expect(
      getValidAccessToken(
        SUPABASE_NEVER_CALLED,
        "id-B",
        preloaded.user_id,
        preloaded,
      ),
    ).rejects.toThrow(/preloaded account id mismatch/);
  });

  it("throws when preloaded.user_id does not match the stated userId", async () => {
    const preloaded = row({ user_id: "user-A" });
    await expect(
      getValidAccessToken(
        SUPABASE_NEVER_CALLED,
        preloaded.id,
        "user-B",
        preloaded,
      ),
    ).rejects.toThrow(/preloaded account user_id mismatch/);
  });

  it("checks id BEFORE user_id (id-mismatch wins if both differ)", async () => {
    // Order isn't semantically critical, but pinning it documents
    // the current contract. If a future refactor swaps the order,
    // this test forces a deliberate update.
    const preloaded = row({ id: "id-A", user_id: "user-A" });
    await expect(
      getValidAccessToken(
        SUPABASE_NEVER_CALLED,
        "id-B",
        "user-B",
        preloaded,
      ),
    ).rejects.toThrow(/preloaded account id mismatch/);
  });

  it("rejects an obviously hostile cross-user handoff (row A vs userId B, id matches)", async () => {
    // Scenario: a future caller fetched row belonging to user-A
    // and tries to use it as if it were user-B's. id-mismatch
    // doesn't catch this — but user_id-mismatch does.
    const rowForUserA = row({
      id: "00000000-0000-0000-0000-00000000aaaa",
      user_id: "user-A",
    });
    await expect(
      getValidAccessToken(
        SUPABASE_NEVER_CALLED,
        rowForUserA.id,
        "user-B",
        rowForUserA,
      ),
    ).rejects.toThrow(/preloaded account user_id mismatch/);
  });
});
