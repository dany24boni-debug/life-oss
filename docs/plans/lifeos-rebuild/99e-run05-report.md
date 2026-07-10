# Run 05 — Report di sessione

**Branch:** `feat/run-05` · **Base:** `8a054976fd768b75b205845a4e6b2c795f5a38ed` (merge di `feat/run-04` in `main`)
**Modello:** Fable 5, effort max, sessione lunga non presidiata.
**Prompt in sequenza:** 1 ritiro legacy, 2 PWA/offline (stub 13), 3 Esami, 4 Spese, 5 Sera (stub 15), 6 Comfort (stub 14).

## Pre-flight

- `git status --porcelain` vuoto su `main`, HEAD `8a05497`. Branch `feat/run-05` creato. ✓
- Run-04 in HEAD via `git ls-files`: `data/sync/engine.ts`, `supabase/migrations/0019_sync_tables.sql`, 13 file in `app/(app)/gym/`, 10 in `app/(app)/calendar/`. ✓
- Baseline verde: `eslint` pulito, `tsc --noEmit` pulito, `next build --webpack` ok, **624/624 test**. ✓
- Migrazioni esistenti: max `0020` → i nuovi file partono da `0021`.

---

## Prompt 1 — Ritiro del mondo legacy + atterraggi auth coerenti

**Checkpoint: VERDE.** lint ✓ · `tsc --noEmit` ✓ (dopo `rm -rf .next/dev`: tipi GENERATI stantii del dev server che referenziavano `app/commute` — artefatto di build, non codice) · build ✓ · test **607/607** (baseline 624: **−22** morti col codice morto — 9 `lib/voglia/today-call.test.ts`, 5 `lib/voglia/detection.test.ts`, 8 describe commute in `lib/validation/local-storage.test.ts`; **+5** nuovi `app/(app)/calendar/importer.test.ts`). Dev server da ospite: `/dashboard` 307→`/login` (protezione proxy intatta; l'utente autenticato riceve il `redirect("/")` della pagina, build-verified), `/agenda` 307→`/login` (idem, autenticato → `/calendar`), `/calendar` 200 con griglia mese e ZERO blocco Google/prompt import (ospite), `/` 200 con **zero** occorrenze di "Vecchia dashboard", `/more` 307→`/login` (variante autenticata build-verified), `/impostazioni` 200; zero controlli nativi nell'HTML servito.

### Ricollocazioni PRIMA delle cancellazioni (grep-gated)

Grep degli import vivi dal set di cancellazione (dashboard, mock-data, voglia, commute, agenda/actions):

```
$ grep -rn "app/dashboard" app lib components data ui --include="*.ts" --include="*.tsx" | grep -v "^app/dashboard/"
app/(app)/impostazioni/account-sync.tsx:20:import { signOut } from "@/app/dashboard/actions";
app/more/page.tsx:8:import { Avatar } from "@/app/dashboard/_components/avatar";
app/more/page.tsx:9:import { signOut } from "@/app/dashboard/actions";
(+ 2 hit solo-commento in lib/mock-data.ts, morto anche lui)

$ grep -rn "mock-data" app lib components data ui ... | grep -v "^lib/mock-data"
app/recap/page.tsx:13:import { emojiForModule } from "@/lib/mock-data";
(+ import interni al set: app/dashboard/page.tsx, dashboard-client.tsx)

$ grep -rn "lib/voglia" app lib components data ui ... | grep -v "^lib/voglia/"
app/dashboard/page.tsx:8:import { stubTodaysCall } from "@/lib/voglia/today-call";
(+ 3 hit solo-commento in components/ui/todays-call-banner.tsx — nessun import)

$ grep -rn "commute" ... (fuori dal set)
app/more/page.tsx:10:import { CommuteToggle } from "./_components/commute-toggle";
lib/validation/local-storage.ts (sezione commute) — consumatori: SOLO banner+toggle
(+ hit solo-commento/testo in lib/tasks/generator.ts, lib/calendar/in-presence.ts, lib/overseer/context.ts — nessun import di codice commute)

$ grep -rn "agenda/actions|from \"@/app/agenda" app lib components data ui ...
(nessun risultato: le action della /agenda legacy non hanno importatori esterni)
```

Ricollocazioni conseguenti (1:1, corpo invariato):
1. **`signOut`** → nuovo `lib/auth/actions.ts` (`"use server"`), come raccomandato dal brief. Import aggiornati: `app/(app)/impostazioni/account-sync.tsx` e `app/more/page.tsx` (`@/app/dashboard/actions` → `@/lib/auth/actions`).
2. **`Avatar`** → `components/ui/avatar.tsx` (la casa dei componenti UI legacy condivisi: SectionHeader, StatusPill…). Import aggiornato in `/more`. *Delta dichiarato rispetto all'acceptance "diff di /more solo commute"*: l'import di Avatar/signOut era inevitabile — il build item 1 ("relocate or adapt each before deleting") prevale.
3. **`emojiForModule` + `MODULE_EMOJI`** → nuovo `lib/module-emoji.ts`. Import aggiornato in `app/recap/page.tsx` (una riga). *Stesso delta dichiarato*: /recap importava dal file dei mock; senza ricollocazione la cancellazione di `lib/mock-data.ts` era impossibile (regola 3). Emoji preservate identiche: sono la resa attuale di /recap (D4).

### Disconnect Google portato su /calendar

`app/(app)/calendar/actions.ts` — nuova `disconnectGoogleAccount(accountId)`: stessa logica server della legacy `disconnectGoogleCalendar` (revoca best-effort con `decryptToken` + `revokeToken` di `lib/crypto`/`lib/google` — riusati, MAI reimplementati; poi delete della riga, gli eventi cascadono). Differenza deliberata: **per-account** (`.eq("id").eq("user_id")`), multi-account safe — mai `.maybeSingle()` sul provider. UI: bottone "Disconnetti" ghost per ogni account nel `GoogleBlock` di `calendar-screen.tsx`, con pending via `useFormStatus`.

### Importer eventi locali della /agenda legacy (pattern gym)

- `import-actions.ts` (server, auth-only): fetch RLS-scoped read-only del holder `custom_modules` kind=calendar nome "Agenda principale" (a LISTA, mai maybeSingle) e delle sue `custom_module_entries` (id, date, label, notes, created_at). Gli ALTRI moduli kind=calendar restano fuori: vivono in /custom (D4), importarli duplicherebbe.
- `importer.ts` (puro, testato): riga legacy → `LocalEvent` **tutto-il-giorno** (il modello legacy non aveva orari); id **derivati** `deriveId("lifeos-import:agenda_entry:<id>")` (la stessa SHA-256→UUIDv8 del gym, importata da `../gym/importer`) → rilanci e doppi import convergono; trim + cap dello schema (500/2000); righe senza label o con data malformata saltate e contate.
- `import-run.ts` (client): inserisce SOLO id assenti in `db.events`, poi `notifyLocalMutation()` — il sync le porta su come qualsiasi riga.
- `import-button.tsx`: `CalendarImportButton` con toast riepilogo ("Importati N eventi…" / "Già tutto importato…").
- Superfici: card "Vecchia agenda" in Impostazioni accanto al gym; prompt inline su /calendar quando `google !== null` (= autenticato) e zero eventi locali nella finestra [-6,+12] mesi.

### Cancellazioni eseguite (grep sopra)

`app/dashboard/_components/` (13 file), `app/dashboard/actions.ts` (motore morto, ~600 righe: signOut era l'unico export vivo, già ricollocato), `app/commute/` (pagina placeholder), `app/more/_components/commute-toggle.tsx`, `lib/mock-data.ts`, `lib/voglia/` (compute, detection+test, today-call+test), `app/agenda/actions.ts` (refresh/disconnect: entrambi già ri-esistenti su /calendar). Sezione commute di `lib/validation/local-storage.ts` rimossa (orfana: schema+parse usati solo da banner/toggle morti); la sezione diary resta (viva via `app/sera`, fino al prompt 5).

### Redirect

- `app/dashboard/page.tsx` → server `redirect("/")` (rotta conservata per i segnalibri; protezione proxy invariata).
- `app/agenda/page.tsx` → `redirect("/calendar")`, con **inoltro dei parametri del callback OAuth** (che atterra ancora su `/agenda` — API route NON toccata): `?connected=` → `/calendar?google_connected=1`, `?error=<slug>` → `/calendar?google_error=<slug>` (slug ri-sanitizzati `[a-z0-9_]{1,40}`, difesa in profondità — la route li allowlista già). La pagina /calendar rende i due banner (successo salvia / errore segnale, copy B4) — senza, il feedback di connessione della legacy sarebbe andato perso ("nothing live breaks").

### Atterraggi auth (edit ancorati)

`proxy.ts` — prima:
```ts
  if (isAuthOnly && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
```
dopo: `url.pathname = "/";` (+ commento). Il resto di PROTECTED_PREFIXES è INTATTO, inclusi `/dashboard`, `/agenda`, `/commute` (prefissi ora coprono redirect o 404 — inerti per gli autenticati, /login per gli ospiti; il brief chiedeva solo la riga di /login).

`lib/auth/safe-next.ts` — i quattro fallback `return "/dashboard";` → `return "/";` (+ commento aggiornato). Verificato per lettura che `/auth/confirm` (page.tsx:18) e `/auth/callback` (route.ts:39) chiamano `safeNext` → ereditano il fallback senza ristrutturazioni.

### Oggi

Ponte "Vecchia dashboard" rimosso da `app/(app)/page.tsx` — prima:
```tsx
          {user ? (
            <Link
              href="/dashboard" ...>
              Vecchia dashboard
            </Link>
          ) : ( <span>I tuoi dati vivono su questo dispositivo. …</span> )}
```
dopo: resta solo la nota ospite (`{!user ? … : null}`); commento di testa aggiornato.

### Fence audit

`git diff HEAD --stat` su `app/business app/custom app/health app/body app/timeline app/insights app/settings app/onboarding app/(app)/gym app/(app)/tasks app/(app)/stats lib/google lib/crypto lib/anthropic app/api` → **vuoto**. `/more`: solo rimozione card commute + i due import ricollocati; `/recap`: solo la riga d'import. Residuo dichiarato FUORI fence, lasciato com'è: `components/ui/todays-call-banner.tsx` ora è privo di importatori (era usato solo dalla dashboard-client) — cartella non in fence, morte da registrare al prompt 16 (cleanup).

**Commit:** `feat(retire): delete mock dashboard world, redirect legacy routes, coherent auth landings`

---

## Prompt 2 — PWA + offline (stub 13)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · test **618/618** (+11: `pwa-logic.test.ts` — parse difensivi localStorage, regole della card, rilevazione iOS/iPadOS). Runtime pass su build di produzione (`next build` + `next start`): `/sw.js` **200** con `Cache-Control: public, max-age=0` (semantica no-cache già di default → **nessun edit a next.config.ts, flag chiuso**), `/offline` **200** e prerender **statico** (○ nel build output) con la copy onesta servita, `manifest.webmanifest` 200 `application/manifest+json`, `/icon-512` e `/icon-512?maskable=1` 200 `image/png`, e la chiamata `register("/sw.js",{scope:"/"})` presente nel chunk `layout-*.js` del gruppo (app) referenziato dall'HTML servito. Dev intatto: la registrazione è dietro `process.env.NODE_ENV === "production"`.

### Service worker (`public/sw.js`, JS puro, zero dipendenze)

`SW_VERSION` nei nomi cache (`lifeos-pages/static/assets-v1`); **runtime caching puro, nessun precache manifest di build** (build webpack, nessun plugin — `next-pwa` resta fuori, regola 7):
- **Navigazioni** → network-first; si cacheano solo risposte `ok && !redirected` (i redirect del proxy — es. rotte protette → /login — e gli errori non diventano mai fallback); fallback cache → `/offline` → 503 testuale.
- **`/_next/static/**`** → cache-first (nomi content-hashed, immutabili per natura).
- **Font/icone/manifest** → stale-while-revalidate (i font di `next/font` sono self-hosted sotto `/_next/static/media`, quindi già coperti dal cache-first; il bucket copre manifest, `/icon*`, `/icons/`, svg/png/woff2).
- **MAI cache**: `/api/**` e `/sw.js` (bypass esplicito), richieste non-GET, e OGNI origine esterna (Supabase/Google sono cross-origin: il fetch handler li ignora del tutto — il browser li gestisce senza SW).
- `activate` cancella ogni cache `lifeos-*` di versioni precedenti + `clients.claim()`; `message: SKIP_WAITING` → `skipWaiting()`.
- La pagina `/offline` si ri-cachea a OGNI install (HTML fresco → chunk freschi). Limite onesto documentato: subito dopo un update, i chunk della pagina offline sono in cache solo se già usati dalla navigazione normale (runtime caching, per costruzione); l'HTML SSR resta comunque leggibile.

### Flusso di aggiornamento + kill-switch

`PwaHost` (client, nel layout della shell dentro `ToastProvider`): registra il SW, e su `updatefound`/`waiting` mostra il toast Ember "Nuova versione disponibile — **Aggiorna**" → `postMessage("SKIP_WAITING")` → `controllerchange` → reload. Il reload scatta **solo nella tab che l'ha chiesto** (flag `wantsReload`): il primo install (`clients.claim`) e gli update partiti da altre tab non ricaricano mai sotto i piedi. Check aggiornamenti anche a ogni ritorno in foreground (`visibilitychange` → `registration.update()`).

**KILL-SWITCH** (per Davide): se un deploy lasciasse client bloccati, rinominare `public/sw-kill.js.txt` in `sw.js` e deployare — install: `skipWaiting`; activate: cancella TUTTE le cache `lifeos-*`, `unregister()`, e naviga i client aperti (= reload dalla rete, senza SW). Il template è nel repo, commentato. Rientro: rideployare il sw.js normale con una `SW_VERSION` nuova.

**Ciclo d'aggiornamento (walkthrough per il gate):** deploy nuovo → una tab aperta torna in foreground → `update()` scarica il sw.js nuovo (byte diversi) → install (ri-cachea /offline) → waiting → toast → "Aggiorna" → il SW nuovo si attiva, cancella le cache vecchie → reload → asset nuovi. Senza tap: il SW nuovo si attiva comunque alla prossima chiusura completa dell'app.

### Offline fallback

`app/(app)/offline/page.tsx` — statica per costruzione (`force-static`, nessun dato per-utente): "Sei offline — i tuoi dati locali sono comunque qui" + spiegazione onesta (è la pagina mai visitata a mancare, non i dati) + link "Torna a Oggi". Dentro la shell (fence), quindi con Rail/TabBar.

### Install UX

- `pwa-store.ts`: cattura di `beforeinstallprompt` (tipo dichiarato: API solo-Chromium) fuori da React, consumo via `useSyncExternalStore`; `appinstalled` → `installed`.
- `pwa-install.tsx`: **InstallSection** in Impostazioni (card "App" quieta: prompt nativo dove esiste; su iOS Safari non-standalone apre il BottomSheet di coaching "Condividi → Aggiungi alla schermata Home", 3 passi); **InstallTodayCard** su Oggi — compare dopo **3 aperture** dell'app (contatore per-dispositivo `lifeos.pwa.visits`, incrementato da PwaHost a ogni mount della shell), congedabile per sempre ("Non ora" → `lifeos.pwa.installCardDismissed`), in fondo alla pagina (gentile, mai la prima cosa). TUTTO sparisce in display-mode standalone o dove non esiste una strada (né prompt né iOS): mai promettere l'impossibile.
- Rilevazioni al render post-idratazione con l'idioma `useSyncExternalStore` di `ui/internal.tsx` (la prima stesura usava setState-in-effect: bocciata da `react-hooks/set-state-in-effect`, riscritta senza effect).
- iPadOS 13+ riconosciuto anche mascherato da MacIntel (maxTouchPoints > 1), testato.

### Manifest e meta (edit ancorati)

`public/manifest.webmanifest`: name/short_name → **"LifeOS"**, descrizione in italiano, `theme_color`/`background_color` → `#15171C` (ink Ember — il manifest non supporta media query: vale il tema di default, scuro); icone: aggiunte `/icon-512` (any) e `/icon-512?maskable=1` (glifo ridotto in safe-zone) generate da `app/icon-512/route.tsx` con lo stesso pattern ImageResponse di `app/icon.tsx` — stessa lingua visiva delle 192/180 esistenti; l'SVG `any maskable` esistente resta. *Flag*: `app/icon-512/` è fuori fence alla lettera ma esplicitamente richiesto dal build item 5 ("add 512 maskable via the existing icon-generation pattern"), come il pattern run-04.

`app/layout.tsx` — prima:
```ts
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
```
dopo:
```ts
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#15171C" },
    { media: "(prefers-color-scheme: light)", color: "#F4F3EF" },
  ],
```
(+ `title`/`appleWebApp.title` → "LifeOS", descrizione italiana; il meta iOS `apple-mobile-web-app-capable`/status-bar era già presente via `appleWebApp`).

### Per il gate di Davide (la sandbox non può farli)

Lighthouse PWA installable pass; iPhone: installazione (coaching sheet), cold start in aereo → Oggi coi dati locali; ciclo d'aggiornamento sul deploy successivo (toast "Aggiorna"); Android: prompt nativo da `beforeinstallprompt`.

**Commit:** `feat(pwa): hand-rolled service worker with offline fallback, update toast, install UX`

---

## Prompt 3 — Modulo Esami sui port (stub 15)

**Checkpoint: VERDE.** lint ✓ (una `no-unused-vars` corretta al volo) · tsc ✓ (di nuovo il rituale `rm -rf .next/dev` per i tipi generati stantii della rotta cancellata) · build ✓ (`ƒ /esami` nel gruppo (app)) · test **629/629** (+11: 5 `data/local/esami.test.ts`, 4 `importer.test.ts`, 2 round-trip `data/sync/engine-modules.test.ts`; il test di migrazione Dexie aggiornato v2→v3 a parità di casi). Dev server DA OSPITE: `/esami` 200 col modulo nuovo (form "Nuovo esame" nell'HTML), zero controlli nativi, prompt import assente (solo autenticati), sezione "Moduli" nel Rail.

### Adattamento alla realtà (delta dal brief, quotato)

Il brief chiedeva l'entità con "name, CFU, date, grade". La tabella legacy `exams` (0014) non ha MAI avuto CFU né voto:
```
$ grep -rni "cfu|grade|voto" supabase/migrations/ app/esami lib/esami
(nessun risultato)
```
Colonne reali: `title, exam_date, total_chapters, completed_chapters, notes`. L'entità nuova rispecchia la realtà (regola "actual code is the source of truth"): `Exam { title, date, total_chapters, completed_chapters, notes }` + audit, con invariante `completed ≤ total` (zod refine + clamp nel repo + check nella migrazione, cintura tripla come 0014).

### Data layer (pattern additivo, identico ai moduli run-03/04)

- `data/schemas.ts`: sezione Esami (ExamSchema + Create/Patch, capitoli 0..999).
- `data/ports.ts`: `EsamiRepo` (create/update/softDelete/restore/getById/listAll/purgeTombstones; l'update CLAMPA i completati sulla riga risultante: abbassare il totale non è mai un errore).
- `data/local/esami.ts` (+5 test: CRUD, invariante, tombstone/undo, input malformati).
- `data/db.ts`: **Dexie v3** additiva (`esami: "id, date, updated_at"`); test di migrazione aggiornati (verno 3, upgrade v1→corrente con la tabella nuova subito usabile).
- `data/sync/tables.ts`: voce `esami ↔ lo_esami` (parse ExamSchema, instantColumns audit) — da qui l'engine la muove come le altre, **provato** dal round-trip su FakeRemote (`engine-modules.test.ts`: push→pull identico tra due dispositivi; LWW sul progresso; tombstone che viaggia).
- `data/sync/signal.ts`: repo esami decorato dal segnale mutazioni.
- `data/hooks.ts`: `useEsami()` + `useExam(id)`.

### Migrazione SCRITTA, NON applicata

`supabase/migrations/0021_lo_esami.sql` — convenzioni 0019 al millimetro: colonne 1:1 con ExamSchema, doppio timestamp, PK `(user_id, id)`, indice di pull su `(user_id, server_updated_at)`, trigger `lo_touch_server_updated_at` riusato, RLS + grant espliciti/revoca anon, e **`lo_push` RIDECLARATA con l'allowlist estesa** a `lo_esami` (create or replace: applicata dopo 0019 la sostituisce — è così che la RPC "accetta" una tabella nuova). La tabella legacy `exams` resta intatta (sorgente read-only dell'importer).

### UI (`app/(app)/esami/`)

`page.tsx` (server: authed per l'import) + `esami-screen.tsx`: form "Nuovo esame" (Input nome, DatePicker con default oggi, capitoli numerici via Input `inputMode="numeric"` — zero controlli nativi), lista per data crescente con **countdown** ("45 giorni"/"oggi"/"3g fa"), **badge di pacing** (etichette riusate da `STATUS_BADGE_IT` della lib pura legacy `lib/esami/pacing` — read-only, MAI modificata — mappate sui toni Ember: done/vantaggio→salvia, in linea→ember, sotto pace/scaduto→segnale), barra capitoli con "target oggi: N/dì" e azione rapida "Capitolo fatto"; `exam-detail.tsx`: scheda BottomSheet/Modal con commit-on-blur, stepper ±1 sui completati (44px), eliminazione col toast Annulla (restore).

### Importer (pattern gym, quarta iterazione)

`import-actions.ts` (fetch RLS-scoped di `exams`, read-only) → `importer.ts` puro (id `deriveId("lifeos-import:exams:<id>")`; **`updated_at` legacy preservato** — LWW onesto sui reimport da più dispositivi; capitoli clampati, righe senza titolo/data malformata saltate e contate) → `import-run.ts` (solo id assenti + notifica sync). Superfici: card "Vecchi esami" in Impostazioni + prompt inline su /esami a lista vuota (authed).

### Case dei moduli (vale per i prompt 3-5, cablato qui)

Le 5 tab mobile restano com'erano. `app-nav.tsx`: il Rail desktop guadagna la sezione **"Moduli"** (lista `MODULES`, per ora Esami — icona nuova `IconExam` in icons.tsx); Impostazioni guadagna la card **"Moduli"** con le righe di navigazione (casa mobile).

### Supersessione (grep quotati)

```
$ grep -rn "app/esami|esami/actions" app lib components data ui | grep -v "^app/esami/" | grep -v "^app/(app)/esami"
(nessun risultato — exit 1)

$ grep -rln "lib/esami" app lib components data ui
app/(app)/esami/esami-screen.tsx      (modulo nuovo — riuso voluto)
app/(app)/esami/page.tsx              (commento)
app/esami/page.tsx                    (pagina legacy, cancellata)
```
→ rimossi `app/esami/page.tsx` + `app/esami/actions.ts` (con dentro la `updateExamProgress` morta dall'audit A6). `lib/esami/pacing.ts` + test RESTANO (riusati dal modulo nuovo). `proxy.ts`: `"/esami"` rimosso da PROTECTED_PREFIXES (una riga commentata, precedente run-04 /gym — l'acceptance chiede /esami 200 da ospite).

**Commit:** `feat(esami): exams module on ports with sync, pacing, legacy importer`

---

## Prompt 4 — Modulo Spese sui port (stub 15)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ (`ƒ /spese`) · test **645/645** (+16: 4 `data/local/spese.test.ts`, 7 `logic.test.ts`, 4 `importer.test.ts`, 1 round-trip lo_spese in `engine-modules.test.ts`; un rosso intermedio sul formato euro — il CLDR italiano raggruppa solo da 10.000, corretto con `useGrouping: "always"`, la STESSA lezione di formatKg al run-04). Dev server DA OSPITE: `/spese` 200 (form "Nuova spesa", chip categorie, link "Archivio movimenti (vecchia pagina)"), zero controlli nativi. **`git diff HEAD --stat -- app/finance` → vuoto** (l'archivio D4 è intatto, byte per byte).

### Scelte di dominio (documentate)

1. **Importo in euro decimali** (`EuroAmountSchema`: >0, ≤99.999.999,99, max 2 decimali): combacia col `numeric(10,2)` legacy come chiede il brief — import LOSSLESS per costruzione. I **totali** però si calcolano in **centesimi interi** (`logic.ts`, testato: 0,10+0,20 = 30 centesimi esatti, mai somme di float).
2. **Categoria = testo libero 1..40**: il closed enum di 0017 era una scelta della vecchia UI; i chip del quick-add propongono le stesse dieci (riusate READ-ONLY da `lib/finance/auto-classify.ts` — `CATEGORIES`) più "altra…" col campo libero, come da brief.
3. Niente parsing NL (esplicitamente non richiesto qui).

### Data layer

Stesso pattern additivo del prompt 3: sezione Spese in `schemas.ts`; `SpeseRepo` in ports (listMonth("YYYY-MM") con confronto lessicale sicuro sui giorni zero-padded); `data/local/spese.ts` (+test: CRUD, dominio importi, mese/tombstone/undo, mese malformato → lista vuota); **Dexie v4** additiva (`spese: "id, date, updated_at"`, test verno 4); registro `spese ↔ lo_spese`; segnale mutazioni; hook `useSpeseMonth`/`useExpense`. Round-trip FakeRemote: importo decimale identico su B, LWW sulla correzione, tombstone.

### Migrazione SCRITTA, NON applicata

`supabase/migrations/0022_lo_spese.sql` — `lo_spese` con `amount numeric(10,2)` (check >0 e tetto legacy), `category text` con check lunghezza 1..40 (il dominio nuovo, NON l'enum chiuso), convenzioni 0019 complete, e `lo_push` ridichiarata con allowlist `… + lo_esami + lo_spese`. `personal_expenses` e `finance_entries` INTATTE.

### UI (`app/(app)/spese/`)

Vista mese con frecce ‹ › (`shiftMonth` puro, testato a cavallo d'anno), due StatCard (totale mese formattato `1.250,50 €`, numero movimenti), **barre per categoria fatte a mano** (div + width%, ordinate per spesa decrescente, quota %); quick-add (importo `inputMode="decimal"` con `parseEuroAmount` che accetta virgola E punto — testato, DatePicker default oggi, nota); lista del mese (giorno decrescente) con scheda `expense-detail.tsx` (commit-on-blur, elimina + toast Annulla); link quieto all'archivio `/finance`. L'aggiunta con data in un altro mese SPOSTA la vista su quel mese (la spesa non "sparisce").

### Importer

Pattern consolidato: fetch RLS-scoped di `personal_expenses` → mappatura pura (id `deriveId("lifeos-import:personal_expenses:<id>")`, importo normalizzato al centesimo, **numeric accettato anche come STRINGA** — PostgREST può renderlo così, testato; categoria minuscola/trim; `updated_at` legacy preservato) → inserimento solo-assenti + notifica sync. Card "Vecchie spese" in Impostazioni + prompt inline su /spese a mese vuoto (authed).

### Case dei moduli

`IconWallet` nuova; Rail "Moduli" → Esami, Spese; card "Moduli" di Impostazioni idem. Nessun edit a proxy.ts (nessuna rotta legacy /spese esisteva; /finance resta protetta com'era).

**Commit:** `feat(spese): expenses module on ports with sync and legacy importer`

---

## Prompt 5 — Modulo Sera sui port (stub 15)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ (rituale `.next` stantio) · build ✓ (`ƒ /sera` nel gruppo (app)) · test **656/656** (+11: 6 `data/local/sera.test.ts`, 4 `importer.test.ts`, 1 convergenza lo_sera in `engine-modules.test.ts`; migrazione Dexie → verno 5). Dev server DA OSPITE: `/sera` 200 — titolo modulo, sezione "Sere passate" e i due Skeleton nell'HTML (il check-in è dietro la liveQuery Dexie, come da pattern della shell: compare all'idratazione — la logica è provata dai test del repo); **zero** menzioni di Drive da ospite (il blocco non esiste proprio); zero controlli nativi. **`git diff HEAD --stat -- lib/google lib/validation/form-inputs.ts` → vuoto** (lib Drive e schemi riusati, MAI toccati).

### Il disegno: una riga per giorno, per costruzione

L'insight architetturale del prompt: il check-in serale è un'entità per-GIORNO, ma un vincolo `unique(user_id, date)` server-side farebbe fallire i push quando due dispositivi creano lo stesso giorno offline. Soluzione: **l'id è derivato dalla data** (`deriveUuidV8("lifeos:sera-day:<date>")`, SHA-256→UUIDv8, nuova in `data/ids.ts`) — stessa data, stessa PK ovunque → il sync FONDE con LWW invece di duplicare. Provato dal test di convergenza (due dispositivi scrivono lo stesso giorno prima di sincronizzare → UNA riga remota, entrambi convergono sulla versione più recente). La stessa derivazione rende l'importer incapace di toccare un giorno già scritto a mano (stesso id → insert-only-missing salta). *Nota per il cleanup (16)*: l'algoritmo è lo stesso della `deriveId` di `app/(app)/gym/importer.ts` (fuori fence qui) — unificazione rimandata, documentata nel codice.

### Entità e realtà legacy

`evening_checkins` (0013): date, `energy_1_5` 1..5, mood, notes — **niente diario**: i testi andavano SOLO su Drive. L'entità nuova: quei campi PIÙ `journal` (cap 100.000 come il salvataggio Drive) — nel mondo nuovo il diario è LOCALE (guest-first, sincronizza via `lo_sera`) e **Drive diventa un export esplicito** che riusa `lib/google/drive-journal` READ-ONLY (stessa cartella Life-OS/Diario/, stessi slug d'errore). `SeraRepo`: `upsertDay(date, patch)` (unico percorso di scrittura: salvataggio continuo; revive una tombstone — scrivere il giorno È l'intento), `getByDay`, `listRecent(before, limit)` paginato, `purgeTombstones`.

### Migrazione SCRITTA, NON applicata

`supabase/migrations/0023_lo_sera.sql` — `lo_sera` (date, energy_1_5 con check 1..5, mood, notes, journal), convenzioni 0019, **senza** unique(user_id,date) (garanzia lato client per costruzione — commentato nel file), `lo_push` con l'allowlist completa del run (`… lo_esami, lo_spese, lo_sera`). `evening_checkins` INTATTA.

### UI (`app/(app)/sera/`)

Check-in di OGGI come superficie primaria: **energia** con radiogroup orizzontale 1..5 fatto a mano (target 44px, `role="radio"`, frecce ←/→ — il RadioGroup Ember è verticale, 5 righe erano troppe), umore e note (commit on blur), **diario** Textarea col salvataggio continuo LOCALE (debounce 800ms + blur, riga di stato "Salvato" quieta, `aria-live`); la riga live segue sync/import solo quando non ci sono modifiche in volo (l'utente vince). **Blocco Drive per stato reale**: ospite → non esiste; nessun account → invito a collegare Google dal Calendario; scope mancante → "Autorizza Drive" (stesso flusso `?upgrade=drive` della legacy); pronto → "Esporta su Drive" con toast di esito. **Storico paginato onesto**: 7 sere alla volta, "Mostra altre sere" (+7) — si carica ESATTAMENTE ciò che si rende (il fetch-30-render-2 dell'audit muore qui); riga → sheet read-only (confine V1 come la legacy). NESSUNA sezione "Domani", niente placeholder.

### Azione Drive ricollocata (grep-gated)

```
$ grep -rn "app/sera|sera/actions|sera/_components" app lib components data ui | grep -v "^app/sera/" | grep -v "^app/(app)/sera"
lib/validation/form-inputs.ts:88:/** Mirror of MAX_DIary_CHARS in app/sera/actions.ts. */   ← solo un COMMENTO, nessun import
```
`saveDiaryEntry` ricollocata in `app/(app)/sera/actions.ts` (corpo identico: `parseFormData(SaveDiaryEntrySchema)`, slug stabili, `saveJournalEntry` della lib); rimossi `app/sera/page.tsx`, `actions.ts` (con `submitEveningCheckin` e `toggleCarryover`, entrambe superate: la prima dal port, la seconda apparteneva al motore daily_tasks morto), `_components/journal-editor.tsx`. Residui dichiarati fuori fence, ora senza consumatori: `parseDiaryDraft`/`DiaryDraftSchema` in `lib/validation/local-storage.ts` (+ i loro test, che restano verdi) e `EveningCheckinSchema`/`ToggleCarryoverSchema` in `form-inputs.ts` — candidati al cleanup (16). Limite pre-esistente NON toccato: `drive-journal` risolve l'account con `.maybeSingle()` interno (con due account Google l'export fallirebbe — comportamento identico alla legacy, lib read-only; da sistemare quando la lib entrerà in una fence).

### Importer

Fetch RLS-scoped di `evening_checkins` → mappatura pura (id = **id del giorno**, energia fuori dominio → null, duplicati di giorno scartati e contati, diario null — i testi legacy restano su Drive, leggibili lì) → insert-only-missing. Card "Vecchie sere" in Impostazioni + prompt inline su /sera a modulo vuoto (authed).

### Case e proxy

`IconMoon`; Rail e card "Moduli" → Esami, Spese, Sera. `proxy.ts`: `"/sera"` rimosso da PROTECTED_PREFIXES (riga commentata insieme a /esami).

**Commit:** `feat(sera): evening journal on ports with sync, Drive export kept, legacy importer`

---
