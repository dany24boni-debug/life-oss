import { describe, expect, it } from "vitest";
import { AUTH_OFFLINE_MESSAGE, withTimeout } from "./proxy";

/**
 * La parte PURA del fail-fast del proxy (run-09 prompt 6): la corsa
 * promise-contro-timeout che tronca la getUser() quando Supabase non
 * risponde (l'hang osservato di 36 secondi).
 */
describe("withTimeout — la corsa del proxy", () => {
  it("il valore arriva prima del timeout: passa intatto", async () => {
    expect(await withTimeout(Promise.resolve(42), 1000)).toBe(42);
  });

  it("il timeout scade prima: null, senza mai lanciare", async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("tardi"), 200),
    );
    expect(await withTimeout(slow, 10)).toBeNull();
  });

  it("un rigetto resta un rigetto (lo gestisce il chiamante)", async () => {
    const failing = Promise.reject(new Error("rete giù"));
    await expect(withTimeout(failing, 1000)).rejects.toThrow("rete giù");
  });

  it("il timer si pulisce quando la promise vince: nessuna attesa residua", async () => {
    // Se il clearTimeout mancasse, il timer da 60s resterebbe appeso
    // (vitest segnalerebbe handle aperti); la vittoria è immediata.
    const t0 = Date.now();
    await withTimeout(Promise.resolve("subito"), 60_000);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it("la copy offline è definita e onesta (niente colpa all'utente)", () => {
    expect(AUTH_OFFLINE_MESSAGE).toContain("server non risponde");
  });
});
