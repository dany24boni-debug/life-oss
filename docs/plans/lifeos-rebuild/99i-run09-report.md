# Run 09 — Dieta + Ricorrenze task + Morning brief + Push (codice) + Hardening ×2

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-09` (off `main` @ `437f1a8`). Mai pushato, mai mergiato.
**Brief:** run-09 — l'ULTIMO run di feature della v2: dieta, ricorrenze, brief del mattino, push (solo codice), due prompt di hardening. Dopo questo run resta solo il gate di Davide sul device.

Questo report è fence-exempt e viene appeso a ogni checkpoint.

---

## Pre-flight gate

**1. Clean tree + run-08 in HEAD.**
- `git status` su `main` → pulito. ✓
- `git ls-files` conferma i sentinel run-08: `data/planner.ts` ✓, `lib/focus/engine.ts` ✓, `app/(app)/abitudini/` (6 file) ✓, `supabase/migrations/0028_lo_focus.sql` ✓.
- Non STOP: run-08 è in HEAD (`437f1a87ca466e03e08f7068e941a51ebd83d9ca`, merge di `feat/run-08`).

**2. Branch + HEAD registrati.**
- HEAD di partenza: `437f1a87ca466e03e08f7068e941a51ebd83d9ca`.
- Creato `feat/run-09` e switchato.

**3. Baseline verde (dalla radice).**
- `npm run lint` → pulito ✓ · `npm run typecheck` → pulito ✓ · `npm run lint:sentinels` → pulito ✓
- `npm test` → **Test Files 68 passed (68) · Tests 844 passed (844)** ✓ — combacia con l'atteso (~844).
- `npm run build` → ✓.

**4. Baseline di dimensione (budget del prompt 7, metodo run-08: chunk client della route).**
- Oggi: `page-09380336a82eb801.js` = **47.683 byte**; layout `(app)`: `layout-ccc360235673e5d2.js` = **37.315 byte** — identici ai finali run-08.

**5. Migrazioni.**
- Esistenti: 0001 → 0028 (col doppio 0016 noto). Prossimo numero libero: **0029** (dieta), poi 0030 (ricorrenze, ALTER), 0031 (push, SOLO se 0020 manca di colonne). ✓

**6. Letture pre-prompt (fatte per intero prima di scrivere).**
- `99g-run07-report.md` e `99h-run08-report.md` per intero.
- Codice reale: `data/schemas.ts`, `data/ports.ts`, `data/derived.ts`, `data/sync/{tables,signal,export}.ts`, `data/ids.ts` (+ golden), `data/db.ts`, `data/hooks.ts`, `data/habits.ts` (weekdayOfDay/pattern seed), `data/local/{index,util,habits,planner}.ts` (pattern repo/cascade/derived-id), `data/db.migration.test.ts`, `data/sync/engine-modules.test.ts` (harness round-trip), `data/result.ts`, `lib/nlp-it/{types,parse,matchers}.ts`, `public/sw.js`, `supabase/migrations/0020_push_subscriptions.sql`, `0027_lo_planner.sql` + `0028_lo_focus.sql` (convenzioni + allowlist a 21).

Pre-flight PASS.

---

## Prompt 1 — Dominio Dieta (libreria alimenti personale, piano con varianti, log del giorno)

**Checkpoint: VERDE.** lint ✓ (una `no-unused-vars` di test corretta al volo) · tsc ✓ · build ✓ · sentinels ✓ · test **890/890, 70 file** (baseline 844/68: **+46** — 15 `data/diet.test.ts` nuovo, 21 `data/local/diet.test.ts` nuovo, +2 `data/derived.test.ts` (proteinTargetG), +4 `data/schemas.test.ts`, +1 `data/db.migration.test.ts` (survival v10→v11), +3 `data/sync/engine-modules.test.ts` (round-trip); golden meal-log DENTRO il golden test esistente di `data/ids.test.ts`).

### Modello (`data/schemas.ts`)

- **`Food`** (libreria PERSONALE — nessun DB pubblico di alimenti, per decisione): name, `basis` `per100g | per_piece`, **kcal INTERE** 0..9000 per basis, macro `protein_g/carbs_g/fat_g` in grammi **con al più UN decimale** (refine come i centesimi di Spese), `default_qty` opzionale (la quantità proposta dallo stepper), `archived_at` (archiviato ≠ eliminato), audit. **`basis` è FUORI dagli editable**: cambiarla cambierebbe il significato di ogni quantità già scritta nei pasti (80 g ≠ 80 pezzi) — stesso principio del `kind` delle abitudini.
- **`DietPlan`** (name, `is_active` — al più uno, invariante del REPO), **`DietMeal`** (plan_id, weekday 1-7, name "Pranzo", sort_order; weekday editabile — spostare un pasto di giorno è un gesto vero; plan_id fuori dal patch), **`MealVariant`** (meal_id, name "Variante B", sort; meal_id fuori dal patch), **`MealItem`** (meal_id SEMPRE + `variant_id` nullable: null = riga della composizione BASE; food_id, `qty` positiva a un decimale in g o pezzi secondo la basis; **meal_id E variant_id fuori dal patch** — le righe non migrano tra pasti né tra base e varianti).
- **`MealLog`**: id **DERIVATO** `deriveUuidV8("lifeos:meal-log:<meal_id>:<date>")` — un log per (pasto, giorno) PER COSTRUZIONE, i device convergono; `eaten` boolean (**false = s-mangiato sulla STESSA riga**, l'annullamento viaggia — pattern dei check del planner), `variant_id` nullable (null = base). **Golden test del prefisso** pinnato byte-per-byte in `data/ids.test.ts` (`…:2026-07-13` → `ed1d1ff4-860b-822b-a5f9-6df0379aad43`).
- **`DietExtra`**: id **UUIDv7** (append-only: due spuntini = due righe vere), date, **aut-aut** food_id+qty O name+kcal (macro facoltative) — il refine vive su `DietExtraCreateSchema` e la normalizzazione nel repo; lo schema ENTITÀ resta di sola forma per non scartare mai righe al pull (documentato nello schema).

### Matematica pura (`data/diet.ts` — il brief la chiama "datet.ts", refuso)

- **Interi ovunque**: kcal intere, macro in **DECIGRAMMI interi** (`MacroTotals {kcal, protein_dg, carbs_dg, fat_dg}`); `itemTotals(qty, food)` fa UN solo arrotondamento alla fine (per100g: fattore qty/100; per_piece: fattore qty), da lì in poi solo somme intere — testato con 100 somme ripetute di 0,1+0,2 g che restano ESATTAMENTE 300 dg (la scia float 0,30000000000000004 è il caso di test).
- **`composeDayMeals`**: filtra i pasti del weekday (via `weekdayOfDay` di data/habits.ts, DST-immune, riusato mai riscritto), risolve righe→alimenti, varianti→righe, log→selezione; **una variante SOSTITUISCE la base** (documentato); variante scelta ma eliminata → **fallback onesto alla base**; alimento non risolvibile → riga visibile ma `totals: null`, fuori dai conti (mai un buco che lancia). Tutto testato su fixture.
- **`dayTotals(day, extras)`** = pasti **MANGIATI** + tutti gli extra (è il "consumato finora" dell'header, non il totale teorico del piano — documentato); **`remainingVsTarget(totals, kcalTarget, proteinTargetG)`** con righe null senza obiettivo (mai barre inventate) e resti negativi sopra l'obiettivo (onesti); `extraView` per gli extra (voce libera senza macro = kcal contate, macro a 0).
- **`data/derived.ts` guadagna `proteinTargetG(weightKg)`**: ~1,8 g/kg dal peso più recente, clamp 60..260, null senza peso — firma gemella di `waterTargetMl`, testata su valori noti (80→144, 82,4→148, 30→60, 150→260).

### Repo (`data/local/diet.ts`) — pattern planner/habits al millimetro

- **Alimenti**: CRUD + archive/unarchive idempotenti + softDelete/restore (undo); macro assenti alla creazione → 0 (mai proteine inventate: 0 è l'accumulo onesto); lista per nome it.
- **Piani**: un-solo-attivo transazionale (`deactivateOthers`), `activePlan` tollerante ai merge (vince updated_at), **`duplicatePlan`** profonda (pasti+varianti+righe con id rimappati, " (copia)", mai attiva, **i log restano all'originale** — testato).
- **Pasti**: CRUD (sort_order = coda del (piano, giorno)), **cascade** pasto → varianti+righe+log con lo STESSO deleted_at e restore che revive SOLO quel cascade (testato con una riga eliminata prima che resta morta), **`duplicateMeal`** (stesso giorno, in coda, " (copia)"), **`copyMealToWeekdays`** (dedupe, mai il proprio giorno — pattern copySlotToWeekdays) e **`copyDayToWeekdays`** (tutti i pasti del giorno, in ordine, in coda al giorno bersaglio), `reorderMeals(planId, weekday, ids)` che salta id d'altri piani/giorni.
- **Varianti**: CRUD + cascade sulle proprie righe + **`createVariantFromBase`** one-tap (copia le righe base; nome "Variante B", "C"… — la base è la "A") + reorder. `createItem` valida che la variante appartenga al SUO pasto (testato il rifiuto).
- **Log**: `logMeal`/`setVariant` sullo stesso upsert per-(pasto, giorno) a id derivato — `setVariant` preserva eaten e valida l'appartenenza della variante; tombstone del giorno rianimata (loggare È l'intento); un de-eat riusa la riga (count == 1 testato).
- **Extra**: aut-aut normalizzato (via libreria azzera la voce libera e viceversa; update valida la riga RISULTANTE), delete+undo, **`dayExtras`** con alimenti risolti e totali già calcolati.
- **`dayDiet(date)`**: weekday → piano attivo → pasti del giorno → varianti/righe/log/alimenti (bulkGet) → `composeDayMeals`. Senza piano: `{plan: null, meals: []}`, mai un throw (testato). Fixture completa testata: pranzo pasta 80 g + pollo 150 g = **447 kcal / 45,3 g proteine** in interi.
- Un bug di transazione Dexie scovato dai test al primo giro: `copyDayToWeekdays` leggeva `diet_plans` fuori dallo scope della transazione (NotFoundError) — tabella aggiunta allo scope, verde.

### Dexie v11, sync, migrazione

- **Dexie v11** additiva: 7 tabelle (`foods`, `diet_plans`, `diet_meals` (indice plan_id), `meal_variants`/`meal_items` (indice meal_id), `meal_logs` (indici meal_id e date), `diet_extras` (indice date)). **Survival test v10→v11**: fase focus scritta a v10 sopravvive byte-per-byte, tabelle dieta subito usabili (indici verificati); verno-assert 10→11 e elenco tabelle a 29 aggiornati.
- **Sync**: 7 voci nuove nel registro (lo_foods con `archived_at` tra le colonne istante); l'envelope export/import si estende da solo (derivato da SYNC_TABLES, run-07). **Round-trip FakeRemote**: alimento+piano+pasto+variante+riga identici su B con LWW sulla qty; **convergenza del log su id derivato** (due device loggano lo stesso pasto-giorno → UNA riga remota) e **s-mangiare che viaggia** (eaten:false sulla stessa riga, count remoto sempre 1); cascade del piano fino ai log su B, con l'extra che resta vivo (non è del piano).
- **Migrazione `0029_lo_diet.sql` SCRITTA, NON applicata**: 7 tabelle coi check di dominio (basis chiusa, kcal 0..9000, macro 0..1000, qty >0..10000, weekday 1-7), blocco per-tabella 0019, **`lo_push` ridichiarata con l'allowlist a 28** (21 di 0028 + 7). Nessun unique server-side su (meal, date): garanzia client come lo_sera/lo_body/lo_habit_logs (commentato nel file). Aut-aut degli extra = invariante client (commentato).
- Hook nuovi: `useFoods`, `useDietPlans`, `useActiveDietPlan`, `useDietMeals`, `useMealVariants`, `useMealItems`, `useDayDiet`, `useDayExtras`. `withMutationSignal` decora il repo nuovo; `createLocalRepos` lo cabla.

### Scelte documentate (delta/interpretazioni)

1. **La variante SOSTITUISCE la base** (non somma): "Variante B" è una composizione alternativa del pasto — è l'unica lettura compatibile con "kcal per chosen variant".
2. **`dayTotals` conta solo i pasti mangiati** (+ extra): è il numero dell'header "1.640 / 2.760", cioè il consumato, non il pianificato.
3. **Macro assenti alla creazione dell'alimento = 0**, mai null: l'accumulo del giorno resta onesto (kcal note, proteine ignote contano 0 — la UI non le inventa).
4. **`proteinTargetG(weightKg)`**: il brief dice "(profile)" ma l'unico input della formula è il peso — firma gemella di `waterTargetMl`, stessa famiglia.
5. **Alimento eliminato referenziato da una riga**: la riga resta visibile con totals null e fuori dai conti — nessun cascade dai pasti alla libreria (l'archivio è il flusso primario; l'eliminazione resta possibile con undo).
6. **`data/diet.ts`**: il nome nel brief ("datet.ts") è un refuso evidente — usato `diet.ts`.

### Acceptance del prompt

- Quattro check verdi ✓ (più sentinels). Migrazione presente, NON applicata ✓. Golden del prefisso meal-log ✓. Matematica intera testata (incl. anti-float) ✓. Convergenza + s-mangiare che viaggia ✓. Dexie bump con survival ✓. Fence: solo `data/**` + `0029` + test (git status quotato pulito).

**Commit:** `feat(diet): personal food library, weekly plan with variants, converging day log` → `134936e`

---

## Prompt 2 — UI Dieta (`/dieta`)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ (`ƒ /dieta`) · sentinels ✓ · test **902/902, 71 file** (+12: `app/(app)/dieta/logic.test.ts` nuovo — formattazione it-IT con grouping sempre, ciclo varianti, tono barre al +10%, parse qty/kcal/macro, stepper/default per basis, somma di authoring). **Dev-server DA OSPITE (build di produzione):** `/dieta` **200** con le TRE tab nell'HTML servito (`>Oggi<`, `>Piano<`, `>Alimenti<`); `/` **200**; **zero controlli nativi** nell'HTML di /dieta E nel chunk della route (`<select`, checkbox/date/time/number: 0).

### Struttura (`app/(app)/dieta/**` nuovo)

- **`logic.ts`** (+12 test): `formatInt`/`formatGramsFromDg` (**`useGrouping: "always"`** — la landmine it-IT: "1.640"; i decigrammi si dividono per 10 SOLO in display, mai aritmetica), `kcalProteinLine`, `formatQty` ("80 g", "1,5 pz"), **`cycleSelection`** (base → varianti → base; scelta morta riparte dalla base), **`barTone`** (ember/salvia; **oltre il +10%** dell'obiettivo vira a segnale — solo il colore, mai copy colpevolizzante; il +10% esatto NON vira, testato), `parseQtyInput`/`parseKcalInput`/`parseMacroInput` (virgola o punto, un decimale, garbage → null), `qtyStep` (10 g / 1 pz), `defaultQtyFor` (default_qty dell'alimento o 100 g / 1 pz), `sumItemTotals` (authoring live, alimenti persi fuori dai conti).
- **`oggi-tab.tsx`** — il giorno: **header quieto** "1.640 / 2.760 kcal · 92 / 144 g proteine" con DUE ProgressBar sottili (kcal ember, proteine salvia, `barTone` oltre il +10%); obiettivi dal profilo (kcal di **mantenimento** — la stessa lettura dell'anteprima profilo run-07 — e `proteinTargetG` dal peso più recente); senza profilo solo il consumato e una riga che spiega dove attivarli (mai barre inventate). **Card pasto**: nome + **chip variante** (una variante = tap che cicla; **due o più = scelta esplicita** in BottomSheet/Modal coi kcal di ogni composizione), righe della selezione con quantità, riga kcal+proteine, **UN TAP "Fatto"** (toast con Annulla → eaten:false; ri-tap sul Fatto = s-mangia senza cerimonie; card spuntata con ring salvia). **Extra**: card con aggiunta veloce (sheet a due modi: **Dalla libreria** — autocomplete + stepper nelle unità della basis — o **Voce libera** — nome + kcal, proteine opzionali) e lista con elimina+undo; copy senza giudizio ("Fuori piano? Si scrive qui… conta nei totali"). Senza piano attivo: EmptyState con CTA che salta alla tab Piano (gli extra restano usabili).
- **`piano-tab.tsx`** — il builder: lista piani (attiva/apri/crea — il nuovo nasce attivo e apre l'editor, pattern planner), editor con **rinomina inline**, **chips giorno L-D col conteggio pasti**, righe pasto coi **kcal base live**, **"Copia giorno su…"** (copyDayToWeekdays), **Duplica/Elimina piano con undo** (restore del cascade P1). **Scheda pasto** (BottomSheet/Modal): nome, **composizioni a chips** (Base + varianti, ognuna col SUO kcal live), righe alimento con **autocomplete + crea al volo**, **stepper quantità** (±10 g/±1 pz, valore tappabile → input col parse), kcal auto per riga, Togli con undo; **varianti**: "+ Variante vuota" / "+ Copia della base" (one-tap `createVariantFromBase`), rinomina, elimina con undo; **"Copia il pasto in…"** a chips; totali della selezione vivi in coda; Elimina pasto con undo. **Totali del giorno vivi**: RICORSIONE di componenti (un hook per pasto, numero di hook stabile per istanza — le regole di React rispettate senza query dinamiche), documentata nel codice.
- **`alimenti-tab.tsx`** — la libreria: ricerca (normalizzazione accenti), righe con kcal+proteine per basis, sezione "Archiviati" collassata, **scheda alimento** (nome, **basis a chips SOLO alla creazione** — dopo è una riga che spiega perché non si cambia, kcal/macro con parse decimale, quantità proposta), **Archivia con undo**, Elimina con undo (copy onesta: "le righe che lo usano escono dai conti"). **SEED: NIENTE** — l'EmptyState starter spiega il setup dei due minuti ("Niente database pubblico: crei i TUOI alimenti una volta, dall'etichetta…").
- **`food-picker.tsx`** — selettore INLINE (mai sheet sopra sheet): ricerca + «Crea "query"» con la scheda minima (nome, basis, kcal, proteine opz.) che consegna subito l'alimento; riusato da scheda pasto ed extra. **`qty-stepper.tsx`** — lo stepper 44px nelle unità della basis. **`dieta-screen.tsx`** — Tabs Oggi/Piano/Alimenti (Oggi default). **`page.tsx`** — shell server pattern corpo.

### Cablaggio (anchored)

- **`icons.tsx`**: `IconMeal` nuova (piatto e posate, tratto 1.8 come le altre).
- **`app-nav.tsx`** — Rail "Moduli", dopo Focus:
```
   { href: "/focus", label: "Focus", icon: IconFocus },
+  { href: "/dieta", label: "Dieta", icon: IconMeal },
   { href: "/esami", label: "Esami", icon: IconExam },
```
- **`impostazioni/page.tsx`** — MODULE_LINKS idem, desc "Pasti del giorno, piano e libreria alimenti" (+ import IconMeal).
- **`today-tiles.tsx`** — tile **"Pasti"** SOLO quando il piano attivo prevede pasti oggi: "2/4 pasti · 1.640 kcal finora.", avvolto in `<Link href="/dieta">` (focus-visible ring); nel grafo di Oggi entrano SOLO `useDayDiet`/`useDayExtras` (hooks già nel grafo), `dayTotals` e `formatInt` (funzioni pure) — nessun componente della route /dieta.

### Delta di dimensione di Oggi (metodo run-08, budget P7)

| Chunk | Pre-run | Dopo P2 | Δ |
| --- | --- | --- | --- |
| `app/(app)/page-*.js` (Oggi) | 47.683 B | **49.710 B** | **+2,0 kB raw** |
| `app/(app)/layout-*.js` (shell) | 37.315 B | 38.241 B | +0,9 kB (voce nav) |

### Scelte documentate

1. **Obiettivo kcal dell'header = mantenimento** (`calorieTargetKcal(profile, anno, "maintain")`): non esiste una preferenza di goal persistita (run-07 espone il mantenimento nell'anteprima profilo) — la lettura coerente e onesta.
2. **Chip variante: cicla con UNA variante, sceglie esplicitamente con 2+** ("via BottomSheet when >2" del brief letto come >2 opzioni totali): ciclare alla cieca tra 3+ composizioni confonde.
3. **Selettore alimenti inline** (non un secondo sheet sopra la scheda pasto): il kit non prevede stacking di sheet; l'inline è più robusto e più veloce.
4. **Totali del giorno nel builder via ricorsione di componenti**: la fence P2 non include `data/**`, quindi niente hook composto nuovo; la ricorsione tiene un hook per pasto con numero stabile per istanza.
5. **Dev-check sulla build di produzione** (`npm start`): stesso esito del dev-server, chunk onesti già misurabili.

### Acceptance del prompt

- Quattro check verdi ✓; `/dieta` 200 da ospite con le tre tab ✓; zero controlli nativi ✓; logica UI testata (ciclo varianti, barre, parse) ✓; delta chunk di Oggi riportato ✓ (+2,0 kB raw, budget P7 rispettato).

**Commit:** `feat(diet): day log with one-tap meals and variants, plan builder, food library` → `bad616b`

---

## Prompt 3 — Ricorrenze dei task ("ogni lunedì")

**Checkpoint: VERDE.** lint ✓ · tsc ✓ (tre fixture Task nei test esistenti hanno guadagnato `recurrence: null` — ripple di tipo atteso) · build ✓ · sentinels ✓ · test **936/936, 72 file** (+34: 9 `data/recurrence.test.ts` nuovo, +5 `data/local/tasks.test.ts`, +14 `lib/nlp-it/parse.test.ts` (12 casi in tabella + 2 su frammento e contesa), +4 `app/(app)/_components/tasks/logic.test.ts`, +2 `data/schemas.test.ts`, +1 round-trip di convergenza in engine-modules; golden task-recur DENTRO il golden esistente di ids.test). **Dev-server:** `/tasks` **200**, zero controlli nativi — i task non ricorrenti si comportano identici (la ricorrenza è additiva ovunque).

### 1. Modello + spawn (data/**)

- **`Task.recurrence`** nullable: `{freq: "daily" | "weekly", weekdays?: number[]}`; `RecurrenceSchema` con refine (weekly richiede ≥1 giorno); **`.default(null)` sull'entità** — le righe pre-run-09 e i backup passano il parse materializzando null (testato). Editabile in create e patch; il repo **normalizza** (dedupe+sort; weekly con tutti e 7 i giorni = daily — una sola rappresentazione, pattern weekdays abitudini).
- **`data/recurrence.ts`** (puro, 9 test): `nextOccurrence(rule, after)` STRETTAMENTE dopo (daily +1; weekly il prossimo previsto; testato su confini di mese/anno e sui giorni DST 2026), `firstOccurrence(rule, today)` OGGI INCLUSO (la prima occorrenza del quick-add), `normalizeRecurrence`, `recurrenceLabel` ("ogni giorno" / "nei feriali" / "ogni lun, mer e ven"), `buildSpawnTask` (porta regola/titolo/orario/priorità/tag/note/module_link; **sottotask azzerati con gli stessi id**; status open). Aritmetica a mezzogiorno UTC su stringhe civili (weekdayOfDay riusato).
- **`complete(id, opts?: {today})`**: completare un ricorrente GENERA la prossima occorrenza — data = `nextOccurrence(rule, max(today, task.date ?? today))` (un ricorrente in ritardo completato oggi riparte da oggi, niente occorrenze fantasma — testato); **id DERIVATO `lifeos:task-recur:<completed_task_id>`** (golden `84131898-…` pinnato) calcolato PRIMA della transazione Dexie (crypto.subtle: la lezione run-07); se la riga spawn esiste già (altro device, o tombstone da undo) si **rianima con la data nuova** (stessa PK, mai una terza riga — testato). Idempotente: ri-completare non tocca lo spawn.
- **`uncomplete(id)`**: tombstona lo spawn SOLO se ancora intonso (vivo e aperto) — l'undo del "fatto" annulla anche la prossima occorrenza; uno spawn già completato dall'utente non si tocca (testato). Ri-completare rianima (il "restore" del brief).
- **Day-roll**: un ricorrente scaduto resta in "In ritardo" come ogni task — nessun salto silenzioso (documentato in data/recurrence.ts).
- **Dexie v11 ESTESA** (non v12): upgrade con backfill `tasks.recurrence = null` (pattern v6 gym) — v11 è nata nel P1 di QUESTO run e non è mai stata spedita: estenderla è pulito e fa una sola migrazione per il run. Survival test v10→v11 esteso (task pre-run-09 guadagna null; riga v1 idem).
- **Convergenza su FakeRemote**: due device completano offline la STESSA istanza → **2 righe remote in tutto** (l'istanza + UNA spawn sulla PK derivata), identiche su A e B, data giovedì 16 (fixture lun 13 + regola lun/gio) — testato.
- **Migrazione `0030_task_recurrence.sql` SCRITTA, NON applicata**: SOLO `ALTER TABLE lo_tasks ADD COLUMN IF NOT EXISTS recurrence jsonb` + comment — nessuna tabella nuova, **nessuna ridichiarazione di lo_push** (il SET dinamico raccoglie la colonna da information_schema).

### 2. Parser (lib/nlp-it — grammatica estesa)

- **`FragmentKind` += "recurrence"**, `RecurrenceValue` dichiarato in types.ts (la lib resta autonoma, zero import da data/); `ParseResult.recurrence`.
- **`matchRecurrences`**: `ogni giorno`; `nei feriali` (lun-ven); `ogni <weekday>` pieno/abbreviato/accentato con **liste** ("e" e virgole: "ogni lun, mer e ven") — riusa le WEEKDAY_FORMS esistenti (piene prima delle abbreviazioni). `displayRecurrence` per il chip.
- **Ordine di matching**: ricorrenze PRIMA di orari e date — "ogni lunedì" maschera il suo "lunedì" (che altrimenti diventerebbe una data); vince l'ultima regola nel testo, la perdente torna titolo (coerente con le date, testato).
- **Regola vs data**: la regola detta il RITMO, la data la PRIMA occorrenza — esplicita vince ("ogni lunedì il 15/08" → regola lun + data 15/08); senza, **il primo giorno previsto OGGI INCLUSO** ("ogni ven" di venerdì parte oggi; delta dichiarato: i weekday-data nudi restano strettamente futuri, ma "ogni X" scritto di X intende oggi).
- **12 casi in tabella** + span esatto del frammento (dismissibile) + guardia ("ogni tanto" resta titolo; "lunedì" nudo = solo data, mai regola).

### 3. UI (quick-add, scheda, liste, toast)

- **Quick-add**: chip "ripeti · ogni lun e gio" dismissibile; `applyDismissals` esteso (con `today`): il chip ripeti porta regola E data derivata (vivono e muoiono insieme, pattern "stasera"); **data esplicita dismessa con regola attiva → la data torna alla prima occorrenza della regola** (testato); `toTaskCreate` porta la regola.
- **Scheda dettaglio**: riga **"Ripeti"** (Nessuna / Ogni giorno / **Giorni…** con chips L-D 44px, aria-label coi nomi pieni), editabile sempre; "Giorni…" parte dal giorno del task (o di oggi); **deselezionare l'ultimo giorno = Nessuna** (il gesto onesto); hint "Completarlo genera la prossima occorrenza."
- **Liste**: glifo quieto `IconRepeat` (riusata) nella riga meta dei ricorrenti.
- **Toast di completamento**: coda **"· prossima: gio 16 lug"** (dayHeading, "domani" quando è domani); `actions.complete` e il check inline dell'agenda passano il giorno civile Europe/Rome al repo.

### Delta dichiarati

1. **Fence "app/(app)/tasks/** + task detail sheet"**: il modulo task vive quasi tutto in `app/(app)/_components/tasks/**` (quick-add, scheda, item, actions, logic) + `agenda-list.tsx` (check inline = completamento) — le superfici toccate sono esattamente quelle che il build spec ordina (chip quick-add, riga Ripeti, glifo, toast).
2. **Prima occorrenza OGGI INCLUSO** (vs date nude strettamente future): "ogni lunedì" scritto di lunedì parte oggi — la lettura utile; lo spawn resta strettamente-dopo.
3. **v11 estesa col backfill invece di una v12**: v11 è interna al run-09, mai spedita a metà (documentato in data/db.ts).
4. **`0030_task_recurrence.sql`**: il nome nel brief ("0_recurrence.sql") è un refuso — numerata 0030 come da sequenza.
5. **uncomplete non tocca spawn già completati/modificati**: la guardia "intonso" (vivo E aperto) evita di cancellare lavoro fatto sull'occorrenza successiva.

### Acceptance del prompt

- Quattro check verdi ✓; test di spawn/convergenza/parser ✓ (golden del prefisso, FakeRemote a 2 righe, 12+ casi grammatica); `/tasks` invariato per i non ricorrenti ✓ (dev-server 200, ricorrenza additiva); migrazione presente NON applicata ✓.

**Commit:** `feat(tasks): completion-based recurrence with converging spawn and Italian grammar` → `1cf8c43`

---

## Prompt 4 — Morning brief su Oggi (nucleo deterministico, rifinitura LLM facoltativa)

**Checkpoint: VERDE.** lint ✓ (un `set-state-in-effect` intermedio sul ramo cache — risolto con la lettura nell'initializer lazy, l'idioma dei run 07/08) · tsc ✓ · build ✓ (`ƒ /api/brief`) · sentinels ✓ · test **944/944, 73 file** (+8: `data/brief.test.ts` nuovo — fixture ospite-minimale, giornata piena, vuoto→null, priorità a 4 pezzi, ritardi, forme di palestra/slot/pasti/acqua/streak, validazione dello snapshot). **Dev-server:** `POST /api/brief` **401** da non autenticato ✓ (il primo tentativo dava 404: race con il boot del server, ritentato pulito); `/` **200** con le stringhe del composer nel chunk servito di Oggi (la riga monta coi dati IndexedDB del client — l'interpretazione chunk-level dei run precedenti).

### 1. Il composer (`data/brief.ts`, puro — 8 test su fixture)

- **`BriefSnapshotSchema`** (zod): lo snapshot AGGREGATO — conteggi task (aperti/in ritardo), next-up gym + fatto-oggi, slot del piano (in corso o prossimo), pasti mangiati/totale, acqua ml/obiettivo, streak. Mai liste, mai dump: è l'unico payload che il modello vedrà.
- **`composeBrief(snapshot)`**: UNA frase italiana, ordine di priorità fisso (palestra → task, coi ritardi che pesano → slot del piano → pasti → acqua → streak), **al più QUATTRO pezzi** (oltre non è più una frase), omissioni oneste (acqua a 0 e streak a 0 non compaiono; ospite con soli task = riga solo dei task; zero dati = **null**, mai una frase vuota). Mai un throw (clamp difensivi), mai un numero inventato. Esempio testato byte-per-byte: *"Palestra: Torso A, 4 task aperti (2 in ritardo), alle 09:00 Deep work, 1/4 pasti."*

### 2. `TodayBrief` (`_components/today-brief.tsx` + wiring ancorato)

- Riga quieta `em-body-sm` SENZA chrome, subito sotto il saluto di Oggi; con zero dati (o durante il load) rende null. Snapshot composto dagli hook esistenti (useTasksSummary/useOverdueTasks/useNextUpDay/useGymSessionsByDay/useTodayPlanSlots+adessoEntry/useHabitBoard (acqua)/useStreak/useDayDiet) — nessuna query nuova, solo composizione.
- **Wiring `app/(app)/page.tsx`** (anchored):
```
         <h1 …>{displayName ? `Ciao, ${displayName}` : "Ciao"}</h1>
+        {/* La riga del buongiorno (run-09 prompt 4) … */}
+        <TodayBrief authed={Boolean(user)} />
```
  Il flag `authed` arriva dal server component (che l'utente già lo sa): il client non fa MAI la chiamata da ospite.

### 3. Rifinitura LLM (`app/api/brief/route.ts` — chiave e account soltanto)

- **Auth 401** → **rate-limit** (limiter esistente, `brief:<userId>` 5/min — il client chiama una volta al giorno) → **503 senza `ANTHROPIC_API_KEY`** → body ≤10 KB → **snapshot rivalidato con lo STESSO schema zod del composer** (mai fidarsi del client) → Haiku **pinnato** (`MODELS.HAIKU`, riuso di lib/anthropic/client READ-ONLY) con system prompt che vieta emoji/esclamativi/fatti non nello snapshot, ≤160 caratteri → risposta `{line}`; risposta strana (vuota, >180 char) o errore modello → `{line: null}` (log server-side, mai dettagli al client — pattern overseer).
- **Client**: cache per-giorno in localStorage (`lifeos.brief.<date>`, giorni vecchi potati) = UNA chiamata a mattina; fallback SILENZIOSO alla frase deterministica su qualunque intoppo (401/429/503/rete/risposta invalida). La copy non promette mai l'LLM: la frase deterministica È il prodotto.

### Acceptance del prompt

- Quattro check verdi ✓; fixture del composer (ospite-minimale, giornata piena, vuoto→null) ✓; `/` da ospite serve lo slot del brief ✓; route 401 da non autenticato nel dev-server pass ✓; senza chiave: zero comportamento oltre la riga deterministica ✓ (503 → fallback muto).

**Commit:** `feat(brief): deterministic morning brief on Oggi with optional key-gated polish` → `153989d`

---

## Prompt 5 — Notifiche push, SOLO CODICE (blueprint 17)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ (`ƒ /api/push/subscribe` e `ƒ /api/push/unsubscribe`; **build SENZA alcuna env VAPID**: la card degrada, il percorso subscribe è irraggiungibile) · sentinels ✓ · test **947/947, 74 file** (+3: `data/push.test.ts` nuovo — conversione base64url della chiave VAPID su valori noti incl. lunghezza 65 della P-256, estrazione del payload di subscription con rifiuto delle rotte, schema categorie chiuso). **SW**: `node --check public/sw.js` ✓ e `SW_VERSION` **v1 → v2**. **Dev-server:** `POST /api/push/subscribe` **401**, `POST /api/push/unsubscribe` **401** da non autenticato; `/impostazioni` 200. **NIENTE deployato, NIENTE chiamato sul vivo.**

### 1. Audit di 0020 → migrazione `0031_push_alter.sql` (SCRITTA, NON applicata)

0020 ha GIÀ endpoint/p256dh/auth/user_agent/created/updated e la UNIQUE (user_id, endpoint). Manca SOLO l'opt-in per categoria → `ALTER … ADD COLUMN IF NOT EXISTS categories jsonb` (+ comment; null = nessuna attiva). In più **`lo_push_sends`** (delta motivato): il registro di IDEMPOTENZA del sender — PK (user_id, dedupe_key: `reminder:<id>` / `brief:<data>` / `streak:<data>`), **RLS accesa e NESSUNA policy** = solo service role; NON è una tabella sync (nessuna voce nel registro client, **nessuna ridichiarazione di lo_push**).

### 2. Client (`data/push.ts` + card Impostazioni)

- **`data/push.ts`** (additivo, testato): `PushCategoriesSchema` (reminders/brief/streak), etichette italiane, `urlBase64ToUint8Array` (per `applicationServerKey`), `subscriptionPayload` (da `PushSubscription.toJSON()`, null se rotta), `PushSubscribeSchema` riusato dal server (mai fidarsi del client).
- **`push-section.tsx`** (Impostazioni, SOLO account — `{user ? <PushSection/> : null}` nel server component, posizionata sopra il pannello di verità): copy onesta sui requisiti ("su iPhone serve LifeOS installata come app"); **senza `NEXT_PUBLIC_VAPID_PUBLIC_KEY` la card dice "non ancora attivo su questo server" e non mostra MAI un bottone rotto**; browser senza PushManager = copy dedicata; permesso negato = spiegazione senza colpa. Attiva → `Notification.requestPermission` SOLO al gesto → `pushManager.subscribe` con la chiave → POST; **switch per categoria** (Promemoria task / Brief del mattino / Streak a rischio — Switch del kit); **Disattiva** = DELETE server + `subscription.unsubscribe()` (mai endpoint orfani). Stato reale al mount (capacità, permesso, subscription, categorie dal server via GET), tutto in effetto async.

### 3. SW (`public/sw.js`, edit versionata)

`SW_VERSION` v2 (il toast di aggiornamento esistente porta il cambio); handler **`push`** (payload `{title, body, tag, url}` difensivo campo per campo, icona /icon-512, badge /icon) e **`notificationclick`** (focus-or-open con navigate try/catch). Kill-switch template intatto.

### 4. API (`app/api/push/**`)

`subscribe` POST (authed 401, zod `PushSubscribeSchema`, **upsert RLS-scoped** su (user_id, endpoint) col client dell'UTENTE — la policy "Users own" di 0020 fa il resto; errore colonna mancante pre-0031 → 503 e la card resta onesta) + GET (categorie del proprio endpoint); `unsubscribe` POST (delete della propria riga).

### 5. Edge Function `supabase/functions/push-sender/` (Deno — MAI deployata dalla sessione)

Bersaglio di cron (ogni 5'): legge col service role, spinge Web Push VAPID rispettando `categories`. **Import pinnati** `jsr:@supabase/supabase-js@2.45.4` e `jsr:@negrel/webpush@0.3.0` — l'ECCEZIONE Deno dichiarata del run (solo qui; `package.json` byte-identico; la checklist ordina di verificare i pin alla prima deploy). Chiavi VAPID di `web-push` (base64url raw) convertite in JWK P-256 ES256 nel codice (x/y dal punto non compresso, d dallo scalare — commentato). **Tre categorie**: promemoria scaduti (dopo l'invio marca `fired_at`+`updated_at` su lo_reminders: i client lo pullano e non lo risuonano, "Mentre eri via" lo mostra — commentato); brief 07-08 Roma una volta al giorno (conteggio VERO dei task del giorno — la riga ricca resta nel client); streak 20-21 SOLO se ieri attivo e oggi no (semplificazione onesta, commentata — al massimo TACE). **Idempotenza conquistata** con `INSERT … lo_push_sends` (23505 = già mandata, si salta); endpoint 404/410 → riga pulita. **Mai payload nei log, solo conteggi.**

### 6. `17-activation-checklist.md`

Otto passi, tutti di Davide: genera VAPID (npx one-shot, non una dipendenza), applica 0031, 3+1 env (Vercel + function secrets, redeploy per la NEXT_PUBLIC), `supabase functions deploy push-sender --no-verify-jwt` con verifica dei pin, cron pg_cron/pg_net (SQL pronto), requisiti iOS, smoke a telefono bloccato (con le query di verifica), rollback in due minuti.

### Delta dichiarati

1. **`lo_push_sends` in 0031**: il brief chiede "marking sent (idempotent per reminder)" — per brief/streak (senza riga da marcare) serve un registro; una tabella server-only è più onesta di colonne sparse.
2. **Il sender marca `fired_at` sui promemoria pushati**: la notifica sul telefono È lo scatto — i client non risuonano il già-suonato e "Mentre eri via" resta corretto (fired, non dismissed).
3. **`tsconfig.json` + `eslint.config.mjs`**: `supabase/functions` escluso dalla toolchain Node (mondo Deno: global `Deno`, import `jsr:` — la piattaforma lo valida al deploy). Conseguenza necessaria del fence, commentata nei file.
4. **GET su `/api/push/subscribe`**: la card deve mostrare le categorie salvate del dispositivo — lettura minima per endpoint, stessa route.

### Acceptance del prompt

- Quattro check verdi ✓; build senza env VAPID con card che degrada ✓; SW parse + version bump ✓; endpoint 401 ✓; checklist completa ✓; niente deployato/chiamato ✓.

**Commit:** `feat(push): web push code path, opt-in UI, edge sender function (activation pending)`
