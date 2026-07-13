/**
 * push-sender — Edge Function Supabase (Deno), run-09 prompt 5.
 *
 * BERSAGLIO DI CRON (ogni 5 minuti va bene): legge dalle tabelle lo_*
 * col SERVICE ROLE e spinge Web Push ai dispositivi registrati in
 * lo_push_subscriptions, rispettando l'opt-in per categoria
 * (colonna `categories` della 0031). Tre categorie:
 *
 *   1. reminders — promemoria scaduti e mai gestiti (fire_at <= now,
 *      né fired né dismissed). Dopo l'invio marca fired_at (+ bump di
 *      updated_at, così i client lo PULLANO e non lo risuonano: la
 *      notifica sul telefono È lo scatto — "Mentre eri via" lo
 *      mostrerà comunque, perché fired e non dismissed).
 *   2. brief — il buongiorno, nella finestra 07:00-08:59 Europe/Rome,
 *      una volta al giorno.
 *   3. streak — la sera (20:00-21:59), SOLO se ieri c'era attività e
 *      oggi ancora niente (semplificazione onesta della streak: il
 *      calcolo completo coi giorni protetti vive nel client; qui basta
 *      "avevi qualcosa da tenere e oggi non conta ancora").
 *
 * IDEMPOTENZA: ogni invio passa da lo_push_sends (PK user_id +
 * dedupe_key: "reminder:<id>", "brief:<data>", "streak:<data>") con
 * INSERT ... on conflict do nothing — se la riga c'era già, un altro
 * giro di cron l'ha già mandata e si salta. Il cron può girare quanto
 * vuole: ogni notifica parte UNA volta.
 *
 * PRIVACY: mai loggare il contenuto dei payload — solo conteggi.
 *
 * QUESTO FILE NON VIENE MAI DEPLOYATO DALLA SESSIONE. Deploy, chiavi
 * VAPID, secrets e schedulazione sono il gate di Davide:
 * docs/plans/lifeos-rebuild/17-activation-checklist.md.
 *
 * Dipendenze: import URL/JSR pinnati — è la convenzione della
 * piattaforma Deno (eccezione dichiarata del run-09: solo qui, mai in
 * package.json). Alla prima deploy verifica che le versioni pinnate
 * esistano ancora (passo 4 della checklist).
 */

import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import {
  ApplicationServer,
  importVapidKeys,
  type PushSubscription as WebPushSubscription,
} from "jsr:@negrel/webpush@0.3.0";

/* ── Config e client ─────────────────────────────────────────────────── */

const TIME_ZONE = "Europe/Rome";
/** Finestre delle notifiche giornaliere (ora locale, inizio incluso). */
const BRIEF_HOURS = [7, 8];
const STREAK_HOURS = [20, 21];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  categories: {
    reminders?: boolean;
    brief?: boolean;
    streak?: boolean;
  } | null;
};

type PushPayload = { title: string; body: string; tag?: string; url?: string };

/* ── VAPID: dalle chiavi base64url di `web-push generate-vapid-keys`
      alle CryptoKey ES256 (JWK P-256). La pubblica è il punto EC non
      compresso (65 byte: 0x04 x y), la privata lo scalare d (32). ── */

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function loadAppServer(): Promise<ApplicationServer> {
  const pub = b64urlToBytes(VAPID_PUBLIC_KEY);
  const priv = b64urlToBytes(VAPID_PRIVATE_KEY);
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) {
    throw new Error("Chiavi VAPID non valide (attese base64url di web-push).");
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const d = bytesToB64url(priv);
  const vapidKeys = await importVapidKeys(
    {
      publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
      privateKey: { kty: "EC", crv: "P-256", x, y, d, ext: true },
    },
    { extractable: false },
  );
  return await ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys,
  });
}

/* ── Giorno e ora civili a Roma (Intl, mai aritmetica di timezone) ──── */

function romeNowParts(now: Date): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    day: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hour: Number(pick("hour")),
  };
}

/* ── Idempotenza: la riga di lo_push_sends si conquista, mai si legge ── */

// deno-lint-ignore no-explicit-any
type Db = ReturnType<typeof createClient<any>>;

/** true = questa run ha CONQUISTATO la chiave: tocca a lei inviare. */
async function claimSend(db: Db, userId: string, dedupeKey: string): Promise<boolean> {
  const { error, count } = await db
    .from("lo_push_sends")
    .insert({ user_id: userId, dedupe_key: dedupeKey }, { count: "exact" })
    .select();
  if (error) {
    // 23505 = duplicato: già mandata da un giro precedente.
    if (error.code === "23505") return false;
    console.error("[push-sender] claim error:", error.code);
    return false;
  }
  return (count ?? 0) > 0;
}

/* ── Invio con pulizia degli endpoint morti ──────────────────────────── */

async function sendTo(
  app: ApplicationServer,
  db: Db,
  sub: SubscriptionRow,
  payload: PushPayload,
): Promise<boolean> {
  const webPushSub: WebPushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  try {
    const subscriber = app.subscribe(webPushSub);
    await subscriber.pushTextMessage(JSON.stringify(payload), {});
    return true;
  } catch (err) {
    // 404/410 = subscription morta presso il push service: la riga
    // server si pulisce, il dispositivo si ri-registrerà da solo.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 410) {
      await db.from("lo_push_subscriptions").delete().eq("id", sub.id);
      console.log("[push-sender] endpoint morto rimosso");
    } else {
      console.error("[push-sender] send error (status:", status, ")");
    }
    return false;
  }
}

/* ── Le tre categorie ────────────────────────────────────────────────── */

async function sendDueReminders(
  app: ApplicationServer,
  db: Db,
  subs: SubscriptionRow[],
  nowIso: string,
): Promise<number> {
  const targets = subs.filter((s) => s.categories?.reminders === true);
  if (targets.length === 0) return 0;
  const userIds = [...new Set(targets.map((s) => s.user_id))];

  const { data: due, error } = await db
    .from("lo_reminders")
    .select("id, user_id, kind, ref_id, fire_at")
    .in("user_id", userIds)
    .lte("fire_at", nowIso)
    .is("fired_at", null)
    .is("dismissed_at", null)
    .is("deleted_at", null)
    .limit(100);
  if (error || !due) return 0;

  let sent = 0;
  for (const reminder of due) {
    if (!(await claimSend(db, reminder.user_id, `reminder:${reminder.id}`))) {
      continue;
    }
    // Il titolo VERO del task/evento (una query mirata, mai dump).
    const table = reminder.kind === "task" ? "lo_tasks" : "lo_events";
    const { data: ref } = await db
      .from(table)
      .select("title")
      .eq("user_id", reminder.user_id)
      .eq("id", reminder.ref_id)
      .is("deleted_at", null)
      .maybeSingle();
    const payload: PushPayload = {
      title: ref?.title ?? "Promemoria",
      body: reminder.kind === "task" ? "È il momento." : "Sta per iniziare.",
      tag: `reminder-${reminder.id}`,
      url: reminder.kind === "task" ? "/tasks" : "/calendar",
    };
    let delivered = false;
    for (const sub of targets.filter((s) => s.user_id === reminder.user_id)) {
      delivered = (await sendTo(app, db, sub, payload)) || delivered;
    }
    if (delivered) {
      sent++;
      // Scattato DAVVERO (sul telefono): i client lo pullano e non lo
      // risuonano; "Mentre eri via" lo mostra (fired, non dismissed).
      await db
        .from("lo_reminders")
        .update({ fired_at: nowIso, updated_at: nowIso })
        .eq("user_id", reminder.user_id)
        .eq("id", reminder.id);
    }
  }
  return sent;
}

async function sendMorningBriefs(
  app: ApplicationServer,
  db: Db,
  subs: SubscriptionRow[],
  today: string,
): Promise<number> {
  const targets = subs.filter((s) => s.categories?.brief === true);
  let sent = 0;
  for (const userId of [...new Set(targets.map((s) => s.user_id))]) {
    if (!(await claimSend(db, userId, `brief:${today}`))) continue;
    // Una riga onesta e minima: il conteggio VERO dei task di oggi.
    // (La riga ricca vive nel client, che ha tutti i moduli locali.)
    const { count } = await db
      .from("lo_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", today)
      .eq("status", "open")
      .is("deleted_at", null);
    const n = count ?? 0;
    const payload: PushPayload = {
      title: "Buongiorno",
      body:
        n === 0
          ? "Niente task in scadenza oggi. Apri per il resto della giornata."
          : n === 1
            ? "1 task per oggi. Apri per il resto."
            : `${n} task per oggi. Apri per il resto.`,
      tag: `brief-${today}`,
      url: "/",
    };
    let delivered = false;
    for (const sub of targets.filter((s) => s.user_id === userId)) {
      delivered = (await sendTo(app, db, sub, payload)) || delivered;
    }
    if (delivered) sent++;
  }
  return sent;
}

async function sendStreakRisk(
  app: ApplicationServer,
  db: Db,
  subs: SubscriptionRow[],
  today: string,
  yesterday: string,
): Promise<number> {
  const targets = subs.filter((s) => s.categories?.streak === true);
  let sent = 0;
  for (const userId of [...new Set(targets.map((s) => s.user_id))]) {
    // Attività di un giorno: task completato, sessione gym chiusa,
    // log abitudine con valore, fase focus. Stesse fonti di
    // activityDays del client, in forma di EXISTS veloci.
    const activeToday = await hasActivityOn(db, userId, today);
    if (activeToday) continue; // oggi conta già: niente da dire
    const activeYesterday = await hasActivityOn(db, userId, yesterday);
    if (!activeYesterday) continue; // niente streak da tenere: silenzio
    if (!(await claimSend(db, userId, `streak:${today}`))) continue;
    const payload: PushPayload = {
      title: "La streak si tiene con poco",
      body: "Oggi non conta ancora: basta un task, un allenamento o un'abitudine.",
      tag: `streak-${today}`,
      url: "/",
    };
    let delivered = false;
    for (const sub of targets.filter((s) => s.user_id === userId)) {
      delivered = (await sendTo(app, db, sub, payload)) || delivered;
    }
    if (delivered) sent++;
  }
  return sent;
}

async function hasActivityOn(
  db: Db,
  userId: string,
  day: string,
): Promise<boolean> {
  const dayStart = `${day}T00:00:00.000Z`;
  const dayEnd = `${day}T23:59:59.999Z`;
  // NOTA: confronto sul giorno UTC per i task completati — a Roma può
  // sbagliare di un'ora o due ai bordi; per un promemoria serale è una
  // approssimazione accettabile e SILENZIOSA (al massimo tace).
  const checks = await Promise.all([
    db
      .from("lo_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("completed_at", dayStart)
      .lte("completed_at", dayEnd)
      .is("deleted_at", null),
    db
      .from("lo_gym_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", day)
      .not("finished_at", "is", null)
      .is("deleted_at", null),
    db
      .from("lo_habit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", day)
      .gt("value", 0)
      .is("deleted_at", null),
    db
      .from("lo_focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", day)
      .is("deleted_at", null),
  ]);
  return checks.some((c) => (c.count ?? 0) > 0);
}

/* ── Entry point ─────────────────────────────────────────────────────── */

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "missing_supabase_env" }), {
      status: 500,
    });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "missing_vapid_env" }), {
      status: 500,
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const app = await loadAppServer();

  const now = new Date();
  const nowIso = now.toISOString();
  const { day: today, hour } = romeNowParts(now);
  const yesterday = romeNowParts(new Date(now.getTime() - 86_400_000)).day;

  const { data: subs, error } = await db
    .from("lo_push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, categories")
    .not("categories", "is", null);
  if (error) {
    console.error("[push-sender] subscriptions error:", error.code);
    return new Response(JSON.stringify({ error: "storage" }), { status: 500 });
  }

  const rows = (subs ?? []) as SubscriptionRow[];
  const reminders = await sendDueReminders(app, db, rows, nowIso);
  const briefs = BRIEF_HOURS.includes(hour)
    ? await sendMorningBriefs(app, db, rows, today)
    : 0;
  const streaks = STREAK_HOURS.includes(hour)
    ? await sendStreakRisk(app, db, rows, today, yesterday)
    : 0;

  // Solo conteggi nel log: mai contenuti.
  console.log(
    `[push-sender] subs=${rows.length} reminders=${reminders} briefs=${briefs} streaks=${streaks}`,
  );
  return new Response(
    JSON.stringify({ ok: true, reminders, briefs, streaks }),
    { headers: { "Content-Type": "application/json" } },
  );
});
