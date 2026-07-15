/**
 * Notifiche push — il plumbing CLIENT (run-09 prompt 5, blueprint 17):
 * categorie di opt-in, conversione della chiave VAPID pubblica per
 * `pushManager.subscribe`, estrazione del payload di subscription per
 * gli endpoint /api/push. Solo codice: l'attivazione (chiavi, deploy
 * della Edge Function, cron) è di Davide — vedi
 * docs/plans/lifeos-rebuild/17-activation-checklist.md.
 */

import { z } from "zod";

/** Le categorie di notifica, per-dispositivo, opt-in esplicito. */
export const PushCategoriesSchema = z.object({
  reminders: z.boolean(),
  brief: z.boolean(),
  streak: z.boolean(),
});
export type PushCategories = z.infer<typeof PushCategoriesSchema>;

export const DEFAULT_PUSH_CATEGORIES: PushCategories = {
  reminders: true,
  brief: false,
  streak: false,
};

export const PUSH_CATEGORY_LABELS: Array<{
  key: keyof PushCategories;
  label: string;
  desc: string;
}> = [
  {
    key: "reminders",
    label: "Promemoria task",
    desc: "I promemoria suonano anche ad app chiusa.",
  },
  {
    key: "brief",
    label: "Brief del mattino",
    desc: "La riga del buongiorno, una volta al giorno.",
  },
  {
    key: "streak",
    label: "Streak a rischio",
    desc: "La sera, se oggi non conta ancora.",
  },
];

/** Il payload che gli endpoint /api/push si aspettano. */
export const PushSubscribeSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  categories: PushCategoriesSchema,
});
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;

/**
 * Chiave VAPID pubblica (base64url) → Uint8Array per
 * `pushManager.subscribe({ applicationServerKey })`. Pura e testata.
 */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * PushSubscription.toJSON() → payload per /api/push/subscribe.
 * Null quando le chiavi mancano (subscription rotta: non si manda).
 */
export function subscriptionPayload(
  json: PushSubscriptionJSON,
  categories: PushCategories,
): PushSubscribeInput | null {
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth, categories };
}
