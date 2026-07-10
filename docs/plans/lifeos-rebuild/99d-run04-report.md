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

---

## Prompt 2 — Modulo Calendario (stub 09, B2.4)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · test **600/600** (+21: 13 merge/densità/fusi, 6 parse eventi, 2 `restore` eventi). Dev server DA OSPITE: `/calendar` 200 con griglia mese (`role="grid"`), quick-add e **nessun** blocco Google nell'HTML; Oggi serve la sezione Agenda reale (strip settimana inclusa); zero controlli nativi. Fence read-only provata: `git diff --stat HEAD -- app/agenda app/api/auth/google lib/google lib/calendar` → **output vuoto** (byte-identici).

### Costruito (`app/(app)/calendar/` nuova + `_components/`)

- **Mese + agenda del giorno** (`calendar-screen.tsx`): Calendar Ember (già con swipe touch, frecce, dot ember su oggi) coi puntini di densità da eventi locali vivi + task APERTI datati + Google; tap su un giorno → la sua agenda sotto; deep-link `?giorno=YYYY-MM-DD`. Le query locali coprono [-6, +12] mesi: il Calendar naviga i mesi con stato interno (nessun onMonthChange nell'API) e i markers devono rispondere per ogni giorno visibile — documentato nel file.
- **CRUD eventi locali**: quick-add NL (`event-parse.ts` puro + `event-quick-add.tsx`) che condivide parser e chip dismissibili dei task — differenze deliberate e testate: contano solo data/orario (priorità/tag/module restano nel titolo), senza data vale il giorno selezionato (chip attenuato), fine implicita **+1h** (`defaultEndTime`, clamp 23:59), senza orario = tutto il giorno. Scheda evento (`event-detail.tsx`, BottomSheet/Modal come i task): titolo, giorno (DatePicker), inizio/fine (TimePicker), flag tutto-il-giorno, note, eliminazione col toast Annulla.
- **Port additivo** (convenzione run-03): `EventsRepo.restore(id)` per l'undo — stessa semantica di `TasksRepo.restore`, testato; hook `useEvent(id)`. Gli eventi sincronizzano già via engine del Prompt 1 (`lo_events`) senza toccare nulla: stesso Dexie, stesso segnale mutazioni.
- **Agenda unificata** (`agenda.ts` puro): all-day prima (eventi, poi Google), poi per orario (a parità eventi < task < Google, poi titolo); i task SENZA orario non entrano (vivono nella lista Task); voci source-linked (task → scheda task, evento → scheda evento, Google → badge "Google", read-only). Conversione istanti→giorno/orario in Europe/Rome testata (CEST/CET, cavallo di mezzanotte, fuso invalido→UTC); all-day Google multi-giorno espansi (fine esclusiva, tetto 60 giorni).
- **Google portato, non patchato**: lettura server-side (`google-read.ts`) con account a **LISTA** (mai `.maybeSingle()` — azzardo A2 n.1) e **zero scritture al render** (azzardo A2 n.2: il "holder" custom_modules non serve, gli eventi locali vivono in Dexie). "Sincronizza" = server action nuova (`actions.ts`) che riusa il codice testato di `lib/google` (client API, token store, mapping upsert) su **tutti** gli account collegati. Connect = link all'esistente `/api/auth/google/start`. Ospiti: il blocco non esiste.
- **Oggi**: placeholder Agenda sostituito (edit ancorato sotto) da `TodayAgenda` — strip settimana (tap ≠ oggi → `/calendar?giorno=`), merge reale del giorno, schede al tap.

### Adattamenti alla realtà (brief vs repo)

1. Il brief dice "reuses the existing `lib/calendar` sync code": il codice sync Google vive in **`lib/google/`** (`lib/calendar/` contiene solo `in-presence.ts`, fuori scope). Riusato via import, MAI modificato; nessun wrapper in `lib/calendar` è servito.
2. Il callback OAuth (read-only) reindirizza su `/agenda`: connettendo da `/calendar` si atterra sulla pagina legacy (funzionante). Il cerchio si chiude al prompt 15 (redirect `/agenda`→`/calendar`).
3. "visible range server-side": la tabella `external_calendar_events` contiene SOLO la finestra sync [-7g,+30g], quindi la lettura integrale È il massimo range visibile; mesi fuori finestra mostrano onestamente zero eventi Google.
4. Niente disconnect sulla pagina nuova (il brief non lo chiede): resta su `/agenda` fino al prompt 15. Niente importer eventi legacy (assente dal brief run-04; il gap era già noto nei doc — territorio prompt 15).
5. `lib/nlp-it/**`: nessun bugfix necessario, intatta.

### Edit ancorati a `app/(app)/page.tsx`

Prima (sezione placeholder nell'array `SECTIONS`):
```ts
  {
    eyebrow: "Agenda",
    heading: "Nessun evento in agenda",
    text: "Arriva con il modulo Calendario.",
  },
```
Dopo: voce rimossa (resta solo Palestra) e, tra `<TodayTasks />` e `<UpcomingReminders />`:
```tsx
      {/* Agenda reale (run-04 prompt 09): strip settimana + merge del
          giorno — eventi locali, task con orario, Google read-only. */}
      <TodayAgenda google={googleEvents} />
```
con `googleEvents` letto server-side (`readGoogleBlock`) solo per utenti autenticati (ospiti: `[]`).

**Commit:** `feat(calendar): month/week calendar with NL events, unified agenda, Google read-only port`

---

## Prompt 3 — Modulo Palestra (stub 10, B2.3)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · test **624/624** (+24: 13 logica gym, 7 importer, 3 semina, 1 adapter streak). Dev server DA OSPITE: `/gym` 200 col modulo NUOVO (tab Allenamento/Storico/Libreria/Piani nell'HTML), zero controlli nativi; Oggi ha la sezione Palestra reale (il placeholder "Arriva con il modulo" è sparito ovunque); `/stats` serve il frame "Volume settimanale" vero. `git diff --stat HEAD -- app/body lib/insights lib/fitness.ts` → **vuoto** (intatti, incluse le tabelle legacy: mai toccate).

### Supersessione della rotta legacy (grep-gated)

Grep eseguito prima della rimozione — nessun import di `app/gym/*` da fuori la cartella:
```
$ grep -rn "from \"@/app/gym|app/gym/actions|gym/actions\"" app lib components | grep -v "^app/gym/"
(nessun risultato — exit 1)
```
→ rimossi `app/gym/page.tsx` e `app/gym/actions.ts` (la collisione a `/gym` sarebbe stata un errore di build); il fallback `/palestra` non è servito. Tab "Palestra" della shell → modulo nuovo (flag `legacy` eliminato).

**Unico edit deliberato fuori fence — `proxy.ts` (una riga, quotata):** prima:
```ts
  "/body",
  "/gym",
  "/health",
```
dopo: `"/gym"` rimosso da `PROTECTED_PREFIXES` con commento. Motivo: l'acceptance del brief richiede `/gym` 200 **guest-usable** e il proxy lo avrebbe rimbalzato su /login; la pagina legacy che quella protezione copriva non esiste più. Il resto di proxy.ts è intatto (in particolare il redirect `/login`→`/dashboard` per utenti già autenticati). Nota: anche `app/(app)/stats/stats-screen.tsx` non era elencato nella fence ma il flip del frame è richiesto esplicitamente dal build item 7 e dall'acceptance — edit ancorato sotto.

### Costruito

- **Catalogo seminato** (`data/gym-seed.ts`): 80 esercizi italiani in 8 gruppi, **UUID fissi** (prefisso riservato `01970000-90aa-…`) e timestamp costante `SEED_INSTANT`: due dispositivi che seminano indipendentemente producono righe IDENTICHE → il sync deduplica per costruzione. Semina idempotente che non risuscita né sovrascrive (testato: rinomina e tombstone dell'utente sopravvivono). Recupero predefinito per esercizio (60–180s).
- **Piani**: template nominati con esercizi ordinati (target serie × reps), CRUD in sheet, riordino con frecce, "Inizia" da ogni piano.
- **Sessione** (`session-runner.tsx`): inizia vuota o da piano (gli esercizi del piano compaiono con l'obiettivo "3×10"); loggare una serie = l'hai finita — stepper **±2,5 kg / ±1 rep su tap da 44px**, "Duplica ultima serie" come gesto primario, prima serie prefillata dall'ultima storica; il **timer di recupero** parte da solo (default dell'esercizio, 90s senza), wake-safe: si salva l'istante di inizio e si rende la differenza (`restRemainingS`, testato: 2 minuti a schermo spento = 2 minuti passati), chime WebAudio (stesso pattern dei promemoria) a fine recupero; note sessione; **Concludi** → riepilogo con volume, durata e **record battuti** (`newRecords`: solo se batti strettamente un passato che esiste — la prima sessione non è "tutta record", testato).
- **Progressi** (scheda esercizio): sparkline SVG del miglior carico per giorno (`sparklinePath`, ChartFrame), PR calcolati DAI SET alla lettura (peso max, reps max, volume di sessione migliore) e 1RM stimato riusando `lib/fitness.ts` (Brzycki, read-only).
- **Storico**: lista sessioni (12 mesi) + strip mensile dei giorni di allenamento (riusa `MonthHeat` di /stats); una sessione passata si apre e si MODIFICA con lo stesso runner (senza timer).
- **Importer** (auth-only): server action `fetchLegacyGymData` fa SOLO fetch RLS-scoped delle tabelle legacy (read-only, intatte); la mappatura è pura e testata (`importer.ts`): `gym_sessions` → "sessione semplice" senza set (gruppi+durata nelle note — lo schema nuovo non ha quei campi), `gym_workouts` → una sessione per giorno con le righe **espanse in N set** (la tabella HA la colonna `sets`: espanderla conserva volume e PR reali — deviazione documentata dal "single-set" del brief, tetto 20); nomi normalizzati (accenti/spazi/case) contro il catalogo o esercizio custom in "altro". **Idempotenza per costruzione**: ogni riga ha un id **derivato (SHA-256 → UUIDv8)** dalla riga legacy — rilanci e doppi-import da più dispositivi convergono; la scrittura inserisce solo id assenti. Superfici: card in Impostazioni + prompt inline a storico vuoto. Riepilogo: "Importate N sessioni, M esercizi nuovi e K serie."
- **Oggi**: sezione Palestra reale (`today-gym.tsx`) — nessuna → CTA "Inizia allenamento"; in corso → "Riprendi" col dot vivo; conclusa → riga con volume e durata. **Tile Palestra** di Oggi: sessioni + volume della settimana (era "—"). **Frame /stats**: sessioni + volume settimanali dal port `gymVolumeInRange` (già implementato in run-03, ora alimentato).
- **Streak**: test adapter nuovo — una sessione loggata dal flusso nuovo (sessione+set) rende `todayCounts` vero e il giorno attivo (il gancio `activityDays`→gym esisteva già).

### Edit ancorati

`app/(app)/page.tsx` — prima (ultimo placeholder):
```ts
  {
    eyebrow: "Palestra",
    heading: "Nessun allenamento qui, per ora",
    text: "Arriva con il modulo Palestra.",
  },
```
dopo: array `SECTIONS` eliminato del tutto (era rimasto solo questo) e `<TodayGym />` tra `<TodayTasks />`/`<TodayAgenda />` e `<UpcomingReminders />`.

`app/(app)/_components/app-nav.tsx` — prima:
```ts
  { href: "/gym", label: "Palestra", icon: IconGym, legacy: true },
```
dopo: `{ href: "/gym", label: "Palestra", icon: IconGym },` (+ commento di testa aggiornato, campo `legacy` rimosso dal tipo: non ha più utenti).

`app/(app)/stats/stats-screen.tsx` — prima:
```tsx
      <ChartFrame
        label="Palestra"
        title="Volume settimanale"
        state="empty"
        emptyText="Arriva con il modulo Palestra: qui niente numeri finti."
        minHeight={120}
      />
```
dopo: stato loading/empty/ready da `useGymVolume(week)`, con sessioni e volume formattato ("1.250 kg", B4 — `formatKg` forza il raggruppamento: il CLDR italiano di suo raggruppa solo da 10.000).

**Commit:** `feat(gym): training log with library, plans, set logging, rest timer, PRs, legacy importers`

_(Chiusura e checklist Gate 2 in coda al report.)_
