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

**Commit:** `feat(gym-v2): program domain modeled on the real sheet (sections, variants, textual RIR, per-set feeling)`

---
