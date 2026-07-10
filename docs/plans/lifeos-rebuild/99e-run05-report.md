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
