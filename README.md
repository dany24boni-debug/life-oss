# LifeOS

Dashboard personale della vita, **guest-first e local-first**: nove superfici che
funzionano subito e offline coi dati sul dispositivo. Chi si autentica ottiene in
più la **sincronizzazione multi-dispositivo** (motore Last-Writer-Wins verso tabelle
mirror `lo_*` su Supabase). PWA installabile con offline reale.

## Cos'è adesso

- **Guest-first.** Tutte e nove le superfici sono pubbliche e usabili **senza login**,
  coi dati locali (IndexedDB via Dexie). Nessun muro d'autenticazione per usare l'app.
- **Local-first + sync.** Ogni modulo scrive prima in locale (`data/local/`) — l'UI è
  istantanea; se sei loggato, il motore di sync (`data/sync/`) replica in Last-Writer-Wins
  verso le tabelle `lo_*` e converge tra dispositivi.
- **Nove moduli vivi:** Oggi (`/`), Task (`/tasks`), Calendario (`/calendar`, con import
  read-only da Google), Palestra (`/gym`, con rest timer), Statistiche (`/stats`), Esami
  (`/esami`), Spese (`/spese`), Sera (`/sera`, diario serale), Impostazioni (`/impostazioni`).
- **Quattro importer legacy** (in Impostazioni): vecchia Agenda → Calendario, vecchi Esami
  → /esami, vecchie Spese → /spese, vecchie Sere → /sera. Idempotenti (id derivati
  deterministicamente da `data/ids.ts`): rilanciarli non duplica.
- **PWA** installabile: `public/sw.js` con offline reale e ciclo d'aggiornamento sicuro;
  palette comandi, scorciatoie da tastiera, due temi.

> **Superfici legacy.** Dietro il login restano, intatte, alcune rotte dell'app
> pre-rebuild (`/dashboard` e `/agenda` sono redirect verso `/` e `/calendar`; `/business`,
> `/health`, `/body`, `/timeline`, `/insights`, `/recap`, `/custom`, Overseer esistono
> ancora nel tree, non ritirate). Non fanno parte delle nove superfici nuove.

## Requisiti

- **Node.js 20+** (il CI usa Node 20)
- **npm** (incluso con Node)
- *(opzionale)* progetto **Supabase** — serve solo per login + sync
- *(opzionale)* `ANTHROPIC_API_KEY` — moduli legacy Overseer / Today's Call
- *(opzionale)* progetto **Google Cloud** — import Google Calendar in `/calendar`

## Setup da clone pulito

```bash
git clone <repo-url> lifeos
cd lifeos
npm install
cp .env.local.example .env.local     # poi riempi i valori (vedi tabella)
npm run dev                          # http://localhost:3000
```

**Guest mode:** senza toccare Supabase l'app parte e le nove superfici funzionano coi dati
locali. Le variabili d'ambiente servono per login + sync, gli importer legacy e le integrazioni.

### Variabili d'ambiente (`.env.local`)

| Variabile | A cosa serve |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | progetto Supabase — login + sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key — login + sync |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only (query privilegiate lato server) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev |
| `ANTHROPIC_API_KEY` | *opzionale* — moduli legacy Overseer / Today's Call |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` | *opzionale* — Google Calendar in `/calendar` |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM per i token Google a riposo (`openssl rand -base64 32`) |
| `SUPABASE_ACCESS_TOKEN` | **ops-only** (non serve a runtime) — PAT usato dagli script in `scripts/` per applicare le migrazioni via Management API |

## Supabase — migrazioni

Servono solo se vuoi login + sync. Applica **tutte le migrazioni in ordine** col runner
(usa `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`, niente `psql` in locale):

```bash
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0001_init.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0002_fix_profile_trigger.sql
#  … 0003 → 0015 in ordine …
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0016_gym_sessions.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0016_remove_hardcoded_owner_email.sql
#  … 0017 → 0020 in ordine …
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0021_lo_esami.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0022_lo_spese.sql
node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0023_lo_sera.sql
```

Due trappole da conoscere:
- **Doppio 0016.** Esistono *due* file numerati 0016 (`0016_gym_sessions.sql` **e**
  `0016_remove_hardcoded_owner_email.sql`, numero duplicato storico). Applicali entrambi.
- **`lo_push` ridichiarato.** Le migrazioni 0021, 0022 e 0023 **ridichiarano** la tabella
  `lo_push_subscriptions` con l'allowlist via via estesa: **l'ordine conta** (0023 ha la
  versione finale). Applicale in sequenza.

Verifica lo schema: `node --env-file=.env.local scripts/verify-schema.mjs`.

## Comandi

```bash
npm run dev            # dev server → http://localhost:3000
npm run build          # build di produzione (next build --webpack)
npm start              # serve la build di produzione
npm test               # vitest run (suite completa)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run lint:sentinels # grep sentinelle (igiene share-prep)
```

## Architettura (mappa in dieci righe)

- `app/(app)/` — la **shell** delle nove superfici (guest-first); `app/(app)/offline/` è il fallback PWA.
- `data/ports.ts` — i **ports**: l'unica interfaccia con cui l'UI parla ai dati (astrae il locale).
- `data/db.ts` + `data/local/` — store **Dexie** (IndexedDB) e gli adapter per modulo (tasks, events, gym, esami, spese, sera, reminders).
- `data/sync/` — motore **Last-Writer-Wins**: `engine.ts` + `remote-supabase.ts` replicano il locale verso le mirror `lo_*` e riconciliano tra dispositivi; `export.ts` fa il backup JSON, `wipe.ts` l'"Esci → Svuota".
- **`lo_*`** (migrazioni 0019-0023) — tabelle specchio su Supabase, una per store: `lo_tasks`, `lo_events`, `lo_gym_*`, `lo_settings`, `lo_reminders`, `lo_esami`, `lo_spese`, `lo_sera`, più `lo_push_subscriptions`.
- `lib/nlp-it/` — parsing in **italiano** (date, quantità, chip) per l'input rapido.
- `lib/reminders/` — logica **promemoria** (toast "Mentre eri via", export `.ics`).
- `public/sw.js` — **service worker** (offline reale, update-safe). Kill-switch: deploya `public/sw-kill.js.txt` come `sw.js` per disinnescarlo (procedura in `docs/plans/lifeos-rebuild/99e-run05-report.md`).
- **Importer legacy** — in Impostazioni (`app/(app)/impostazioni/`): mappature pure e idempotenti, id derivati deterministicamente.
- `data/ids.ts` — `uuidv7` (chiavi ordinabili) + `deriveUuidV8` (id deterministici: una riga per giorno in Sera, import rilanciabili).

## Deploy (Vercel)

> ### ⚠️ Root Directory = `.`
> Da **run-06** l'app vive nella **radice del repo** (non più in `life-os/`). Su Vercel,
> **Project Settings → Build & Deployment → Root Directory** deve essere la radice
> (`.`, cioè vuoto). Se era puntato a `life-os/`, **cambialo prima/subito dopo il push di
> `main`**, altrimenti il deploy non trova `package.json`.

1. Push su GitHub.
2. Import su <https://vercel.com/new> con **Root Directory = `.`**.
3. Copia le env da `.env.local` nel progetto Vercel (marca come *Sensitive*:
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`,
   `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`).
4. Dopo il primo deploy, aggiungi `<url-produzione>/auth/callback` ai Redirect URLs di
   Supabase (**Authentication → URL Configuration**).
5. iPhone Safari: apri l'URL → **Condividi → Aggiungi a Home** per la PWA.

## Limiti onesti di piattaforma

- **Notifiche.** Niente push server-side attivo: le `lo_push_subscriptions` sono scritte ma
  inutilizzate (prompt 17, opzionale). I promemoria sono **toast in-app** + **export `.ics`**
  da importare nel Calendario iOS — non suonano a app chiusa.
- **PWA su iOS.** Install via "Aggiungi a Home"; l'offline reale funziona, ma le limitazioni
  iOS su background e notifiche restano quelle di Safari.
- **Google Calendar.** Import **read-only** (V0): niente sync bidirezionale né CalDAV.

---

Contesto architetturale e cronologia del rebuild: `docs/plans/lifeos-rebuild/` (audit,
blueprint e i report `99*` per run). Convenzioni di lavoro per gli agenti: `AGENTS.md`.
