# Run 12 — Palestra Pro, I Numeri, La Craft Bar (Set B + WOW)

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-12` (da `main` @ `ff17b91`, che contiene run-11 mergiata). Mai pushato, mai mergiato.
**Brief:** run-12 — Set B "Palestra pro + numeri" (§4: plate calculator, PR al set, correlazioni native, "Il tuo mese") + il layer craft/WOW (§3: command palette ⌘K) + i layout desktop rimandati da run-10 (dieta a griglia, calendario due pannelli, "ne restano" in /dieta). Regola cardinale: **il chunk di Oggi è CONGELATO a 59.729 B raw** — tutto ciò che nasce in questo run vive in /gym, /stats, /dieta, /calendar o nel layout (solo shell palette, corpo lazy). P7 prova Oggi byte-identico o ridotto.

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## P0 · Pre-flight gate

**1. Clean tree.** `git status --porcelain` → vuoto. ✓

**2. Merged-state check (la lezione run-11).** Da `main`: `git ls-files docs/plans/lifeos-rebuild | grep 99k` → `99k-run-11-report.md` PRESENTE. `main` @ `ff17b91` = "Merge branch 'feat/run-11'" — run-11 (e con lei run-10) è mergiata. **Caso pulito: `feat/run-12` branchata da `main`.** Nessun delta di lineage, un solo merge al gate.

**3. Branch.** Creato `feat/run-12` e switchato. ✓

**4. Baseline verde PRIMA di ogni edit (dalla radice, come da AGENTS.md).**
- `npm run lint` → pulito ✓
- `npm run typecheck` → pulito ✓
- `npm run lint:sentinels` → pulito ✓ ("no personal-data sentinels found")
- `npm test` → **Test Files 78 passed (78) · Tests 998 passed (998)** ✓ — al numero l'atteso del brief (~998/78) e il finale run-11.
- `npm run build` → ✓ (webpack, build fresca dopo `rm -rf .next`, tutte le route presenti)

**Baseline di dimensione (metodo 99h: chunk client della route, raw + gzip).**

| Chunk | File | Raw | Gzip | Nota |
| --- | --- | --- | --- | --- |
| **Oggi** `(app)/page` | `page-21696031733f0d65.js` | **59.729 B** | 18.689 B | **= il numero CONGELATO del brief, al byte.** Tetto: ≤59.729. |
| Layout `(app)` | `layout-27f267e27f7fbf5e.js` | **38.370 B** | 11.989 B | = atteso brief. Budget run: ≤ +2.500 B raw (shell palette). |
| /gym | `page-ae7f72034eaec2ed.js` | 96.527 B | 23.927 B | Brief dice ~96.163 (misura 99j post-P2 run-10): **+364 B di drift run-11** — delta dichiarato, la baseline vera di questo run è 96.527. |
| /stats | `page-8af6ba278f87770b.js` | 10.894 B | 4.180 B | Nessun budget formale; registrato. |
| /dieta | `page-b82f75ee6d188924.js` | 52.271 B | 11.503 B | Idem. |
| /calendar | `page-9c28585efb65fd0c.js` | 10.425 B | 4.270 B | Idem. |

**5. Letture (per intero, in ordine):** `AGENTS.md` · `docs/plans/lifeos-rebuild/v3-proposals.md` (477 righe — Set B §4, WOW §3, PROP-diet-05, PROP-cal-02, PROP-diet-01) · `99k-run-11-report.md` (282 righe).

**Delta brief ↔ documenti:**
1. `/gym` baseline: il ~96.163 del brief è la misura 99j (run-10 P2); run-11 ha mosso il chunk a 96.527 senza registrarlo (nessun prompt gym in run-11 — drift da moduli condivisi). Registrato qui, nessuna azione.
2. Il brief run-12 dice "PROP-gym-03 profilo per-dispositivo, localStorage come il chime"; il P1 di questo brief indica invece la casa naturale nel profilo SINCRONIZZATO (colonne nullable sulla riga profilo esistente). Il brief vince su scope/invarianti (il P1 decide); delta annotato per il P1.
3. Set B in v3-proposals include anche PROP-stats-01 (DeltaChip), PROP-stats-02 (pannello dieta in stats), PROP-corpo-01 (media mobile) — il brief li assorbe in P3a/b ("DeltaChip finally used", "diet becomes visible in /stats"); PROP-corpo-01 non è nominata dal brief run-12 → resta fuori set salvo spazio, delta al P3.
4. Domande aperte 99k rilevanti qui: i marker timeline che doppiano i pannelli (possibile fonte di byte se Oggi dovesse dimagrire — NON necessario: il run non tocca la home) e il budget home a 271 B dal tetto (questo run lo CONGELA invece di spenderlo).

Pre-flight PASS.

**Commit:** `run-12/P0: preflight + baseline`

---

## P1 · Schema decision (+0033)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1003/1003, 78 file** (+5: sopravvivenza/normalizzazione/domini attrezzatura).

### L'enumerazione (cosa deve PERSISTERE perché il Set B esista)

| Bisogno | Decisione | Schema? |
| --- | --- | --- |
| **Profilo bilanciere+dischi** (P2a, PROP-gym-03/WOW-01) | **Colonne nullable sulla riga profilo GIÀ sincronizzata** (`lo_settings`, il pattern 0025 di height_cm/sex): `gym_bar_kg numeric` + `gym_plates jsonb` (`[{kg, n}]`, n = dischi totali del taglio; il calcolatore usa floor(n/2) per lato). I dischi sono una proprietà della PALESTRA, non del telefono: si configurano dal desktop, si usano sotto al bilanciere dal telefono — e la domanda aperta 99k sullo stamp per-dispositivo ammonisce esattamente contro il localStorage per dati veri. | **SÌ — column-only, 0033** |
| **"Il tuo mese"** (P3c, WOW-03) | Derivato al 100% dai selettori per-range esistenti (sessioni, volume, PR, abitudini, focus, task, peso, dieta). | NO |
| **Correlazioni native** (P3a, PROP-stats-03) | Derivate; SOLO dati che il modello corrente persiste (legge di dominio del brief). | NO |
| **PR al set** (P2b, PROP-gym-04/WOW-02) | Derivato: la storia dell'esercizio è già in mano al micro-editor (prefill run-07/10). | NO |
| **Command palette** (P4, WOW-07) | Navigazione + azioni esistenti con undo; niente "recenti" persistiti (non nel brief → eventuale PROP futura). | NO |
| **Layout desktop** (P5) | Solo CSS/layout. | NO |

### Il percorso scelto: column-only su lo_settings, ZERO bump Dexie

- **`supabase/migrations/0033_gym_equipment_profile.sql`** (SCRITTA, MAI applicata, idempotente, dopo 0032): due `add column if not exists` su `lo_settings` (`gym_bar_kg numeric` con check 1..100, `gym_plates jsonb` nudo — il contratto del contenuto è dello zod client, pattern protected_days), commenti di colonna, `notify pgrst`. **Niente ridichiarazione `lo_push`** (0029 resta finale a 28 tabelle — stessa motivazione documentata in 0032: SET dinamico da information_schema + `jsonb_populate_recordset` ignora le chiavi non-colonna, finestra deploy→apply sicura).
- **DELTA dichiarato (Dexie): NESSUN v13.** Il cerimoniale del brief prevede "column-only = 0033 + Dexie v13 + survival test", ma per Settings vale il **precedente v7 documentato in `data/db.ts`**: "i campi profilo nuovi di Settings NON richiedono migrazione (il repo fonde i default alla lettura, lo schema li materializza al parse — pattern di protected_days)". `LocalSettingsRepo.get()` fa `{...DEFAULT_SETTINGS, ...row}` (righe vecchie tornano complete), il sync parse con `.default(null)` (righe vecchie pushano/pullano complete), `update()` riscrive la riga intera. Un upgrade v13 di solo-backfill sarebbe cerimonia morta per QUESTA tabella. La garanzia zero-perdita è provata comunque: **test di sopravvivenza nel repo** (riga scritta in forma pre-run-12 → get() completa coi null, update dei campi nuovi preserva ogni campo esistente). "At most one bump" del brief = zero bump usati.
- **Zod** (`data/schemas.ts`): `GymPlateSchema {kg: positive ≤100, n: int 1..40}` esportato (il P2 lo consuma); `GymPlatesSchema` array ≤24 con refine tagli-unici (i duplicati si RIFIUTANO invece di fonderli: fondere sommando n potrebbe sfondare il dominio validato); `SettingsSchema.gym_bar_kg` 1..100 nullable `.default(null)`, `gym_plates` nullable `.default(null)` + stessi campi in `SettingsPatchSchema`.
- **Repo** (`data/local/settings.ts`): `DEFAULT_SETTINGS` completa coi due null; `update()` patcha i campi nuovi e **ordina i dischi per kg decrescente alla scrittura** (il pattern protected_days: chi legge non deve difendersi); `gym_plates: null` azzera il profilo.
- **Niente entità nuove, niente id derivati** → zero prefissi, zero golden nuovi (legge rispettata per assenza di caso).

### Delta vs PROP dichiarato

PROP-gym-03 diceva "profilo per-dispositivo, localStorage come il chime"; il brief P1 lo colloca invece sulla riga profilo sincronizzata ("natural home"). Il brief vince su scope e invarianti (regola dichiarata in testa al brief) — e il prodotto ci guadagna: profilo configurato una volta, disponibile su ogni device, guest-first comunque (la riga settings vive in Dexie anche da ospiti).

### Fence

`data/schemas.ts` · `data/local/settings.ts` · `supabase/migrations/0033_*` · `data/schemas.test.ts` · `data/local/settings.test.ts`. Nessun altro file toccato; `data/db.ts` NON toccato (nessun bump — v12 resta l'ultima versione).

**Commit:** `run-12/P1: schema decision (+0033)`

---

## P2 · Palestra pro — la scheda che allena

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1015/1015, 80 file** (+12: 8 plate-math, 4 pr). **Smoke produzione (kill per PID):** `/gym` **200**; nel chunk della route: "Per lato" ✓ "Imposta bilanciere" ✓ "Attrezzatura salvata" ✓ "record personale" ✓ "Più vicino" ✓.

### a · Plate calculator (PROP-gym-03/WOW-01)

- **`plate-math.ts` (+8 test), matematica pura in GRAMMI INTERI** (la lezione spese-cents/dieta: una conversione al bordo, mai float a metà conto). NON il greedy nudo del titolo della PROP: un greedy sui tagli decrescenti sbaglia i profili non-canonici (30/lato con {20×1cp, 15×2cp}: prende il 20 e muore, mentre 15+15 è esatto — caso a verbale nei test). Si enumerano le somme per-lato RAGGIUNGIBILI (subset-sum limitato dalle coppie: floor(n/2) per taglio) con un testimone per somma; tagli processati in ordine decrescente → la prima rappresentazione è quella coi dischi grossi, lo spirito del greedy senza i falsi negativi. **Irraggiungibile → il totale più vicino** (anche sopra il target; pari distanza → il più leggero), mai un vicolo cieco. Coi cap zod (≤24 tagli, n≤40) l'enumerazione è banale. **Delta dichiarato** ("greedy" del brief onorato nello spirito, corretto nella lettera — il brief stesso chiede l'edge "unreachable → nearest").
- **Entry point come da brief**: nel micro-editor del set, nel blocco "Ultima volta" — riga quieta viva sul peso corrente ("Per lato: 2×20 + 2,5" · "Per lato: solo bilanciere" · "Più vicino: 77,5 kg (…)"); il tap apre l'editor del profilo. **Senza profilo: solo il link quieto** "Dischi per lato? Imposta bilanciere e dischi". Righe a corpo libero: niente, per costruzione.
- **Il touchpoint del profilo (decisione P1→P2): DENTRO il micro-editor**, `equipment-editor.tsx` come SWAP di contenuto dello sheet (mai sheet-sopra-sheet: gli stati della serie sopravvivono alla deviazione, "Indietro" torna alla serie). Stepper bilanciere (±2,5, 2,5..100, default 20), righe dischi con conteggio TOTALE posseduto (− sotto 1 = rimozione), chip d'aggiunta per i tagli comuni (25…0,5, n=2 al primo tap). "Salva" → `settings.update` con toast **"Attrezzatura salvata · Annulla"** (ripristina i due campi precedenti).

### b · Il momento PR (PROP-gym-04/WOW-02)

- **`pr.ts` (+4 test)**: `weightPrCheck` (il carico batte STRETTAMENTE il massimo storico; serve un passato — la prima volta non è record; corpo-libero fuori — la semantica di `newRecords` run-07) e `weightPrSetIds` (gli id dei set che ERANO record quando furono fatti: done_at, null legacy in testa, tiebreak id UUIDv7 — deterministico su input mescolato).
- **Al log** (`confirmSet`): toast ember `PR: 82,5 kg su Panca · prima 80` + la cella confermata porta **em-dot--live (il pulse di casa) + chip "PR"** e l'aria-label dice "record personale". Stato effimero della sessione (il "momento"); la storia INCLUDE i set precedenti di oggi (il massimo corrente vale sempre). Il check usa la storia MENO il set in modifica; limite storia dell'editor 25→**500** (al massimo storico servono TUTTI i set, non gli ultimi 25 — anchored edit dichiarato).
- **Nella griglia storica** (scheda-view): marcatore PERMANENTE "PR" ember sulle celle di `weightPrSetIds` — la storia resta visibile nello storico, come chiede il brief.

### c · Set semantics → PROP-note

PROP-gym-05 (warmup/failure) non è specificata a fondo dalla PROP (Effort M · Valore L · `[schema]` · "solo se lo chiede"): **niente implementazione**, resta PROP aperta per il triage. Zero schema speso.

### L'incidente di budget che vale il report (la regola cardinale difesa coi numeri)

Prima stesura: `weightPrCheck`/`weightPrSetIds` dentro `gym/logic.ts` → **Oggi 60.114 B (+385, TETTO SFONDATO)**. Diagnosi A/B (stash + build fresca): P1 è byte-identico (59.729, HASH identico `21696031733f0d65`); il leak era P2 — `today-gym.tsx` e `today-tiles.tsx` importano `gym/logic` (formatKg) e **webpack non tree-shaka gli export tra moduli** (la lezione run-11 P2, ri-misurata). Rimedio: le due funzioni PR in un **modulo separato `pr.ts`** importato solo da session-grid/scheda-view. Esito: **Oggi 59.729, hash byte-identico** ✓. Nota di processo: un primo A/B "al commit P0" era inquinato dai file P2 non tracciati rimasti nel tree (build fallita, chunk stantio) — gli A/B onesti si fanno con `git stash -u`.

### Budget

- **Oggi: 59.729 B raw — BYTE-IDENTICO (stesso hash chunk). Congelamento rispettato.**
- **/gym: 96.527 → 103.268 B raw (23.927 → 25.722 gz)** = +6.741 raw: calcolatore+editor attrezzatura+PR (nessun budget formale, registrato).

### Fence

`gym/plate-math.ts`(+test) · `gym/pr.ts`(+test) · `gym/equipment-editor.tsx` (nuovi) · `gym/session-grid.tsx` · `gym/scheda-view.tsx` (anchored). `gym/logic.ts` toccato e RIPRISTINATO byte-identico (il trasloco in pr.ts).

**Commit:** `run-12/P2: palestra pro`

---

## P3 · I numeri — stats elevation + "Il tuo mese"

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1031/1031, 83 file** (+16: 9 correlazioni, 3 recap-logic, 3 selettori stats, 1 consumedByDay). **Smoke produzione:** `/stats` **200**, `/` **200**; nel chunk stats: "Il tuo mese" ✓ "I moduli si parlano" ✓ "Aderenza della settimana" ✓ "vs settimana scorsa" ✓ "Ancora pochi dati" ✓.

### I selettori read-only (la fence li sancisce)

- **StatsRepo** (+3, `data/local/stats.ts`, composti sulle tabelle come da convenzione del file): `habitCompletionByDay(from,to,tz)` (previste = nate entro il giorno, non ancora archiviate allora, nello schedule; completate = semantica di activityDays; **semplificazione dichiarata**: il target acqua usa il peso più recente, non quello storico) · `trainedDays` (giorni con sessione CONCLUSA) · `gymPrCountInRange` (il **gemello dichiarato** di `gym/pr.ts` ricalcolato sulle tabelle — il precedente è `gymVolumeInRange` che duplica il volume di logic.ts; cronologia per esercizio: giorno sessione → done_at → id).
- **DietRepo** (+1): `consumedByDay(from,to)` = il loop di `dayDiet`+`dayExtras` — le STESSE regole di composizione, zero drift; solo giorni con un pasto mangiato o un extra.
- **Hooks** (+4 wrapper): `useHabitCompletionByDay` · `useTrainedDays` · `useGymPrCount` · `useDietConsumedByDay`.

### a · Correlazioni native (PROP-stats-03/CROSS-06 + il candidato dieta×peso del brief)

`correlations.ts` (pure, +9 test): **confronti di MEDIE tra due gruppi di giorni** — mai p-value theater. Finestra: 60 giorni CONCLUSI (oggi escluso — un giorno a metà falserebbe le medie). Soglia onesta MIN_BUCKET=5 per gruppo (3 settimane per la carta settimanale); sotto → la carta dice "Ancora pochi dati: servono…", col requisito esplicito. Le quattro carte (`correlations-panel.tsx`, frame "I moduli si parlano"):
1. **Allenamento × Abitudini** — % completamento nei giorni allenati vs no ("Nei giorni di allenamento completi il 18% di abitudini in più — su 42 giorni"); sotto 1 punto: frase onesta di parità.
2. **Focus × Task** — media task chiusi nei giorni con ≥1 focus vs senza (i giorni a zero task contano come zero: trascinano le medie, onestamente).
3. **Energia di Sera × Task** — serate 4–5 vs resto, unità "serate".
4. **Dieta × Peso** — per SETTIMANE ISO qualificate (≥4 giorni loggati e ≥2 pesate): delta peso medio nelle settimane aderenti (±10% kcal per ≥70% dei giorni) vs le altre. Target = quello CORRENTE dal profilo (dichiarato: lo storico non si ricostruisce).
Il legacy /insights resta CONGELATO: zero file toccati lì.

### b · DeltaChip + la dieta visibile

- **PROP-stats-01**: la prop `delta` di StatCard (il DeltaChip che "nessuno usava") è finalmente cablata — due StatCard nuove nella griglia alta di /stats: **"Task · settimana"** e **"Volume · settimana"** con chip `+13%`/`-25%` vs settimana scorsa (`deltaPct` pura: NIENTE chip quando il confronto è a zero — mai divisioni inventate). **Delta dichiarato:** niente export di `DeltaChip` dal barrel ui/ — la prima stesura lo esportava, poi REVERT: stat-card.tsx vive nel grafo della home e un export nuovo = byte sul chunk congelato; la prop di StatCard è l'API che la PROP stessa indica ("StatCard … con DeltaChip"). ui/ resta INTOCCATO.
- **PROP-stats-02** (`diet-panel.tsx`, frame "Dieta"): giorni nel **±10% kcal** sui loggati della settimana corrente · **hit-rate proteine** (giorni ≥ target) · **trend peso 30 giorni** accanto (prima→ultima pesata). Target dal profilo+ultima pesata — le stesse derivazioni di /dieta e Sera; senza profilo il pannello lo dice invece di inventare.

### c · "Il tuo mese" (WOW-03)

`month-recap.tsx`: sezione in coda a /stats (lg: piena larghezza) — **mese navigabile** (← →, avanti disabilitato sul corrente; `monthShift` = aritmetica pura anno×12+mese, mai Date) con l'etichetta it-IT (`monthLabel`). Sei StatCard: **Palestra** (sessioni · volume · PR del mese, dal selettore nuovo) · **Abitudini** (% e fatte/previste) · **Focus** (formatMin) · **Task** (chiusi su totali) · **Peso** (prima→ultima pesata del mese, con segno; "—" sotto 2 pesate) · **Dieta** (giorni ±10% sui loggati; senza profilo: giorni loggati, dichiarando il perché). Mese vuoto → "Nessun dato in questo mese." Deterministico e guest-first per costruzione (soli selettori locali).

### Il secondo leak sventato (la regola cardinale, di nuovo)

Prima stesura: `monthShift`/`monthLabel`/`deltaPct` dentro `stats/logic.ts` → **Oggi 60.168 (+439)**: `today-tiles.tsx` importa `stats/logic` (weekBounds/fillDays/completionPercent per i tile) e gli export nuovi viaggiano col modulo (stessa meccanica del P2). Rimedio: **`stats/recap-logic.ts`** (modulo separato, docstring che spiega il perché), consumer solo /stats. Esito: **Oggi 59.729, hash byte-identico** ✓. Ora è pattern a verbale: *ogni export nuovo va in un modulo che la home non importa, e la lista dei moduli-home noti include `gym/logic`, `gym/card-history`, `stats/logic`.*

### Budget

- **Oggi: 59.729 B raw, hash `21696031733f0d65` — BYTE-IDENTICO.**
- **/stats: 10.894 → 21.921 B raw (4.180 → 7.517 gz)** = +11.027 raw — l'intera elevazione (pannello dieta, 4 correlazioni, recap mensile, 2 StatCard con delta). Nessun budget formale, registrato.

### Delta dichiarati

1. PROP-corpo-01 (media mobile 7g sul trend di /corpo) è nel Set B di v3 §4 ma NON nominata dal brief run-12 (P0 delta #3) → **fuori run**, resta nel triage.
2. La carta dieta×peso usa il target kcal CORRENTE per le settimane passate (ricostruire i target storici richiederebbe pesate-per-giorno che il modello non garantisce) — dichiarato nel docstring e qui.
3. DeltaChip: niente export ui/ (sopra). Il chip vive dentro StatCard, dove già stava.

### Fence

`data/ports.ts` · `data/local/stats.ts` · `data/local/diet.ts` · `data/hooks.ts` (selettori read-only, sanciti dalla fence) + loro test · `stats/correlations.ts`(+test) · `stats/recap-logic.ts`(+test) · `stats/correlations-panel.tsx` · `stats/diet-panel.tsx` · `stats/month-recap.tsx` (nuovi) · `stats/stats-screen.tsx` · `stats/logic.ts` (netto: byte-identico al committed dopo il trasloco) · `stats/logic.test.ts` (import ripuliti).

**Commit:** `run-12/P3: numeri + il tuo mese`

---

## P4 · La command palette (⌘K / Ctrl+K)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1039/1039, 84 file** (+8: matcher+sorgenti). **Smoke produzione:** `/` **200**; il chunk del corpo è servito **200**; "Apri scheda:"/"Logga acqua"/"Tema scuro"/"Recenti"/"Nuovo task…" vivono SOLO nel chunk lazy; nel layout resta solo l'overlay scorciatoie.

### Il punto di partenza onesto (scoperto, non presunto)

La palette NON andava inventata: `ui/command-palette.tsx` (shell con ARIA combobox/listbox, focus trap, tastiera, Ember) esiste dal B4 e `comfort-host.tsx` la montava già con ⌘K/Ctrl+K (`preventDefault` ✓), nav alle 14 superfici, "Nuovo task…", "Avvia focus", tema e recenti — PROP-WOW-07 lo diceva ("la palette e i repo ci sono; solo cablaggio"). Misura preliminare (la lezione P5 run-11): la shell ui viveva in un chunk COMMONS (`3456-*`), NON nel layout — il layout portava solo le sorgenti di comfort-host. Il P4 quindi è stato: **corpo lazy + ranking + sorgenti nuove**, non una palette nuova.

### Cosa è cambiato

- **Shell nel layout** (`comfort-host.tsx`, riscritto e DIMAGRITO): tiene keydown (⌘K toggle, chords `g`+lettera, `n`, `?`), overlay scorciatoie, boot tema, stato `paletteOpen`. Il corpo si carica con **`React.lazy` alla prima apertura** — e NON `next/dynamic`, di proposito: un secondo consumer di next/dynamic nel gruppo (app) faceva nascere lo shim di interop DENTRO il chunk congelato della home (+78 B, diagnosi al diff dei moduli webpack: 37→38, il modulo era il facade `n.n()` di next/dynamic). Con React.lazy: **Oggi 59.729 B, 37 moduli, set IDENTICO alla baseline** (hash diverso per soli id commons rinumerati — misurato). Il corpo rende solo su gesto client: l'SSR non lo incontra mai, `Suspense fallback null`.
- **`palette/matcher.ts`** (puro, +4 test): subsequence CON punteggio — inizio-parola +2, sequenze consecutive crescenti, penalità dolce per bersagli lunghi; null = escluso. `rankOf` su "label + keywords".
- **`palette/sources.ts`** (puro, +4 test): le 14 nav (traslocate da comfort-host, descrittori senza closure) e **`gymCardSources`**: i giorni del programma attivo → "Apri scheda: Torso A" con deep-link `gymCardHref` — "tor…" trova la scheda DAVANTI alle superfici (test di ranking dedicato).
- **`palette/palette-body.tsx`** (il chunk lazy): monta la shell ui con la prop `rank` nuova; sorgenti = nav + schede (via `useActiveProgram`+`useProgramDays`) + azioni + tema + recenti per-dispositivo (traslocati). **"Logga acqua"**: lo STESSO gesto della strip di Oggi — `incrementDay` col passo one-thumb (`defaultQuickStep`, 330 ml per l'acqua) e toast **"Acqua: +330 ml · Annulla"** che ripristina il totale di prima; la voce compare solo se l'abitudine acqua esiste e non è archiviata. Regola di sicurezza del brief rispettata: solo navigazione e azioni che GIÀ portano undo (nuovo task = apre il quick-add, mutazione zero; tema = reversibile per natura; avvia focus = azione palette preesistente dal run-05, dichiarata).
- **`ui/command-palette.tsx` — FLAGGED (modifica additiva a una primitive esistente, non una primitive nuova)**: prop opzionale `rank?: (query, item) => number | null` — presente: filtra i null e ordina per punteggio (stabile sui pari); assente: il filtro booleano di prima, byte-per-byte lo stesso comportamento (lo showcase /dev non cambia). La shell vive nei COMMONS (misurato: +125 B su `3456-*`, fuori dal metodo di misura run-08 dei route chunk).

### Delta dichiarati

1. **Nessun "button affordance"**: PROP-WOW-07 non ne colloca uno e il brief lo condiziona a "where the PROP puts one" — la palette resta keyboard-first; l'overlay `?` la documenta. (Con essa: niente entry point touch questo run → **PROP-nota**, come da brief.)
2. Su touch la palette "non monta" PER COSTRUZIONE: il corpo nasce solo da ⌘K/Ctrl+K — non esiste altro trigger; il listener nel layout è il medesimo di prima (run-05).
3. "Nuovo task via the NL parser": il gesto resta l'apertura del quick-add PERSISTENTE (che il parser NL ce l'ha dentro, chips comprese) — la palette non duplica il parser; è il cablaggio che esisteva, dichiarato.

### Budget (le tre misure del brief)

| Chunk | Prima | Dopo | Δ |
| --- | --- | --- | --- |
| **Oggi** | 59.729 | **59.729** (37 moduli, set identico) | **0** ✓ |
| **Layout (app)** | 38.370 | **30.434** (9.434 gz) | **−7.936** (budget ≤ +2.500: sotto di 10,4 kB) |
| **Corpo palette (lazy, nuovo)** | — | **15.274 raw / 6.099 gz** (`7418.*.js`) | registrato |
| Commons `3456-*` (shell ui) | 46.611 | 46.736 | +125 (prop rank; fuori misura route) |

### Fence

`_components/palette/**` (nuovi: matcher, sources, palette-body + test) · `_components/comfort-host.tsx` (riscritto shell) · `ui/command-palette.tsx` (prop `rank`, FLAGGED). Montaggio nel layout: INVARIATO (`<ComfortHost />` com'era).

**Commit:** `run-12/P4: command palette`

---

## P5 · I layout desktop rimandati (un commit per sub-item)

**Checkpoint (a fine P5): VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1039/1039, 84 file** (nessuna logica pura nuova: layout e composizione di derivazioni già golden). **Smoke produzione:** `/dieta` **200** · `/calendar` **200**; "Piano della settimana" e "Restano " nel chunk di /dieta.

### a · Dieta — griglia settimanale a lg+ (PROP-diet-05)

**Fence dichiarata:** `dieta/piano-tab.tsx` · `dieta/dieta-screen.tsx`.

- **`WeekGrid`** nel builder: da lg i 7 giorni AFFIANCATI (colonne L→D) — per colonna: conteggio pasti, celle pasto compatte (nome + kcal base vive, tap = la stessa scheda pasto di sempre), somma kcal del giorno in coda (la ricorsione-di-hook di casa, resa compatta), "+" per aggiungere un pasto DI QUEL giorno. Il flusso mobile (chips giorno + lista + "Pasto di lunedì" + copia-giorno) è INTATTO dentro un wrapper `lg:hidden`; la griglia è `hidden lg:grid`. `addMeal` ora prende il giorno come parametro (la griglia aggiunge in qualunque colonna).
- **`data-page-width="wide"` CONDIZIONALE sul tab Piano** (`dieta-screen.tsx`): il meccanismo run-10 è un `:has()` sul main — l'attributo si accende solo quando la larghezza viene SPESA (la griglia); Oggi e Alimenti restano alla misura di lettura. È la lettura fedele di "width and layout together"; delta dichiarato rispetto alla lettera "the surface flips" (superficie intera).
- **Delta dichiarato:** il controllo "Copia giorno su…" resta nel flusso mobile (nella griglia, 7 controlli ripetuti sarebbero rumore; su desktop la copia si fa restringendo o dal telefono) — asimmetria annotata per il triage.

*Commit `6b9a32f` — `run-12/P5: dieta weekly grid (PROP-diet-05)`. /dieta: 52.271 → 58.104 B.*

### b · Calendario — due pannelli a lg+ (PROP-cal-02)

**Fence dichiarata:** `calendar/calendar-screen.tsx`.

Da lg la superficie è `grid-cols-2`: **mese + quick-add a sinistra, agenda del giorno a destra** (`lg:row-span-2` — il "peek" dei prodotti craft), import legacy + blocco Google sotto il mese; `data-page-width="wide"` sull'intera superficie (vista unica). Su mobile TRE wrapper flex identici alla pila di prima — ordine e spaziatura invariati; il wrapper import+Google esiste solo per autenticati (niente div vuoto = niente gap fantasma per gli ospiti). Le sheet (evento/task) restano fuori griglia (portali).

*Commit `c2b67cb` — `run-12/P5: calendar two-panel desktop (PROP-cal-02)`. /calendar: 10.425 → 10.618 B.*

### c · Dieta — "ne restano N" nell'header (PROP-diet-01)

**Fence dichiarata:** `dieta/oggi-tab.tsx`.

Sotto le barre dell'header del giorno, la riga che la derivazione conosceva da sempre e /dieta non mostrava: **"Restano 1.120 kcal · 52 g proteine"** — stessa pura (`remainingVsTarget`) e stessi formatter (`formatInt`, `formatGramsFromDg`) della riga di Sera (P4 run-11). Casi onesti: kcal sopra il target → "180 kcal oltre"; proteine raggiunte → "proteine a obiettivo"; senza obiettivi la riga non esiste (resta il suggerimento profilo di sempre).

*Commit: `run-12/P5: dieta remaining line (PROP-diet-01)`. /dieta: 58.104 → 58.503 B.*

### Budget a fine P5

**Oggi: 59.729** ✓ (verificato dopo OGNI sub-item) · /dieta 52.271 → **58.503** (+6.232: griglia + riga) · /calendar 10.425 → **10.618** (+193).

---

## P6 · Polish + a11y delle superfici nuove

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1039/1039, 84 file**. **Smoke produzione (porta chiusa per PID):** le 8 rotte del giro tutte **200** (/, /gym, /stats, /dieta, /calendar, /tasks, /sera, /settimana).

1. **Il passaggio a11y dedicato alla palette** (la superficie più rischiosa del ciclo): i GRUPPI dentro il listbox erano `div` nudi — ora `role="group"` + `aria-label` col nome del gruppo e l'eyebrow `aria-hidden` (i figli di un listbox devono essere option o gruppi etichettati). Verificato il resto del contratto: focus trap sull'input ✓ (`useFocusTrap`), `combobox` + `aria-controls` + `aria-activedescendant` ✓, opzioni con id stabili e `aria-selected` ✓, Esc/frecce/Invio ✓, risultato vuoto = EmptyState onesto ✓. Da tastiera la palette si apre, naviga, committa e chiude senza mouse per costruzione.
2. **Editor attrezzatura**: intestazione propria ("Bilanciere e dischi", eyebrow ember) — lo swap dentro lo sheet non lascia più il solo titolo della serie a raccontare il contesto.
3. **Audit skeleton/empty/undo delle superfici nuove, esito**: micro-editor set → skeleton già in P2 (attesa storia) ✓ · plate line: nascosta finché settings carica (zero flicker) ✓ · equipment "Salva" con Annulla ✓ · palette "Logga acqua" con Annulla ✓ · StatCard di /stats e "Il tuo mese" → skeleton via prop `loading` ✓ · ChartFrame dieta/correlazioni → stati loading/empty/ready col perché ✓ · nav mese ← → con aria-label e disabled sul corrente ✓ · griglia dieta lg → skeleton dedicato + celle-bottone con testo visibile ✓ · calendario due pannelli → nessun elemento nuovo interattivo. Transizioni: ogni elemento nuovo usa i token di casa (`--em-dur-tap`/`--em-dur-control`) — audit a vista sul diff, nessuna fuori scala.
4. **Micro-pulizie**: nessun'altra dentro le fence — il run non ha lasciato TODO.

### La tabella dei chunk (before→after del run, build fresca a fine P6)

| Chunk | Baseline P0 | Finale | Δ | Note |
| --- | --- | --- | --- | --- |
| **Oggi** `page-*` | 59.729 (18.689 gz) | **59.729 raw (18.687 gz)** | **0 raw** | **CONGELAMENTO PROVATO**: raw identico; 37 moduli, stesso set della baseline (hash diverso = soli id commons rinumerati, diagnosi a verbale P4). |
| **Layout (app)** | 38.370 (11.989 gz) | **30.436 (9.433 gz)** | **−7.934** | Budget ≤ +2.500: rispettato con 10,4 kB di margine — le sorgenti palette sono uscite dal layout. |
| Corpo palette (lazy) | — | **15.275 (6.098 gz)** | nuovo | Chunk dedicato, caricato alla prima ⌘K. |
| /gym | 96.527 (23.927 gz) | **103.393 (25.736 gz)** | +6.866 | Plate calculator + editor attrezzatura + momento PR. |
| /stats | 10.894 (4.180 gz) | **25.096 (8.683 gz)** | +14.202 | L'elevazione P3 (+11.027 misurati al P3) + ~3,2 kB di rimescolo commons post-P4 (moduli ui prima condivisi via layout, ora addebitati alla route — annotato per onestà). |
| /dieta | 52.271 (11.503 gz) | **58.503 (13.223 gz)** | +6.232 | Griglia settimanale + riga "Restano". |
| /calendar | 10.425 (4.270 gz) | **10.618 (4.322 gz)** | +193 | Due pannelli (solo classi + wrapper). |

**Commit:** `run-12/P6: polish + a11y`
