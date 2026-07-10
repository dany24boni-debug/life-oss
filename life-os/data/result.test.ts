import { describe, expect, it } from "vitest";
import { attempt, err, isOk, ok } from "./result";

describe("Result", () => {
  it("ok incapsula i dati", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, data: 42 });
    expect(isOk(r)).toBe(true);
  });

  it("err incapsula codice e messaggio", () => {
    const r = err("not_found", "Task non trovato.");
    expect(r).toEqual({
      ok: false,
      error: { code: "not_found", message: "Task non trovato." },
    });
    expect(isOk(r)).toBe(false);
  });

  it("attempt lascia passare i Result", async () => {
    const r = await attempt(async () => ok("x"));
    expect(r).toEqual({ ok: true, data: "x" });
  });

  it("attempt converte le eccezioni in err storage", async () => {
    const r = await attempt<never>(async () => {
      throw new Error("QuotaExceededError");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("storage");
      expect(r.error.message).toContain("QuotaExceededError");
    }
  });
});
