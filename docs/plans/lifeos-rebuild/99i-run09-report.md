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

**Commit:** `feat(diet): day log with one-tap meals and variants, plan builder, food library`
