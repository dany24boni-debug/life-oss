# Blueprint 17 — Checklist di attivazione (migrazioni · login gate · push)

Aggiornata al run-13. Ogni passo è TUO: le sessioni non toccano mai il
vivo. Ordine consigliato: §0 migrazioni → §0b login gate → push (§1-8).

## 0. Stato migrazioni (run-13): applica 0032 e 0033, IN ORDINE

Il runner è lo stesso di sempre:

```bash
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0032_guided_day_fields.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0033_gym_equipment_profile.sql
```

- **0032** (run-11): `lo_tasks.estimate_min` + `lo_meal_variants.training`.
- **0033** (run-12): `lo_settings.gym_bar_kg` + `lo_settings.gym_plates`.
- Entrambe idempotenti, nessuna ridichiarazione di `lo_push` (la 0029
  resta finale a 28 tabelle). Range completo: **0001 → 0033** (col
  doppio 0016 documentato in AGENTS.md).
- **DOPO l'apply: aggiorna l'app su TUTTI i dispositivi collegati —
  tuoi e di Daniele.** LWW è per-riga: un client VECCHIO che riscrive
  una riga evoluta azzera i campi nuovi al push (`estimate_min`,
  `training`, `gym_bar_kg`, `gym_plates`). La finestra deploy→apply è
  invece sicura (`jsonb_populate_recordset` ignora le chiavi che non
  sono ancora colonne).

## 0b. Il gate del login (tre mosse, dashboard + Vercel)

1. **Redirect URLs** (Supabase → Authentication → URL Configuration):
   aggiungi l'URL di produzione Vercel (`https://<app>.vercel.app/**`)
   accanto a `http://localhost:3000/**`.
2. **`NEXT_PUBLIC_APP_URL`** su Vercel = l'URL di produzione (serve un
   REDEPLOY: è inlined nel bundle al build).
3. **Template OTP** (Supabase → Authentication → Email Templates →
   Magic Link/OTP): il template deve stampare `{{ .Token }}` (il codice
   a 6 cifre che /login/verify chiede), non solo il link.

---

# Push — checklist originale (run-09)

Il CODICE è tutto nel repo dal run-09 (prompt 5): service worker,
card di opt-in in Impostazioni, endpoint `/api/push/*`, Edge Function
`push-sender`, migrazione `0031`. NIENTE è attivo finché non completi
questi passi — ognuno è tuo, la sessione non tocca mai il vivo.
Senza attivazione l'app è INTATTA: la card dice "non ancora attivo su
questo server" e nessun percorso push è raggiungibile.

## 1. Genera le chiavi VAPID (una tantum, locale)

```bash
npx web-push generate-vapid-keys
```

One-shot via npx: NON è una dipendenza del progetto (package.json è
intatto). Conserva le due chiavi nel password manager: la PUBBLICA
andrà in due posti, la PRIVATA solo nei secrets della funzione.

## 2. Applica la migrazione 0031 (dopo la 0030, in ordine)

```bash
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0031_push_alter.sql
```

Aggiunge `categories` a `lo_push_subscriptions` e crea `lo_push_sends`
(idempotenza del sender, solo service role). Nessuna ridichiarazione
di `lo_push`: l'allowlist non cambia.

## 3. Imposta le variabili d'ambiente (3 + 1)

| Dove | Variabile | Valore |
| --- | --- | --- |
| Vercel (+ `.env.local` per dev) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | la chiave PUBBLICA |
| Supabase function secrets | `VAPID_PUBLIC_KEY` | la stessa chiave PUBBLICA |
| Supabase function secrets | `VAPID_PRIVATE_KEY` | la chiave PRIVATA |
| Supabase function secrets | `VAPID_SUBJECT` | `mailto:` con la tua email |

```bash
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:tu@esempio.it"
```

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già iniettate
dalla piattaforma in ogni Edge Function.)

Dopo il set su Vercel serve un REDEPLOY: la chiave pubblica è inlined
nel bundle client al build.

## 4. Deploy della funzione + verifica dipendenze

```bash
supabase functions deploy push-sender --no-verify-jwt
```

`--no-verify-jwt`: la chiama il cron, non un utente (dentro usa il
service role e non legge nessun JWT). Alla PRIMA deploy verifica che
gli import pinnati risolvano ancora (`jsr:@supabase/supabase-js@2.45.4`
e `jsr:@negrel/webpush@0.3.0`); se il deploy si lamenta della versione,
bumpa il pin e rileggi il changelog della lib (API attese:
`importVapidKeys`, `ApplicationServer.new`, `subscribe`,
`pushTextMessage`).

## 5. Schedula il cron (ogni 5 minuti)

Dashboard → Integrations → Cron (pg_cron + pg_net), oppure SQL:

```sql
select cron.schedule(
  'push-sender-every-5m',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-sender',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
```

Le finestre giornaliere vivono NEL codice della funzione (brief
07-08, streak 20-21, Europe/Rome): il cron può girare sempre,
l'idempotenza di `lo_push_sends` fa il resto.

## 6. Requisiti iOS (da sapere, non da configurare)

- iOS 16.4+ e LifeOS INSTALLATA come PWA (Condividi → "Aggiungi alla
  schermata Home"): Safari "normale" non riceve push.
- Il permesso si chiede solo dal gesto nella card di Impostazioni.
- Se l'utente disinstalla la PWA, l'endpoint muore: il sender pulisce
  la riga al primo 404/410.

## 7. Smoke test (telefono bloccato)

1. Da telefono (PWA installata, account fatto): Impostazioni →
   Notifiche push → "Attiva su questo dispositivo" → concedi.
2. Verifica la riga: `select endpoint, categories from lo_push_subscriptions;`
3. Crea un task con promemoria tra 2 minuti (scheda task → Promemoria
   → "All'orario").
4. BLOCCA il telefono e CHIUDI la PWA. Entro ~7 minuti (fire + giro di
   cron) la notifica arriva sulla lock screen.
5. Tocca la notifica: si apre /tasks. Su Oggi, "Mentre eri via" NON la
   ripropone come non gestita? La mostra come scattata (fired) finché
   non la riconosci — comportamento voluto.
6. Il giorno dopo, con "Brief del mattino" attivo: una notifica tra le
   7 e le 9. `select * from lo_push_sends;` mostra una riga `brief:<data>`.

## 8. Rollback (due minuti)

1. Pausa del cron: `select cron.unschedule('push-sender-every-5m');`
2. (Opzionale) `supabase functions delete push-sender`.
3. Ogni dispositivo può disattivarsi da solo dalla card (cancella la
   riga server); per tutti: `truncate lo_push_subscriptions;`.
4. Il resto dell'app non dipende in alcun modo dal percorso push.
