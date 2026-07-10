import { describe, expect, it } from "vitest";
import {
  detectIos,
  parseDismissed,
  parseVisits,
  shouldShowInstallCard,
} from "./pwa-logic";

describe("parseVisits — localStorage non fidato", () => {
  it("numeri validi passano, il resto è 0", () => {
    expect(parseVisits("0")).toBe(0);
    expect(parseVisits("7")).toBe(7);
    expect(parseVisits(null)).toBe(0);
    expect(parseVisits(undefined)).toBe(0);
    expect(parseVisits("")).toBe(0);
    expect(parseVisits("-3")).toBe(0);
    expect(parseVisits("3.5")).toBe(0);
    expect(parseVisits("abc")).toBe(0);
    expect(parseVisits("999999")).toBe(0); // oltre 5 cifre: malformato
  });

  it("clampa il tetto a 10000", () => {
    expect(parseVisits("99999")).toBe(10_000);
  });
});

describe("parseDismissed", () => {
  it("solo la stringa '1' vale true", () => {
    expect(parseDismissed("1")).toBe(true);
    expect(parseDismissed("true")).toBe(false);
    expect(parseDismissed(null)).toBe(false);
  });
});

describe("shouldShowInstallCard", () => {
  const base = {
    visits: 5,
    dismissed: false,
    standalone: false,
    canPrompt: true,
    isIos: false,
  };

  it("mostra dopo N visite con prompt disponibile", () => {
    expect(shouldShowInstallCard(base)).toBe(true);
  });

  it("mai sotto la soglia di visite", () => {
    expect(shouldShowInstallCard({ ...base, visits: 2 })).toBe(false);
  });

  it("mai se congedata, installata, o piattaforma senza strada", () => {
    expect(shouldShowInstallCard({ ...base, dismissed: true })).toBe(false);
    expect(shouldShowInstallCard({ ...base, standalone: true })).toBe(false);
    expect(
      shouldShowInstallCard({ ...base, canPrompt: false, isIos: false }),
    ).toBe(false);
  });

  it("su iOS basta il coaching (nessun prompt esiste)", () => {
    expect(
      shouldShowInstallCard({ ...base, canPrompt: false, isIos: true }),
    ).toBe(true);
  });
});

describe("detectIos", () => {
  it("riconosce iPhone/iPad dallo user agent", () => {
    expect(detectIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "iPhone", 5)).toBe(true);
    expect(detectIos("Mozilla/5.0 (iPad; CPU OS 16_0)", "iPad", 5)).toBe(true);
  });

  it("riconosce iPadOS 13+ mascherato da Mac col tocco", () => {
    expect(detectIos("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5)).toBe(true);
  });

  it("un Mac vero (senza tocco) non è iOS", () => {
    expect(detectIos("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 0)).toBe(false);
  });

  it("Android non è iOS", () => {
    expect(detectIos("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5)).toBe(false);
  });
});
