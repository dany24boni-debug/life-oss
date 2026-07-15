import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUSH_CATEGORIES,
  PushCategoriesSchema,
  PushSubscribeSchema,
  subscriptionPayload,
  urlBase64ToUint8Array,
} from "./push";

describe("push — plumbing client (run-09 P5)", () => {
  it("urlBase64ToUint8Array: base64url senza padding → byte giusti", () => {
    // "AQIDBA" è base64url di [1,2,3,4] (senza '='): il formato delle
    // chiavi VAPID di `web-push generate-vapid-keys`.
    expect([...urlBase64ToUint8Array("AQIDBA")]).toEqual([1, 2, 3, 4]);
    // Caratteri url-safe: '-' e '_' al posto di '+' e '/'.
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
    // Una chiave P-256 non compressa è 65 byte.
    const key = "BPzhHrmDZC5NPX0ZTKcW7Q6TSNlIVdGmGnW5nQ8xzn" +
      "Ky5b1JcJ2QJXW1yLxXQF0aYQZ0eHhKXO6uzXBmYFxq6Hk";
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });

  it("subscriptionPayload: estrae endpoint e chiavi; rotta → null", () => {
    const good = subscriptionPayload(
      {
        endpoint: "https://push.example.com/sub/abc",
        keys: { p256dh: "chiave", auth: "segreto" },
      },
      DEFAULT_PUSH_CATEGORIES,
    );
    expect(good).toEqual({
      endpoint: "https://push.example.com/sub/abc",
      p256dh: "chiave",
      auth: "segreto",
      categories: { reminders: true, brief: false, streak: false },
    });
    expect(PushSubscribeSchema.safeParse(good).success).toBe(true);

    expect(
      subscriptionPayload(
        { endpoint: "https://push.example.com/x" },
        DEFAULT_PUSH_CATEGORIES,
      ),
    ).toBeNull();
  });

  it("le categorie sono un oggetto chiuso di tre boolean", () => {
    expect(PushCategoriesSchema.safeParse(DEFAULT_PUSH_CATEGORIES).success).toBe(
      true,
    );
    expect(
      PushCategoriesSchema.safeParse({ reminders: true, brief: false }).success,
    ).toBe(false);
  });
});
