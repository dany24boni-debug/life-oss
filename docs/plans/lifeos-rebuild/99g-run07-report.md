# Run 07 (v2) — Gym Programs sul foglio reale + Corpo/Profilo

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-07` (off `main` @ `2ab9f58`). Mai pushato, mai mergiato.
**Brief:** run-07 v2 (sostituisce il precedente). Programmi → builder → griglia log + progressi → corpo/profilo.

Questo report è fence-exempt e viene appeso a ogni checkpoint.

---

## Pre-flight gate

**1. Clean tree + run-06 in HEAD.**
- `git status` su `main` → pulito. ✓
- `git ls-files` conferma i sentinel run-06 alla RADICE: `public/sw.js` ✓, `.github/workflows/ci.yml` ✓, `data/sync/engine.ts` ✓.
- Non STOP: run-06 è in HEAD (`2ab9f589b5826dd1fd0530a348f47187d102ca32`, merge di `feat/run-06`).

**2. Branch + HEAD registrati.**
- HEAD di partenza: `2ab9f589b5826dd1fd0530a348f47187d102ca32`.
- Creato `feat/run-07` e switchato.

**3. Baseline verde (dalla radice).**
- `npm run lint` → pulito ✓ · `npm run typecheck` → pulito ✓ · `npm run lint:sentinels` → pulito ✓
- `npm test` → **Test Files 54 passed (54) · Tests 648 passed (648)** ✓ — combacia con l'atteso (~648).

**4. Migrazioni.**
- Esistenti: 0001 → 0023 (col doppio 0016 noto). Prossimo numero libero: **0024** (poi 0025 per il prompt 4). ✓

**5. Letture pre-prompt (fatte per intero prima di scrivere).**
- `99e-run05-report.md`, `99f-run06-report.md`.
- Codice reale: `data/schemas.ts`, `data/ports.ts`, `data/db.ts`, `data/local/gym.ts`, `data/local/sera.ts` (pattern id-derivato), `data/local/settings.ts`, `data/local/util.ts`, `data/gym-seed.ts` (+test), `data/ids.ts`, `data/hooks.ts`, `data/sync/{tables,apply,export,signal,fake-remote}.ts`, `data/sync/engine-modules.test.ts`, `data/db.migration.test.ts`, `lib/fitness.ts`, migrazioni 0019 e 0023 (convenzioni + pattern `lo_push`), e il gym v1 completo: `app/(app)/gym/{page,gym-screen,session-runner,plan-editor,exercise-picker,logic}.tsx/ts` + test, `app/(app)/_components/today-gym.tsx`.

**Delta osservato vs brief (adattamento alla realtà, da subito):** `GymSet.weight_kg` è GIÀ nullable nel v1 (`data/schemas.ts` "Peso in kg; null = corpo libero") e la colonna `lo_gym_sets.weight_kg` di 0019 è già `numeric` nullable; anche i calcolatori (`app/(app)/gym/logic.ts`) già saltano i pesi null. Il punto del brief "weight becomes nullable" si traduce quindi in: VERIFICA + test aggiuntivi anti-NaN, nessun cambio di schema per quel campo.

Pre-flight PASS.

---

## Prompt 1 — Dominio Programmi + dati (il modello del foglio)

**Checkpoint: VERDE.** lint ✓ (una `no-unused-vars` corretta al volo) · `tsc --noEmit` ✓ · build ✓ · sentinels ✓ · test **679/679, 55 file** (baseline 648/54: **+31** — 12 `data/gym-programs.test.ts` nuovo file, +8 `data/local/gym.test.ts`, +5 `data/schemas.test.ts`, +3 `data/sync/engine-modules.test.ts`, +2 `data/db.migration.test.ts` (netto: 1 nuovo survival + casi aggiornati), +2 `app/(app)/gym/logic.test.ts` no-NaN, +1 `data/sync/export.test.ts`).

### Modello (evoluzione del v1, niente mondo parallelo)

- **`GymProgram`** (id, name, notes, `is_active` — al più uno, invariante del REPO), **`GymProgramDay`** (program_id, name "Torso A", subtitle, weekday 1-7 opzionale, sort_order), **`GymProgramSlot`** (day_id, exercise_id della libreria esistente, `section` testo libero ≤40, `variant` ≤80, `target_sets` 1-10, **`target_reps` TESTO** "3–5", **`target_rir` TESTO** — accetta "1", "1–2", "2/1/0" (testato), `rest_seconds`, **`bodyweight` boolean**, notes ≤280, sort_order). Tabelle Dexie: `gym_programs`, `gym_program_days`, `gym_program_slots` (famiglia `gym_*`, specchi `lo_gym_program*`).
- **`GymSession` guadagna** `program_day_id` e `rating_1_10` (voto 1-10); **`GymSet` guadagna** `rir_done` 0-5, `rest_actual_s` 0-3600, `feeling_1_10` 1-10. Sugli schemi ENTITÀ i campi nuovi hanno `.default(null)` (una riga di forma pre-run-07 — backup JSON vecchio, push di un client non aggiornato — passa il parse materializzando null, MAI scartata: testato in schemas.test.ts e con un pull reale in engine-modules); sugli editable di Create/Patch sono `.nullable()` semplici (un patch non azzera mai campi non toccati).
- **Delta vs brief (già in pre-flight):** `weight_kg` era GIÀ nullable (schema v1 + colonna 0019) — nessun cambio schema; aggiunti i test anti-NaN mancanti (sessione tutta corpo-libero → volume 0, PR peso/1RM null, `newRecords` senza NaN).

### Repo, Dexie, sync

- `GymRepo` esteso: CRUD programmi/giorni/slot + `restore*` (undo), `reorder*` (sort_order = indice), `duplicateProgram` (profonda) / `duplicateProgramDay` (+slot, in coda) / `duplicateProgramSlot` (subito sotto: sort_order +0,5, normalizzato al reorder), `activeProgram()` (tollera più attivi post-merge sync: vince updated_at più recente), `startSessionFromDay(dayId, date, startedAt?)`, `nextUpDay()` (rotazione last-done, pura in `nextDayInRotation`). Cascade: eliminare programma/giorno tombstona i figli con lo **stesso `deleted_at`** — il restore revive SOLO le righe di quel cascade (uno slot eliminato prima, singolarmente, resta eliminato: testato). `purgeTombstones` copre le tre tabelle nuove. Interpretazione documentata di "startSessionFromDay materializing planned rows per slot": crea la SESSIONE legata al giorno; le righe pianificate della griglia nascono dagli slot al render — nessun set fantasma pre-creato, altrimenti l'aderenza "fatte/previste" del prompt 3 nascerebbe già al 100%.
- **Dexie v6** (additiva): tre tabelle nuove + indice `program_day_id` su gym_sessions + **backfill a null** dei campi nuovi sulle righe esistenti (upgrade sincrono, transazione-safe). **Survival test** v5→v6: sessione+set scritti a v5 sopravvivono byte-per-byte + campi nuovi a null; tabelle e indice nuovi subito usabili.
- **Conversione piani v1 → programma** (`convertPlansToPrograms`, `data/gym-programs.ts`): vive FUORI dall'upgrade Dexie (deriva id con crypto.subtle: una promise nativa dentro la transazione d'upgrade la farebbe committare troppo presto — documentato nel codice). UN programma "I miei piani" con id COSTANTE derivato (`lifeos:gym-program:v1-plans`) e **un giorno per piano** (id derivato dal plan id, timestamp del piano) — così due dispositivi che convertono indipendentemente producono righe IDENTICHE e il sync le fonde (testato byte-per-byte su due db). Target portati: reps int → testo ("8"), target_sets clampato 1..10 (v1 arrivava a 20; testato il clamp), note portate. Idempotente, non risuscita il contenitore eliminato, attiva il programma solo se nessun altro è attivo. I piani v1 restano INTATTI (le sessioni storiche li referenziano; la UI Piani sparirà col prompt 2). Il cablaggio al mount di /gym è del prompt 2 (P1 = zero UI).
- **Sync**: 3 voci nuove nel registro (`lo_gym_programs/…days/…slots`), FakeRemote round-trip per tabella nuova E alterata (programma+giorno+slot identici su B; LWW sulla prescrizione; cascade di tombstone che viaggia; sessione con voto+giorno e set con RIR/recupero/feeling; **pull di una riga pre-run-07 senza chiavi nuove → default, mai scartata**).
- **Export/import JSON — fix di compatibilità (delta dichiarato, `data/**` in fence):** `ExportEnvelopeSchema` richiedeva TUTTE le chiavi tabella: un backup run-06 (11 tabelle) sarebbe stato RIFIUTATO dall'app run-07 (14) — regressione latente che esisteva già tra run-04→05, mai osservata. Ora ogni tabella ha `.default([])`: chiave assente = tabella vuota (testato con un envelope senza le tabelle programmi). ZERO DATA LOSS onorato anche sui backup.
- Hook nuovi: `usePrograms`, `useActiveProgram`, `useProgramDays`, `useProgramSlots`, `useProgramDay`, `useNextUpDay`. Il decoratore del segnale mutazioni copre i metodi nuovi via Proxy (nessun cablaggio necessario).

### Seed `TORSO_A_SEED` (il giorno reale del foglio)

In `data/gym-programs.ts`, pattern gym-seed: **UUID FISSI** col prefisso riservato `01970000-90ab-…` (distinto dal `…90aa…` del catalogo; `seedExerciseId` ora esportato da gym-seed), timestamp `SEED_INSTANT`, semina insert-only-missing che non risuscita (testato). 7 slot = la trascrizione della fixture (sezioni FORZA×3/IPERTROFIA×3/CORE, reps "3–5"…, RIR discendente "2/1/0" sulle Laterali, recuperi 270/240/210/150/75/60/75, Ab Wheel `bodyweight: true`), mappata sul catalogo seminato: Panca piana con bilanciere (variant null — il nome la porta già), Trazioni alla sbarra + "Zavorrate, presa larga", Military press + "Rack, seduta", Dip alle parallele + "Zavorrati", Croci ai cavi + "Con panca", Alzate laterali + "Macchina", Ab wheel + "Ginocchia". **Golden test** sugli id pinnati (`…90ab…0001/0002/0010`) + guardia che ogni slot referenzi un id del catalogo. `seedTorsoA` assicura prima il catalogo esercizi, attiva "La mia scheda" solo se nessun programma è attivo, ritorna 0 al secondo tap ("già presente" per la UI del prompt 2).

### Migrazione 0024 — SCRITTA, NON applicata

`supabase/migrations/0024_lo_gym_programs.sql`, convenzioni 0019 al millimetro: 3 tabelle (colonne 1:1 con gli schemi, PK `(user_id,id)`, doppio timestamp, check sui domini), `ALTER TABLE … ADD COLUMN IF NOT EXISTS` su `lo_gym_sessions` (program_day_id, rating_1_10) e `lo_gym_sets` (rir_done, rest_actual_s, feeling_1_10) coi check inline, blocco per-tabella (indice pull + trigger `lo_touch_server_updated_at` + RLS + grant/revoke), e **`lo_push` RIDICHIARATA con l'allowlist completa a 14** (le 11 di 0023 + le 3 nuove). Niente FK tra tabelle entità e niente vincolo "un solo attivo" server-side (farebbe fallire i push nei merge; la lettura sceglie per updated_at — commentato nel file).

### Fence audit (grep: zero UI)

`git diff --stat -- app/ ui/ components/ lib/` → SOLO `app/(app)/gym/importer.ts` (+7) e `app/(app)/gym/logic.test.ts` (+38, test = in fence). **Delta dichiarato — `importer.ts`**: i tre literal `GymSession`/`GymSet` dell'import legacy devono compilare col tipo evoluto; le 7 righe aggiunte sono TUTTE campi a null:
```
+      program_day_id: null,     (×2, sessioni)
+      rating_1_10: null,        (×2)
+          rir_done: null,       (set)
+          rest_actual_s: null,
+          feeling_1_10: null,
```
Nessun cambiamento di comportamento runtime (gli id derivati e i golden test dell'importer sono INTATTI e verdi — la regola "golden prima di toccare codice a id derivati" è rispettata: `deriveUuidV8`/`deriveId` mai toccati). Nessun'altra superficie: `ui/`, `components/`, pagine — zero diff.

### Acceptance del prompt

- Quattro check verdi ✓ (più sentinels).
- Migrazione presente, NON applicata ✓ (file only; nessun Management API).
- Test conversione piano→programma ✓ (carry + clamp + determinismo two-device + idempotenza).
- Test matematica a peso nullo ✓ (no-NaN su volume/PR/record).
- Grep "no UI change yet" ✓ (sopra).

**Commit:** `feat(gym-v2): program domain modeled on the real sheet (sections, variants, textual RIR, per-set feeling)` → `fadbb5a`

---

## Prompt 2 — Builder di programmi (authoring UX)

**Checkpoint: VERDE.** lint ✓ (un `react-hooks/immutability` intermedio — indice di riga mutato nel render — corretto con una Map precalcolata) · tsc ✓ · build ✓ · sentinels ✓ · test **686/686, 56 file** (+7: `app/(app)/gym/program-parse.test.ts`). **Dev-server DA OSPITE:** `/gym` **200**; tab "Programmi" nell'HTML servito; copy dello starter ("Importa esempio…") verificata nel chunk JS servito della pagina (il pannello monta al tap del tab, per costruzione dei Tabs); **zero controlli nativi** nell'HTML (`<select`, checkbox/date/time/number: 0 occorrenze).

### Struttura (tutto dentro `app/(app)/gym/**` — fence rispettata alla lettera)

- **`programs-panel.tsx`** — il tab "Programmi" (sostituisce "Piani"): navigazione drill-down lista → programma → giorno (niente modali per superfici grandi). Lista: nome + conteggio giorni + chip "attiva"; azioni **Attiva** (updateProgram is_active — il repo spegne gli altri), apertura editor; in coda "+ Nuovo programma" (crea "Nuova scheda" e apre subito l'editor) e **"Importa esempio: Torso A"**. EmptyState onesto con entrambe le azioni. Editor programma: rinomina inline (commit-on-blur, Invio conferma), **Duplica** (toast "Duplicata: X (copia)"), **Elimina con undo** (toast Annulla → restoreProgram, che revive anche giorni e slot del cascade — P1), e **card-giorno riordinabili**: drag dalla maniglia (pointer-based, transform 60fps) + frecce su/giù come fallback tastiera; card con nome/sottotitolo/conteggio, duplica e elimina con undo; "+ Nuovo giorno" apre subito l'editor del giorno.
- **`day-editor.tsx`** — LA TABELLA. Meta del giorno: nome, sottotitolo, **chips giorno-feriale L-D** (toggle per azzerare; aria-label coi nomi pieni). Righe = slot raggruppati sotto le **intestazioni di sezione derivate dai blocchi consecutivi** (l'ordine totale sort_order resta la verità; mai riordino implicito per sezione — logica pura `sectionGroups`, testata). Desktop (md+): griglia a colonne fisse con overflow-x — grip · **Esercizio** (tap → picker con autocomplete E **creazione inline** «Crea "query"») · **Variante** (testo) · **Serie** (stepper 1..10) · **Reps** (testo, placeholder "3–5") · **RIR** (testo, placeholder "1–2 o 2/1/0") · **Rec** (input "90"/"1'30"/"4'", parse puro; garbage → ripristino silenzioso del valore) · chip **corpo** · azioni (duplica riga · scheda "altro" · elimina con undo). **Invio conferma e scende alla stessa colonna della riga sotto** (data-cell/data-row + focus). Mobile: riga compatta (nome · variante + riepilogo "4×3–5 · RIR 1 · rec 4'30") che si apre in **BottomSheet** con target 44px: cambio esercizio, variante, **sezione a chips FORZA/IPERTROFIA/CORE + "altra…"** (custom, uppercased), serie stepper, reps/RIR testuali, **recupero a chips 60/75/90/120/150/180/210/240/270 + "altro…"** (input col parse), **Switch corpo libero**, note, duplica/elimina. La stessa scheda si apre da desktop (Modal) per sezione e note. Add-riga: "+ aggiungi qui" per sezione (sort_order = ultimo del blocco + 0,5, normalizzato al prossimo reorder), "+ Esercizio" in coda (eredita l'ultima sezione), chips "+ FORZA/IPERTROFIA/CORE" per le sezioni non ancora presenti.
- **`program-parse.ts`** (+7 test) — logica pura del builder: `normalizePrescriptionInput` ("3-5" → "3–5" come sul foglio, trim/collapse, tetto 20), `parseRestInput` ("90", "1'30", "1:30", "4'", "2'15"; clamp 0..900; garbage → null), `formatRestShort` (270→"4'30", 45→'45"'), `sectionGroups` (consecutivi, mai riordino), `slotSummary`.
- **`use-row-drag.ts`** — la meccanica di riordino del task-list (run-03) estratta a hook: parte solo dalla maniglia, transform-only; bersaglio del drop = riga col **punto medio più vicino** (misurati alla partenza) — regge le liste NON uniformi (intestazioni di sezione tra le righe). Usata da card-giorno e righe-slot (desktop e mobile).
- **`exercise-picker.tsx`** — prop `allowCreate`: con query senza match (e non solo), riga «+ Crea "query"» → `createExercise(gruppo "altro")` → onPick immediato. Il flusso Libreria esistente non cambia (prop opt-in).
- **`gym-screen.tsx`** — tab "Piani" → "Programmi"; al mount, dopo la semina del catalogo, **`convertPlansToPrograms`** (idempotente, P1). Stato/modale del vecchio editor piani rimossi.

### Cancellazione grep-gated

`plan-editor.tsx` (PlanEditorSheet) — consumatori PRIMA della rimozione:
```
$ grep -rn "plan-editor\|PlanEditorSheet\|PlansPanel" app lib components data ui
app/(app)/gym/gym-screen.tsx:56:import { PlanEditorSheet } from "./plan-editor";
app/(app)/gym/gym-screen.tsx:184/204/509 (PlansPanel interna + uso)
app/(app)/gym/plan-editor.tsx:24 (definizione)
```
Unico consumatore = gym-screen (dentro il set di modifica) → `git rm` + rimozione della PlansPanel interna. I PIANI (dati) restano: leggibili, convertiti al mount, referenziati dalle sessioni storiche.

### Scelte documentate

1. **StartPanel intatto in questo prompt**: i bottoni "Da piano: X" del tab Allenamento restano finché il prompt 3 non riscrive il flusso di partenza ("Inizia: Torso A" + next-up) — nessuna regressione intermedia; la duplicazione visiva piani-convertiti/bottoni dura un commit.
2. **Chips recupero su mobile, input testuale su desktop**: il brief chiede chips + custom E il flusso-foglio da tastiera; sul desktop l'input parse-ato ("4'") è più veloce dei chip, che restano nella scheda riga (dove vive anche la sezione). Entrambi passano dallo stesso `parseRestInput` testato.
3. **Rinominare una sezione** = cambiarla sulle righe (la sezione è un'etichetta sugli slot, non un'entità): gesto per-riga dalla scheda; un rename-blocco è un raffinamento futuro.

**Commit:** `feat(gym-v2): spreadsheet-fast program builder with sections and Torso A starter` → `c1731de`

---

## Prompt 3 — Griglia di log + progressi (il cuore)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · build ✓ · sentinels ✓ · test **705/705, 58 file** (+19 netti: +21 `progression.test.ts` nuovo, +1 assert `listSessionsByProgramDay` in gym.test.ts, **−2** countdown morti rimossi da logic.test.ts). Tre errori lint intermedi TUTTI meritevoli: `set-state-in-effect` sul chime (riscritto con l'idioma `useSyncExternalStore` del pwa-store), `Date.now()` impuro nel render (spostato nel gesto via `nowInstant()`, la stessa lezione v1), e il compilatore ha scovato un **bug vero di timing**: il prefill "dall'ultima volta" inizializzava lo stato PRIMA che la live query della storia arrivasse — ristrutturato con un loader che monta il form solo a storia caricata.

**Dev-server DA OSPITE:** `/gym` **200** e `/` **200**; zero controlli nativi; nel grafo chunk servito della pagina: "Concludi allenamento" ✓, "Inizia:" ✓, "Conferma serie" ✓, "suggerito dal trascorso" ✓ — la griglia è raggiungibile dalla Torso A seminata (Programmi → Importa → Allenamento → "Inizia: Torso A"); **"Salta il recupero" ASSENTE da ogni chunk** (niente countdown, verificato).

### 1. Flusso sessione — LA GRIGLIA (`session-grid.tsx`)

- **Partenza**: StartPanel riscritto — primario **"Inizia: {next-up}"** (rotazione last-done, P1) col sottotitolo del giorno; chips "oppure: {altri giorni}"; "Sessione libera" ghost; senza programma attivo il fallback v1 "Inizia allenamento". **I bottoni "Da piano:" sono rimossi** (il ponte transitorio del P2 muore qui, come previsto). Oggi (`today-gym.tsx`, fence `_components` ✓): "Inizia: Torso A" a UN tap (startSessionFromDay + push a /gym), sottotitolo del giorno come riga; fallback v1 senza programmi; sessioni in corso/fatte come prima.
- **Griglia**: righe = slot nei GRUPPI di sezione (stesso raggruppamento consecutivo del builder), N celle per target_sets. Cella fantasma = obiettivo nella lingua del foglio ("3–5 @RIR1", RIR discendente risolto PER-INDICE: la terza di "2/1/0" mostra @RIR0 — `ghostLabel` testata); cella confermata = **"62,5 × 9"** (o "× 12" a corpo libero), tap per correggerla. **"+"** in coda a ogni riga (serie extra); "+ Aggiungi esercizio" (picker con creazione inline) crea righe al volo — i set fuori scheda diventano righe proprie, tutto in `buildGridRows` (pura, testata: fatte/fantasma/extra/orfani/pending).
- **Micro-editor** (BottomSheet mobile / Modal desktop): FAST PATH = **peso** stepper ±2,5 (prefill: serie in modifica → cella precedente → ultima volta in storia, ora ATTENDIBILE grazie al loader) — **nascosto a corpo libero** — e **reps** stepper. **"Altro"** collassato, MAI bloccante: **RIR fatto** chips 0-5, **Feeling** chips 1-10, **Recupero reale** prefillato dal trascorso vero (calcolato al tap, salvato di default sulle serie nuove — è un dato misurato, come sul foglio; oltre l'ora = pausa, null) e modificabile ("2'30", parse dedicato 0..3600 testato); a corpo libero qui compare la **zavorra facoltativa** (kg opzionali, come da brief). Conferma → `addSet` con done_at; "Elimina serie" con **undo = ricreazione identica** (il port non ha restoreSet e la fence P3 consente solo query additive sul data layer — documentato).
- **Recupero QUIETO**: chip in testa — **trascorso** dall'ultima serie confermata + target dello slot ("2:10 / 4'30"), sale e basta, **nessun countdown**; salvia quando il target è raggiunto. **Chime opzionale** al raggiungimento: campanella sul chip, impostazione **per-dispositivo** (localStorage `lifeos.gym.chime`, default **OFF**, pattern del tema D5 — nessun campo Settings: fuori fence e semanticamente giusto, l'audio è del device). Il timer countdown v1 è MORTO: `session-runner.tsx` ridotto a editor dello storico (niente RestState/RestTimer/chime), e `restRemainingS`/`formatRestS` cancellate grep-gated da logic.ts (consumatori: solo i propri test, quotato sopra nel run log).
- **Schermata di fine** (gym-screen, FinishBody): **Volume · Durata · Aderenza** ("21/24"; per le libere "N serie" — previste = `plannedSetCount(slots)`, pura, fixture 24 testata), record battuti (invariato), **Voto seduta 1-10 one-tap** (chips → `rating_1_10`, ri-tap per togliere), note commit-on-blur. Il campo "Peso di oggi" arriva col prompt 4, qui.

### 2. Tabella Progressi per esercizio (`progress-table.tsx` + scheda esercizio)

`buildProgressTable` (pura, testata): colonne = ultime 10 sedute (più recenti PRIMA, scroll orizzontale con prima colonna sticky), righe di testata **Volume** · **e1RM** (Brzycki esistente, set migliore, mai riscritto) · **Δ vs precedente** (kg a 0,1: **▲ salvia** / **▼ segnale** / **=** neutro; primo = "—"); righe **Set 1..n** con "peso × reps" + **RIR piccolo** se registrato + **punto ember sui PR di carico** (battere il massimo di TUTTE le sedute precedenti; mai alla prima; eguagliare non basta — testato). Sedute fuori mappa-date escluse; corpo libero → e1RM "—". Montata nella scheda esercizio sotto sparkline e PR ("Le ultime sedute"). La riga **Forza Rel.** arriva col prompt 4 (serve il peso corporeo).

### 3. Verdetto AUMENTA / RESTA (`progression.ts`, puro)

`parseRepsRange` ("3–5"/"3-5"/"12"; testo libero → nessun giudizio), `parseRirFloors` ("1"→[1]; "1–2"→[1], pavimento del range; **"2/1/0"→[2,1,0]** per-indice, l'ultimo copre la coda), `verdictForSlot`: **AUMENTA** solo se tutte le serie previste fatte E ogni serie al TETTO del range E RIR fatto (quando registrato) ≤ pavimento del SUO indice; altrimenti RESTA; senza range/storia nessun verdetto. **Caso della fixture testato**: Laterali 3×15–20 RIR 2/1/0 — reps 20/20/20 con RIR 2/1/0 → AUMENTA; terza serie a RIR 1 (>0) → RESTA. Chip **"AUMENTA +2,5 kg"** (solo "AUMENTA" a corpo libero) mostrato: sulla riga della griglia della seduta SUCCESSIVA (giudica l'ultima seduta COMPLETATA del giorno, mai quella in corso) e nella scheda esercizio ("suggerimento dall'ultima seduta di {giorno}") — microcopy onesta ("sugg." / title "Suggerimento, non un ordine.").

### 4. Oggi + dati

- Oggi: sopra. Le sessioni v1 (senza program_day) rendono ovunque: griglia libera, storico, Oggi (nessun ramo speciale: program_day_id null = riga libera).
- **Data layer (fence "additive queries only" rispettata: diff data/ = +53/−0):** `listSessionsByProgramDay(dayId)` (port + local, usa l'indice v6, testata) e hooks `useSessionsByProgramDay` + `useActiveProgramSlots` (giorni+slot del programma attivo — verdetto nella scheda esercizio).

### Acceptance del prompt

- Quattro check verdi ✓. Logica pura testata ✓ (rotazione P1; aderenza; verdetto col caso "2/1/0"; stati delle celle; matematica Δ; in più: parse prescrizioni, PR dots, recupero suggerito/elapsed).
- Dev-server ospite `/gym` 200 con griglia raggiungibile dalla Torso A seminata ✓ (stringhe della griglia nel grafo chunk, tab+starter già verificati al P2).
- **NESSUN countdown da nessuna parte** ✓ (codice v1 cancellato, chunk serviti puliti).

**Commit:** `feat(gym-v2): set log grid with quiet rest, progress table with e1RM delta, AUMENTA/RESTA verdict`

---
