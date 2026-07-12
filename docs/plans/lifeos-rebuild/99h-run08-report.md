# Run 08 — Habits Engine + Weekly Planner + Pomodoro/Focus + Cross-Wiring

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-08` (off `main` @ `1a45642`). Mai pushato, mai mergiato.
**Brief:** run-08 — tre pilastri: motore Abitudini, Planner settimanale, Pomodoro/Focus, cablati a Oggi e alla streak.

Questo report è fence-exempt e viene appeso a ogni checkpoint.

---

## Pre-flight gate

**1. Clean tree + run-07 in HEAD.**
- `git status` su `main` → pulito. ✓
- `git ls-files` conferma i sentinel run-07: `data/derived.ts` ✓, `supabase/migrations/0025_lo_body_profile.sql` ✓, `app/(app)/corpo/` (4 file) ✓.
- Non STOP: run-07 è in HEAD (`1a45642e175553963537bfc296549b69ab61ce14`, merge di `feat/run-07`).

**2. Branch + HEAD registrati.**
- HEAD di partenza: `1a45642e175553963537bfc296549b69ab61ce14`.
- Creato `feat/run-08` e switchato.

**3. Baseline verde (dalla radice).**
- `npm run lint` → pulito ✓ · `npm run typecheck` → pulito ✓ · `npm run lint:sentinels` → pulito ✓
- `npm test` → **Test Files 60 passed (60) · Tests 730 passed (730)** ✓ — combacia col finale run-07.
- `npm run build` → ✓ (baseline per il delta di dimensione di Oggi, prompt 5).

**4. Migrazioni.**
- Esistenti: 0001 → 0025 (col doppio 0016 noto). Prossimo numero libero: **0026** (habits), poi 0027 (planner), 0028 (focus). ✓

**5. Misura baseline di Oggi (per il prompt 5).**
- Next 16.2.6 (webpack) NON stampa più le colonne "First Load JS" per route: la misura onesta scelta è la dimensione del chunk client della route (`.next/static/chunks/app/(app)/page-*.js`).
- Baseline: `page-aa20ec2d79f71a68.js` = **27.759 byte (~27,1 kB)**; chunk del layout `(app)` = 27.131 byte.

**6. Letture pre-prompt (fatte per intero prima di scrivere).**
- `99g-run07-report.md` per intero.
- Codice reale: `data/schemas.ts`, `data/ports.ts`, `data/db.ts`, `data/hooks.ts`, `data/derived.ts`, `data/streak.ts`, `data/ids.ts` (+test golden), `data/gym-seed.ts`, `data/gym-programs.ts` (pattern seed a UUID fissi), `data/local/{index,util,body,settings,stats}.ts`, `data/sync/{tables,signal,export}.ts`, `data/sync/engine-modules.test.ts`, `data/db.migration.test.ts`, migrazioni 0024/0025 (convenzioni + pattern `lo_push`).

Pre-flight PASS.

---

## Prompt 1 — Dominio Abitudini

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · sentinels ✓ · test **772/772, 62 file** (baseline 730/60: **+42** — 20 `data/local/habits.test.ts` nuovo, 8 `data/habits.test.ts` nuovo, +4 `data/streak.test.ts` (variante per-serie), +3 `data/sync/engine-modules.test.ts` (round-trip), +3 `data/schemas.test.ts`, +2 `data/local/stats.test.ts` (streak globale), +1 `data/db.migration.test.ts` (survival v7→v8), +1 golden in `data/ids.test.ts`).

### Modello (`data/schemas.ts`)

- **`Habit`**: id UUIDv7, name, `icon` (chiave dal set curato, schema tollerante a chiavi future), `kind` `boolean | counter | quantity`, `unit` (solo quantity: "ml", "pagine"), `daily_target` (positivo ≤100k; null = senza obiettivo fisso — per l'acqua significa "segue il profilo"), `weekdays` (array ISO 1-7, min 1; null = tutti i giorni), `sort_order`, `archived_at` (archiviata ≠ eliminata: sparisce dalla board, la storia resta), audit. **`kind` è fuori dagli editable**: cambiare specie cambierebbe il significato della storia (0/1 vs quantità) — documentato nello schema.
- **`HabitLog`**: id **DERIVATO** `deriveUuidV8("lifeos:habit-log:<habit_id>:<date>")` — una riga per (abitudine, giorno) PER COSTRUZIONE, i device convergono sulla stessa PK. `value` 0..1M (boolean come 0/1). **Golden test del prefisso** in `data/ids.test.ts` (`…:2026-07-12` → `481cb061-…` pinnato byte-per-byte).

### Streak per-serie (`data/streak.ts`)

`computeSeriesStreak({ doneDays, isBridge, today })`: la stessa aritmetica della streak globale ma il PONTE è un predicato — copre insieme i giorni protetti E i giorni non previsti dallo schedule, senza che il motore conosca l'una o l'altra semantica. **`computeStreak` è ora un wrapper** della variante (`isBridge = protectedDays.has`): l'equivalenza è provata dai test storici, mai riscritti, più un test esplicito di equivalenza.

### Repo (`data/local/habits.ts`) + dominio puro (`data/habits.ts`)

- CRUD con normalizzazioni: boolean → unit/daily_target sempre null; counter → unit null; `weekdays` dedupe+sort, tutti e 7 = null. `archive`/`unarchive` idempotenti; `reorder` = indice; **cascade su softDelete** (log tombstonati con lo STESSO deleted_at, pattern gym) e `restore` che revive SOLO quel cascade (testato con una tombstone pre-esistente che resta morta).
- **Log**: `logDay` (valore assoluto) e `incrementDay` (delta anche negativo, clamp 0..1M) sullo stesso upsert per-giorno; una tombstone del giorno viene rianimata (loggare È l'intento). Loggare su abitudine eliminata = not_found.
- **`dayBoard(date)`**: abitudini vive, non archiviate e PREVISTE quel giorno (weekday ISO da stringa civile a mezzogiorno UTC, DST-immune), col log, l'**obiettivo effettivo** e `done` già calcolato — la UI non rifà la matematica.
- **`habitStreak(habitId, { today })`**: doneDays = giorni con `value >= obiettivo effettivo`; ponte = giorni protetti (Impostazioni) ∪ giorni non previsti. Testato: schedule feriale che scavalca il weekend, giorni protetti, buco vero che spezza, **DST marzo e ottobre 2026**, obiettivo derivato dell'acqua (2800 da 80 kg).
- **Acqua seminata** (`WATER_SEED`, `seedWaterHabit`): UUID FISSO `01970000-90ac-…0001` (prefisso riservato nuovo, distinto da `…90aa…` catalogo e `…90ab…` Torso A), timestamp `SEED_INSTANT`, insert-only-missing che non risuscita e non sovrascrive (testato con rinomina e tombstone). `daily_target: null` = **segue il profilo**: `effectiveTarget` risolve `waterTargetMl(peso più recente)` (run-07 `data/derived.ts`, riusato mai riscritto), override manuale = un valore in `daily_target`, e senza pesate il **default di prodotto** `WATER_DEFAULT_ML = 2000` (dichiarato: non è una stima di formula, la UI lo dirà).
- `HABIT_ICON_KEYS` (12 chiavi curate) + `STARTER_HABITS` (Lettura 10 pagine, Camminata, Stretching) pronti per il prompt 2 — gli starter validano contro `HabitCreateSchema` in test.

### Streak globale (`data/local/stats.ts`)

`allActivityDays` guadagna la terza fonte: giorno attivo anche quando un'abitudine è COMPLETATA (obiettivo effettivo, stesso predicato della board). Le archiviate contano (i completamenti erano veri), le eliminate no (cascade di tombstone). Testato con quantity a obiettivo (fatta/a metà) e counter senza obiettivo; abitudine eliminata sparisce dai giorni attivi.

### Dexie v8, sync, migrazione

- **Dexie v8** additiva: `habits` (id, updated_at) e `habit_logs` (id, habit_id, date, updated_at). **Survival test v7→v8**: pesata scritta a v7 sopravvive byte-per-byte, tabelle nuove subito usabili (indici compresi); aggiornati i verno-assert esistenti (7→8) e l'elenco tabelle.
- **Sync**: 2 voci nuove nel registro (`lo_habits` con `archived_at` tra le colonne istante, `lo_habit_logs`); l'envelope export/import si estende da solo (derivato da SYNC_TABLES, chiave assente = `.default([])` del run-07). Round-trip su FakeRemote: abitudine+log identici su B, LWW sul valore, **convergenza del log del giorno su id derivato** (una sola riga remota; i valori NON si sommano tra device: contratto row-mirror LWW, documentato), cascade di tombstone che viaggia, archived_at che viaggia.
- **Migrazione `0026_lo_habits.sql` SCRITTA, NON applicata**: `lo_habits` (check su kind/unit/daily_target, weekdays jsonb come tags/protected_days) + `lo_habit_logs` (check 0..1M), blocco per-tabella 0019, **`lo_push` ridichiarata con l'allowlist a 17** (le 15 di 0025 + le 2 nuove). Nessun unique(user_id, habit_id, date) server-side: garanzia client per costruzione, come lo_sera/lo_body (commentato nel file).
- Hook nuovi: `useHabits`, `useHabit`, `useHabitBoard`, `useHabitLogsRange`, `useHabitStreak`. `withMutationSignal` decora il repo nuovo; `createLocalRepos` lo cabla.

### Scelte documentate (delta/interpretazioni)

1. **Completamento valutato contro l'obiettivo effettivo CORRENTE** (non quello storico del giorno): il log del brief non fotografa l'obiettivo (id, value, timestamps) — valutare contro l'obiettivo corrente è deterministico e identico su ogni device; se il target dell'acqua sale col peso, i giorni passati si rivalutano. Alternativa scartata: snapshot del target nel log (campo fuori brief).
2. **Counter/quantity senza obiettivo: done = valore > 0**; boolean: obiettivo sempre 1.
3. **`weekdays` con tutti e 7 i giorni normalizzato a null** ("tutti i giorni" ha una sola rappresentazione).
4. **Il valore dei log NON si somma tra dispositivi** (LWW row-mirror): due device offline che incrementano lo stesso giorno convergono sulla scrittura più recente — limite inerente al disegno sync esistente, testato e documentato.

### Acceptance del prompt

- Quattro check verdi ✓ (più sentinels). Migrazione presente, NON applicata ✓. Golden test del prefisso log-id ✓. Streak per-abitudine con giorni protetti e DST ✓. Acqua seminata che segue `waterTargetMl` con override manuale ✓. `activityDays` esteso e testato ✓. Dexie bump con survival ✓. Round-trip FakeRemote ✓.

**Commit:** `feat(habits): habits domain with date-keyed logs, per-habit streaks, seeded water` → `abfa788`

---

## Prompt 2 — UI Abitudini (la board quotidiana)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ (`ƒ /abitudini`) · sentinels ✓ · test **783/783, 63 file** (+11: `app/(app)/abitudini/logic.test.ts` nuovo — anello, chips, formattazione it-IT, parse input, water-first, futuro sola-lettura). **Dev-server DA OSPITE:** `/abitudini` **200** ("Gestione" e "Giorno precedente" nell'HTML servito) e `/` **200** con `aria-label="Abitudini"` (la strip) — **zero controlli nativi** su entrambe (`<select`, checkbox/date/time/number: 0 occorrenze).

### Struttura (`app/(app)/abitudini/**` nuovo)

- **`logic.ts`** (+test): `ringProgress` (0..1 clampata; senza obiettivo pieno solo con valore), `quickSteps` (acqua = gesti reali 200/330/500 ml; con obiettivo = passi "parlanti" derivati ≈1/10-1/4-1/2 arrotondati a 1/2/5×10ⁿ, dedupe; senza = 1/5/10), `defaultQuickStep` (il chip di mezzo: 330 ml one-thumb), `formatHabitValue` (**`useGrouping: "always"`** — la landmine it-IT sotto 10.000: "2.800"), `formatValueLine`, `parseValueInput` (virgola o punto, mai negativo, garbage → null), `waterFirst`, `canEditDay` (futuro = sola lettura).
- **`habit-card.tsx`** — la card della board: **anello Ember 52px** (ProgressRing riusata, transizione sull'arco; il centro cambia con `em-pop-in` via key-swap SENZA mai smontare l'anello — smontarlo ucciderebbe la transizione CSS; reduced-motion = collasso globale Ember già in ember.css); **boolean** = tap sull'INTERA card (bottone assoluto sotto i controlli, aria-label onesta), spunta grande al centro; **counter** = tap card +1, "−" esplicito 44px; **quantity** = chips d'incremento + **"totale…"** che apre l'input inline (Invio conferma, Esc annulla, parse testato — niente input number nativo, `inputMode="decimal"`); fiamma della streak per-abitudine (IconFlame + conteggio, ember quando oggi conta).
- **`habit-sheet.tsx`** — la scheda (BottomSheet mobile / Modal desktop): riga streak "corrente · migliore", **mini-heat del mese** (RIUSO di `MonthHeat` di /stats: giorni completati pieni, protetti bordati), nome commit-on-blur, **icon picker** (griglia 12 chiavi curate, aria-pressed), **obiettivo**: per l'acqua "Segue il profilo: ~2.800 ml" con **Imposta manuale / Torna al profilo** (daily_target null = derivato — il contratto del P1), per le altre input col parse; unità editabile (quantity); **giorni previsti** a chips L-D + "Tutti" (insieme vuoto torna a "tutti i giorni"; copy onesta: "Nei giorni non previsti la streak non si spezza: fa ponte"); **Archivia** (undo = unarchive, copy "la storia resta") ed **Elimina** (undo = restore del cascade P1). `CreateHabitSheet`: nome autofocus, tipo a card (Sì/No · Contatore · Quantità — kind si sceglie SOLO alla creazione, contratto P1), obiettivo/unità condizionali, icona, giorni.
- **`abitudini-screen.tsx`** — navigazione giorno (‹ › + "Torna a oggi"; futuro navigabile ma "sola lettura" dichiarata e controlli spenti), board, **starter card** "Inizia da qui" finché l'unica abitudine viva è l'Acqua seminata (le 3 proposte one-tap del P1: Lettura/Camminata/Stretching), **Gestione**: riordino drag dalla maniglia (RIUSO di `useRowDrag`+`moveIndex` del gym, transform-only) + apertura scheda, archiviate con chip. `seedWaterHabit` al mount (idempotente, non risuscita).
- **`page.tsx`** — shell server col pattern corpo (`metadata`, header Modulo).

### Cablaggio (anchored)

- **`app/(app)/page.tsx`** — la strip tra tile e task, prima di WhileAwayCard:
```
       <TodayTiles />
+
+      {/* Strip abitudini (run-08 prompt 2): anelli, un tocco per loggare. */}
+      <TodayHabits />

       {/* Promemoria scattati mentre eri via (run-03 prompt 5). */}
       <WhileAwayCard />
```
  (+ import `TodayHabits`). **`today-habits.tsx`** (_components): fila orizzontale di anelli 48px, **acqua per prima** (`waterFirst`), tap = log rapido (boolean toggle, counter +1, quantity + chip di mezzo — per l'acqua 330 ml), nome sotto, header-link a /abitudini; semina al mount anche qui (Oggi può essere la prima superficie vista).
- **`icons.tsx`** — `IconRepeat` (modulo), `IconFlame` (streak) + le 10 icone nuove del set curato e la mappa **`HABIT_ICONS`/`HabitIcon`** (chiave ignota degrada alla spunta, mai un buco); goccia/libro/passi/stretching/sole/cuore/taccuino/musica/respiro disegnate a tratto 1.8 come le esistenti, `luna` e `spunta` riusano IconMoon/IconCheck.
- **`app-nav.tsx`** — Rail "Moduli": Abitudini PRIMA voce (è il modulo quotidiano), poi Esami/Spese/Sera/Corpo. **`impostazioni/page.tsx`** — MODULE_LINKS idem con desc "Board del giorno, anelli e streak".

### Acceptance del prompt

- Quattro check verdi ✓; `/abitudini` 200 da ospite e strip su Oggi nel primo HTML ✓; zero controlli nativi ✓; matematica anello + logica board sotto test ✓ (P1 copre board/streak, qui i +11 della UI logic).

**Commit:** `feat(habits): daily board with animated rings, quick logging, Today strip` → `bf06453`

---

## Prompt 3 — Dominio Planner settimanale

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · sentinels ✓ · test **809/809, 65 file** (+26: 11 `data/planner.test.ts` nuovo, 10 `data/local/planner.test.ts` nuovo, +2 round-trip in engine-modules, +3 `data/schemas.test.ts`, +1 golden slot-check in ids.test — dentro il test golden esistente — e survival esteso in db.migration). **Fence rispettata:** solo `data/**` + `supabase/migrations/0027_lo_planner.sql` + test; zero diff su app/ui/lib/public.

### Modello (la spec di Davide, `data/schemas.ts`)

- **`WeekPlan`**: id, name ("Settimana lavoro"), `is_active` (al più uno — invariante del REPO, come i programmi gym), audit.
- **`PlanSlot`**: id, plan_id, `weekday` 1-7, `start_hhmm` (HhmmSchema riusato), `end_hhmm` opzionale, title ≤200, notes ≤500, `sort_order` (spareggio dentro la stessa ora — l'ordine vero lo dà l'orario). **plan_id fuori dal patch** (gli slot non migrano tra piani); weekday resta editabile (spostare di giorno è un gesto vero).
- **`SlotCheck`**: id **DERIVATO** `deriveUuidV8("lifeos:slot-check:<slot_id>:<iso_week>")` — una riga per (slot, settimana) PER COSTRUZIONE, convergenza cross-device; `state` `done | skipped | null` (**null = de-spuntato: la riga resta e l'annullamento viaggia col sync**), `checked_at`. Golden del prefisso pinnato in ids.test.
- **`IsoWeekSchema`**: regex chiusa `YYYY-Wnn` 01..53.

### Settimane ISO (`data/planner.ts`, puro)

`isoWeekOf` (regola ISO: la settimana appartiene all'anno del suo GIOVEDÌ), `isoWeekDays` (lun→dom), `shiftIsoWeek`, `currentIsoWeek(instant, timeZone)` via `civilDayInZone` esistente (Europe/Rome iniettata dal chiamante — "existing civil helpers" del brief). Aritmetica a mezzogiorno UTC su stringhe civili: DST-immune per costruzione. **Testato sui confini**: il 2026 inizia di giovedì → W01 parte dal 29/12/2025 e il 2026 ha 53 settimane → l'1/1/2027 (venerdì) è `2026-W53`; 28/12/2025→2025-W52; 30/12/2024→2025-W01; shift che attraversa gli anni (W53→W01); giorni dei due cambi d'ora 2026; `currentIsoWeek` che cambia settimana alle 22:30Z di domenica per Roma ma non per UTC.

### Board e statistiche (pure + repo)

- **`computeWeekBoard(slots, checks, isoWeek)`**: 7 giorni lun→dom con la DATA di quella settimana, slot per orario → sort_order → created_at, stato del check fuso. Testato (ordine, parità d'ora, giorni vuoti).
- **`computeWeekStats(slots, checks, currentWeek, lastN)`**: per-settimana `{total, done, skipped}` dove **total conta solo gli slot già esistenti in quella settimana** (created_at ≤ domenica — uno slot creato ieri non "manca" nelle settimane in cui non c'era, testato) e nelle settimane CHIUSE il mai-toccato conta come saltato (nella corrente contano solo i salti espliciti: la settimana non è finita); **classifica "salti più spesso"** = salti espliciti + silenziosi sulle settimane chiuse, ordinata per missed poi titolo — il "task che dimentichi di più" di Davide, con `{missed, done, weeks}` per la copy onesta del P4. Test del ranking con fixture a 3 slot.
- **`LocalPlannerRepo`** (`data/local/planner.ts`): piani CRUD + **un-solo-attivo** transazionale + `activePlan` tolerant (updated_at) + **duplicatePlan** (copia profonda degli slot, " (copia)", mai attiva, **la storia dei check resta all'originale** — testato); slot CRUD + `reorderSlots` (indice, id d'altri piani saltati) + **`copySlotToWeekdays`** (authoring veloce del P4; mai nel proprio giorno, dedupe, testato); **cascade** piano→slot→check e slot→check con lo stesso deleted_at + restore che revive solo il cascade (testato); `setCheck` upsert su id derivato (validazione IsoWeek + stato, slot vivo richiesto, tombstone rianimata, `checked_at` null quando si de-spunta), `weekBoard`/`weekStats` = query + funzioni pure.
- **La storia è append-only per costruzione**: settimane diverse = PK diverse, nessuna scrittura tocca mai le righe delle settimane passate (testato: W28 e W29 = 2 righe).

### Streak globale: NO (scelta documentata)

`activityDays` NON è esteso ai check del planner: "07:00 Palestra" spuntato è già contato dalla sessione gym, "09:00 Deep work" dai task — contarli anche qui double-conterebbe l'amministrazione della vita. Documentato nel docstring di `data/planner.ts` e qui.

### Dexie v9, sync, migrazione

- **Dexie v9** additiva: `week_plans`, `plan_slots` (indice plan_id), `slot_checks` (indici slot_id e **iso_week** per la board). Survival test esteso: v7→(v9) con pesata intatta + tabelle habits E planner subito usabili (indice iso_week verificato); verno-assert aggiornati a 9.
- **Sync**: 3 voci nuove (`lo_week_plans`, `lo_plan_slots`, `lo_slot_checks` con `checked_at` tra le colonne istante). Round-trip FakeRemote: piano+slot identici su B; **convergenza del check della settimana** (due device spuntano offline → UNA riga remota, vince la scrittura più recente); **de-spuntare viaggia** (state null sulla stessa riga, mai una riga fantasma); cascade di tombstone fino ai check.
- **Migrazione `0027_lo_planner.sql` SCRITTA, NON applicata**: 3 tabelle coi check di dominio (weekday 1-7, HH:MM regex, iso_week regex, state chiuso), blocco per-tabella 0019, **`lo_push` ridichiarata con l'allowlist a 20** (17 di 0026 + 3). Nessun unique server-side su (slot, settimana): garanzia client, come lo_sera/lo_body/lo_habit_logs (commentato nel file).
- Hook nuovi: `useWeekPlans`, `useActiveWeekPlan`, `usePlanSlots`, `useWeekBoard`, `useWeekStats`. `withMutationSignal` + factory cablati.

### Acceptance del prompt

- Quattro check verdi ✓. Test iso-week (confini d'anno, DST) ✓. Test del ranking più-saltati ✓. Migrazione presente NON applicata ✓. Golden del prefisso slot-check ✓. Dexie bump con survival ✓. Round-trip + convergenza ✓. activityDays non toccato, documentato ✓.

**Commit:** `feat(planner): week plan templates with per-week slot checks and skip stats` → `27dd153`

---

## Prompt 4 — UI Planner settimanale

**Checkpoint: VERDE.** lint ✓ (una direttiva eslint-disable inutilizzata, rimossa) · tsc ✓ · build ✓ (`ƒ /settimana`) · sentinels ✓ · test **823/823, 66 file** (+14: `app/(app)/settimana/logic.test.ts` nuovo — slot "adesso", conteggi, etichette, macchina degli stati del check). **Dev-server DA OSPITE:** `/settimana` **200** con le tre tab "Settimana/Piani/Storico" nell'HTML servito; `/` **200**; **zero controlli nativi** su entrambe; copy "Adesso"/"Piano di oggi" presente nel chunk servito della route `/` (la card monta coi dati IndexedDB del client — la verifica a livello chunk è l'interpretazione run-07 del dev-check, dichiarata sotto).

### Struttura (`app/(app)/settimana/**` nuovo)

- **`logic.ts`** (+14 test): `findNowSlot` (in corso = inizio ≤ ora < fine effettiva, dove la fine effettiva è end_hhmm, altrimenti il prossimo slot, altrimenti UN'ORA di cortesia — testato il buco tra slot e il dopo-cena), `adessoEntry` (in corso vince sul prossimo; null a giornata finita), `remainingCount` (slot senza esito), `completionPct` (null senza slot, mai 0% finto), `weekRangeLabel` ("6–12 lug", "28 set – 4 ott" a cavallo di mese, valori Intl verificati), `hhmmInZone` (fuso rotto degrada a UTC), e la **macchina degli stati**: tap null→fatto→null e saltato→fatto; gesto lungo sempre saltato, ri-lungo annulla.
- **`week-board.tsx`** — LA BOARD: lun→dom come card; **mobile = snap-scroll orizzontale con oggi centrato al mount** (scrollIntoView inline center), **desktop (md+) = griglia a 7 colonne**; header giorno con nome+numero, ember dot su oggi; righe slot "07:00 Palestra" con **check a un tocco** (cerchio → pieno ember con spunta) e **gesto lungo 450ms = saltato** (pointer events, funziona anche col mouse; da tastiera Invio/Spazio = fatto, "s" = saltato — aria-label che spiega il gesto); fatto = **strike quieto** (line-through text-3), saltato = chip "saltato" + cerchio tratteggiato; **slot in corso con l'ember dot** (findNowSlot, solo sulla card di oggi); settimane future = `editable false`: check spenti al 35%, mai finti.
- **`plan-manager.tsx`** — PIANI: lista (nome, chip "attivo", Attiva, apertura drill-down — pattern gym), "+ Nuovo piano" (nasce attivo e apre l'editor); editor: **rinomina inline** commit-on-blur, **Attiva**, **Duplica** (toast), **Elimina con undo** (restore del cascade P3, copy onesta "con slot e storia"); **authoring veloce**: giorni a chips L-D col conteggio, righe slot per orario, **scheda slot** (BottomSheet/Modal) con **TimePicker** inizio/fine (kit, zero native), titolo autofocus + Invio salva, note, **"Copia anche in"** a chips (copySlotToWeekdays del P3 al salvataggio) ed elimina con undo; **"Copia giorno su…"** (chips del bersaglio, copia tutti gli slot del giorno).
- **`settimana-screen.tsx`** — Tabs Settimana/Piani/Storico; switcher ‹ › con "Questa settimana"/range + id ISO, futuro = riga "Anteprima del piano: si spunta quando arriva", passato = ancora spuntabile ("read-only-editable" del brief: i check retroattivi restano possibili) con "Torna a questa settimana"; senza piano attivo EmptyState con CTA che salta alla tab Piani. **STORICO**: barre delle ultime 8 settimane (percentuale sopra, barra ember, etichetta Wnn, corrente evidenziata; "—" onesto per settimane senza slot) + **"Salti più spesso"** dal weekStats P3 (top 6: orario, titolo, "N su M" settimane; il primo porta la copy senza colpa **"ti scappa spesso"**). La settimana corrente deriva da `isoWeekOf(useToday())` — niente `new Date()` nel render (la lezione lint del run-07, annotata nel codice).
- **`page.tsx`** — shell server pattern corpo.

### Cablaggio (anchored)

- **`app/(app)/page.tsx`** — la card dopo la strip abitudini:
```
       {/* Strip abitudini (run-08 prompt 2): anelli, un tocco per loggare. */}
       <TodayHabits />
+
+      {/* "Adesso" (run-08 prompt 4): lo slot corrente del piano attivo. */}
+      <TodayAdesso />

       {/* Promemoria scattati mentre eri via (run-03 prompt 5). */}
       <WhileAwayCard />
```
  (+ import). **`today-adesso.tsx`** (_components): lo slot IN CORSO del piano attivo — o "Tra poco: {prossimo}" — con lo **stesso SlotRow della board** (check inline, tap/gesto lungo), riga "E altri N slot oggi", "Piano di oggi completo." a giornata finita; **quieta per costruzione**: senza piano attivo o senza slot oggi rende null. Esporta `useTodayPlanSlots` (una query sola, mai due verità).
- **`today-tiles.tsx`** — tile **"Piano di oggi"** (conteggio slot senza esito, unit "slot", hint "Tutto spuntato."/"Ancora senza esito.") SOLO quando il piano attivo prevede qualcosa oggi — pattern del tile Peso.
- **`icons.tsx`** `IconWeek` (calendario con spunta); Rail Moduli e card Moduli di Impostazioni: "Settimana" dopo Abitudini ("La settimana tipo, spuntata slot per slot").

### Scelte documentate

1. **"Today 'Adesso' renders with a seeded plan in dev-check"**: il dominio planner NON ha un piano seminato (il P3 non lo prevede — a differenza dell'acqua, una "settimana tipo" non ha un default onesto). Il dev-check verifica quindi la card nel grafo chunk servito di `/` (copy presente) — con un piano creato la card monta per costruzione (stessa SlotRow della board, testata via findNowSlot/adessoEntry).
2. **Gesto lungo = 450ms** su pointer events (mobile E desktop), con fallback da tastiera ("s") e aria-label che dichiara il gesto.
3. **Slot senza fine**: dura fino al prossimo slot ma al massimo un'ora — "in corso" onesto senza chiedere la end_hhmm a chi non la vuole scrivere.
4. **Passato "read-only-editable"**: interpretato come spuntabile retroattivamente (il dominio lo consente per costruzione: la riga della settimana passata è indipendente); solo il FUTURO è anteprima non toccabile.

### Acceptance del prompt

- Quattro check verdi ✓; `/settimana` 200 da ospite con board e manager raggiungibili (tab nell'HTML) ✓; "Adesso" nel chunk servito di Oggi ✓ (interpretazione dichiarata); zero controlli nativi ✓; logica board/slot-corrente sotto test ✓.

**Commit:** `feat(planner): week board with hour slots, plan manager, skip history, Adesso on Today`

---
