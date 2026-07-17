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
