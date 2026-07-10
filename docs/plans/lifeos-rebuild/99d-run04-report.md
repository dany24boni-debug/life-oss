# Run 04 — Report di sessione

**Branch:** `feat/run-04` · **Base:** `c5512b91a9a1a237a1bae295bc3327d02b34aa8e` (merge di `feat/run-03` in `main`)
**Modello:** Fable 5, effort max, sessione lunga non presidiata.
**Prompt eseguiti in sequenza:** 08 (sync engine + migrazione guest→account), 09 (calendario), 10 (palestra).

## Pre-flight

- `git status --porcelain` vuoto su `feat/run-04` (branch già creato al pre-flight, HEAD = merge run-03). ✓
- Run-03 in HEAD verificato via `git ls-files`: `data/streak.ts`, `lib/reminders/scheduler.ts`, `app/(app)/tasks/tasks-screen.tsx`, `app/(app)/impostazioni/page.tsx` — tutti presenti. ✓
- Baseline verde: `eslint` pulito, `tsc --noEmit` pulito, `next build --webpack` ok, **558/558 test**. ✓
- Migrazioni esistenti: max `0018` (con il doppio `0016` noto, mai rinumerato) → i nuovi file partono da `0019`. Runner esistente: `scripts/run-migration.mjs`.

---

## Prompt 1 — Sync engine + migrazione guest→account (stub 08, B3.1/B3.2/B3.6)

**Checkpoint: VERDE.** lint ✓ · `tsc --noEmit` ✓ · build ✓ · test **579/579** (baseline 558, **+21**: 17 engine, 5 export/import, riscritto in due il test di migrazione schema Dexie −1+2). Dev server: `/` 200 e `/impostazioni` 200 da ospite, con card "I tuoi dati" (export/import), CTA account e DUE slot `data-sync-dot` nell'HTML servito (Rail + header mobile); zero controlli nativi. La variante autenticata è verificata da build+test (nessuna credenziale in sessione): smoke reale nel gate di Davide.

### Migrazioni SCRITTE, NON applicate (gate di Davide)

- `supabase/migrations/0019_sync_tables.sql` — le 8 tabelle specchio con prefisso **`lo_`** (`lo_tasks`, `lo_events`, `lo_gym_exercises`, `lo_gym_plans`, `lo_gym_sessions`, `lo_gym_sets`, `lo_reminders`, `lo_settings`), indici di pull, RLS per-utente, grant espliciti (lezione 0018), trigger `server_updated_at`, RPC `lo_push`.
- `supabase/migrations/0020_push_subscriptions.sql` — `lo_push_subscriptions` RISERVATA al prompt 17, nessun codice la usa.
- Verificato con grep: nessun file nuovo invoca script Management API o `scripts/*.mjs`; il `package.json` è intatto (zero dipendenze nuove).

**Scelte di schema documentate (deviazioni ragionate dal brief):**
1. **Prefisso `lo_`** su tutte le tabelle nuove: il DB legacy ha già `gym_sessions` (0016) e `user_events` — i nomi nudi collidevano.
2. **Doppio timestamp**: `updated_at` (client, base LWW, MAI toccato dal server) + `server_updated_at` (trigger `now()`, cursore di pull). Il brief chiedeva l'indice di pull su `(user_id, updated_at)`: un cursore sul clock CLIENT perde per sempre le righe pushate in ritardo da un dispositivo offline (updated_at di ieri arriva sul server oggi, i cursori altrui sono già a oggi). L'indice di pull è quindi su `(user_id, server_updated_at)`.
3. **PK composita `(user_id, id)`**: target di conflitto uniforme per l'upsert — funziona anche per `lo_settings` (id = letterale `'local'`, non uuid: adattamento alla realtà di `data/schemas.ts`) — e nessun utente può occupare gli id altrui.
4. **Orari come `text` + check** (non `time`: PostgREST renderebbe `HH:MM:SS` rompendo `HhmmSchema` al round-trip); array/oggetti come `jsonb`; niente FK tra tabelle entità (i push sono per-tabella, l'ordine di arrivo non è garantito — come nel Dexie locale).
5. **RPC `lo_push`** (SECURITY INVOKER + allowlist + `user_id` forzato a `auth.uid()`): l'upsert PostgREST puro non sa esprimere la guardia `where t.updated_at < excluded.updated_at` — senza, un dispositivo stale sovrascriverebbe versioni più nuove. Ritorna le righe davvero scritte (i rimbalzi contano 0).

### Motore (nuova cartella `data/sync/`)

- `tables.ts` (registro tabella locale ↔ remota + parse zod + colonne istante), `remote.ts` (contratto `RemoteStore`: `pushUpsert`/`pullSince`), `remote-supabase.ts` (RPC + SELECT paginata; normalizza i timestamptz `…+00:00` → forma `…Z`), `engine.ts` (cicli pull→push per tabella, cursori in `sync_meta`, overlap di pull 60s, lotti da 200, backoff esponenziale 5s→5min, trigger: focus/visibility/online/intervallo 60s/debounce mutazioni 1.5s), `apply.ts` (apply LWW condiviso da pull e import), `meta.ts`, `signal.ts` (decoratore dei Repos: ogni mutazione ok sveglia l'engine — `appRepos()` in `data/hooks.ts` era il punto di swap previsto da B3.1), `status.ts` + `runtime.ts` (store UI + registro engine), `export.ts`, `wipe.ts`, `fake-remote.ts` (doppio di test instrumentato).
- **Dexie v1→v2**: solo additiva, `sync_meta` chiave/valore (`data/db.ts`, `SCHEMA_V2`); test di migrazione aggiornati (verno 2, upgrade da v1 con dati intatti).
- **Adozione e merge (B3.2) sono lo stesso percorso**: dispositivo non collegato → azzera cursori → full push + full pull con LWW. Il riepilogo "Importati…" conta le righe vive a fine primo ciclo (locale == server), quindi resta onesto anche se un tentativo precedente era morto a metà. `linked_user_id` in sync_meta; il riepilogo scatta una volta per account. Il DB locale non viene MAI svuotato dal sync (B3.2: diventa la cache sincronizzata).
- **Correzione di causalità nei port locali** (`data/local/*`, in fence `data/**`): le scritture su righe esistenti ora timbrano `updated_at` con `bumpFrom(clock, previous) = max(clock(), previous+1ms)` (regola di Lamport, `util.ts`). Senza: una riga pullata con updated_at "nel futuro" del clock locale rendeva le modifiche locali invisibili al push e perdenti nel LWW — scoperto dal test delle tombstone con clock avversari, che ora dimostra proprio questa proprietà. Le create restano a `clock()`.

### UI

- `SyncHost` nel layout della shell (accanto a `RemindersHost`): ciclo di vita dell'engine su `getSession`/`onAuthStateChange`, toast riepilogo primo sync. `SyncDot` accanto al wordmark (Rail + header mobile): respira solo su `syncing` (B4: il dot segna anche sync-in-flight).
- Impostazioni: variante account con riga quieta (ultima sincronizzazione + eventuale errore, letti da `sync_meta` quindi veri anche appena riaperta l'app); "Esci" apre il Modal B3.2 — «Mantieni i dati su questo dispositivo» / «Svuota questo dispositivo» (ferma l'engine, svuota Dexie + cursori, poi `signOut`); card "I tuoi dati" con **Esporta backup JSON / Importa backup** per ospiti E account (import = upsert LWW, mai perdite).

### Atterraggio post-auth (edit ancorati, unici tocchi fuori da (app)/data)

`app/login/actions.ts` — prima:
```ts
  // Stessa destinazione del callback del magic link.
  redirect("/dashboard");
```
dopo: `redirect("/");` (con commento aggiornato).

`app/auth/callback/route.ts` — prima:
```ts
  const next = safeNext(searchParams.get("next"));
```
dopo:
```ts
  const nextParam = searchParams.get("next");
  const next = nextParam === null ? "/" : safeNext(nextParam);
```
Il default diventa la Oggi nuova; un `?next=` esplicito passa ancora da `safeNext`. NON toccati (fuori fence, comportamento invariato): `lib/auth/safe-next.ts` (il suo fallback interno resta `/dashboard`), `/auth/confirm` (flusso implicit legacy), `proxy.ts` (il redirect `/login`→`/dashboard` per utenti già autenticati è com'era).

### Istruzioni per Davide — applicare le migrazioni (dopo D6)

Con il runner esistente, nell'ordine, sul progetto scelto:
```
node scripts/run-migration.mjs supabase/migrations/0019_sync_tables.sql
node scripts/run-migration.mjs supabase/migrations/0020_push_subscriptions.sql
```
(Verificare prima la firma esatta del runner — la sessione non l'ha eseguito, regola 1. PRIMA di tutto: export JSON da Impostazioni su ogni dispositivo con dati.)

**Commit:** `feat(sync): LWW sync engine with guest->account migration and JSON export/import (migrations to apply)`

_(Sezioni per prompt aggiunte man mano, a checkpoint verde.)_
