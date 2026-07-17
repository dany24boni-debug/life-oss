# Run 11 — La Giornata Guidata (Set A + cross-module core)

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-11` (off `feat/run-10` @ `20e80ed` — vedi delta P0). Mai pushato, mai mergiato.
**Brief:** run-11 — Set A "Giornata guidata" (rituale del mattino, timeline unica, chiusura serale) + i CROSS di §2 che appartengono alla giornata guidata (slot→scheda, dieta×allenamento, brief intelligente, esami su Oggi). Regola cardinale: **il rituale è un invito, mai un cancello** — Oggi continua a funzionare esattamente come oggi per chi ignora ogni nuova affordance.

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## P0 · Pre-flight gate

**1. Clean tree.** `git status --porcelain` → vuoto. ✓

**2. Run-10 in HEAD.** `git ls-files docs/plans/lifeos-rebuild | grep 99j` → `99j-run-10-report.md`. ✓

**DELTA dichiarato subito:** il brief afferma "Run-10 is merged", ma `main` è ferma a `ecc92b7` (merge di run-09): `feat/run-10` (tip `20e80ed`, 12 commit) NON è stata mergiata. Il gate letterale del brief (99j presente in HEAD) passa perché la sessione parte dal tip di `feat/run-10`, che contiene tutto il run-10. **`feat/run-11` è quindi branchata da `feat/run-10@20e80ed`, non da `main`.** Al gate di Davide serviranno due merge in sequenza (`feat/run-10` poi `feat/run-11`) o il solo merge di `feat/run-11` (che contiene run-10 per intero).

**3. Branch.** Creato `feat/run-11` e switchato. ✓

**4. Baseline verde PRIMA di ogni edit (dalla radice, come da AGENTS.md).**
- `npm run lint` → pulito ✓
- `npm run typecheck` → pulito ✓
- `npm run lint:sentinels` → pulito ✓ ("no personal-data sentinels found")
- `npm test` → **Test Files 76 passed (76) · Tests 964 passed (964)** ✓ — combacia con l'atteso del brief (~964/76) e col finale run-10.
- `npm run build` → ✓ (webpack, tutte le route presenti)

**Baseline di dimensione (metodo 99h/99i: chunk client della route).**
- Oggi: `page-56b2db61f075965f.js` = **47.845 B raw (14.891 B gzip)** — al byte l'atteso del brief (47.845). Hard ceiling di fine run: **60.000 B raw**.
- Layout `(app)`: `layout-27f267e27f7fbf5e.js` = 38.370 B (riferimento, non a budget).

**5. Letture (per intero, in ordine):** `AGENTS.md` · `docs/plans/lifeos-rebuild/v3-proposals.md` (477 righe — la spec di questo run) · `99j-run-10-report.md`.

**Delta brief ↔ documenti:** oltre al delta merge qui sopra, nessun conflitto. Set A in v3-proposals §4 = CROSS-03 → CROSS-05 → PROP-sera-01 → PROP-sera-02 `[schema]` → CROSS-04 → PROP-oggi-02 + PROP-oggi-04/CROSS-08; il brief run-11 aggiunge i link P5 (CROSS-01, CROSS-02, brief, esami) e sposta il baricentro schema sui campi di pianificazione task (P1). Dove una PROP è più specifica sul meccanismo, vince la PROP; il brief vince su scope e sequenza.

Pre-flight PASS.

**Commit:** `run-11/P0: preflight + baseline`

---

## P1 · Schema decision (+0032)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **965/965, 76 file** (+1: survival v11→v12).

### L'enumerazione (cosa deve PERSISTERE perché la giornata guidata esista)

| Bisogno | Decisione | Schema? |
| --- | --- | --- |
| **Rollover targeting** (P2a, P4 "Prepara domani") | Derivato + mutazioni esistenti: i candidati sono i task aperti con `date < oggi` (`listOverdue`, già in porta); "→ Oggi" / "→ Più avanti" / "Prepara domani" sono patch di `date` (il pattern `moveAllToToday`/`snooze` di casa, con undo cumulativo). | **NO** |
| **Ordine playlist** (P2c) | `tasks.sort_order` ESISTE dal v1 ("Ordine manuale dentro una giornata"), con `TasksRepo.reorder` + drag/tastiera già cablati in `task-list.tsx`. Il rituale riusa, non inventa. | **NO** |
| **Stima di durata** (P2b/d, PROP-task-05) | Non esiste nulla → **`tasks.estimate_min`**: minuti INTERI (chips 15/30/60/90), `null` = nessuna stima, mai obbligatoria. | **SÌ — colonna nullable** |
| **Stamp "giorno pianificato"** (P2→P5c) | localStorage per-dispositivo (pattern `lifeos.brief.<day>` con potatura dei giorni vecchi): deterministico, guest-first, zero flicker SSR. Il PIANO in sé (date, ordine, stime) è già tutto sincronizzato — solo il bit "il rituale è girato qui" resta locale. Se servirà cross-device, è una PROP per run-12. | **NO** |
| **Variante allenamento** (P5b, CROSS-02 fase 2) | La proposta della variante giusta richiede di sapere QUALE variante è da allenamento → **`meal_variants.training`**: `true` = variante da giorno di allenamento (proposta, mai imposta), `null/false` = normale. | **SÌ — colonna nullable** |
| **Intenzione "domani" su Sera** (PROP-sera-02 `[schema]` del Set A §4) | FUORI RUN — il brief run-11 al P4 la sostituisce con "Prepara domani" (marcatura rollover, zero schema). Il brief vince sullo scope; la PROP resta aperta per un run futuro. **Delta dichiarato.** | **NO** |

### Il percorso scelto: column-only, una migrazione, un bump

Esattamente il cerimoniale preferito dal brief — **colonne nullable su tabelle ESISTENTI, nessuna tabella nuova**:

- **`supabase/migrations/0032_guided_day_fields.sql`** (SCRITTA, MAI applicata): due `alter table … add column if not exists` (`lo_tasks.estimate_min integer`, `lo_meal_variants.training boolean`), commenti di colonna, `notify pgrst`. Idempotente. **Niente ridichiarazione di `lo_push`** (0029 resta finale a 28 tabelle): il precedente 0030 documenta che il SET dinamico raccoglie le colonne nuove via `information_schema`; in più `jsonb_populate_recordset` IGNORA le chiavi json che non sono ancora colonne — un client nuovo che pusha su un server non migrato NON rompe: il campo cade a terra finché Davide non applica la 0032 (finestra deploy→apply sicura, il valore si risincronizza al push successivo post-apply).
- **Niente entità nuove, niente id derivati nuovi** → zero prefissi, zero golden test nuovi (legge di repo rispettata per assenza di caso).
- **Zod** (`data/schemas.ts`): `TaskSchema.estimate_min = int 1..1440 nullable .default(null)` + `taskEditable`; `MealVariantSchema.training = boolean nullable .default(null)` + `mealVariantEditable`. Il `.default(null)` è il house pattern run-09: righe pre-run-11 e backup passano il parse senza scarti.
- **Repo locali**: `LocalTasksRepo.create/update` e `LocalDietRepo.createVariant/createVariantFromBase/updateVariant` materializzano/patchano i campi nuovi (righe sempre complete). `buildSpawnTask` (ricorrenze) fa viaggiare `estimate_min` con l'occorrenza — stessa attività, stessa durata; il test di convergenza two-device l'ha preteso subito (`engine-modules.test.ts` rosso finché lo spawn non portava la stima: il guard-rail funziona).
- **Dexie v12** (`data/db.ts`): NESSUN indice nuovo (stores invariati — la stima si legge dentro liste già filtrate per giorno), solo l'upgrade che backfilla `estimate_min`/`training` a `null` esplicito (pattern v6/v11: zod, LWW e UI vedono righe complete). **Survival test**: `db.migration.test.ts` nuovo caso "v11 → v12" — task e variante scritti a v11 REALE sopravvivono al bump con ZERO perdita, campi nuovi a null, campi nuovi funzionanti sulle righe nuove; aggiornati i `verno` attesi (11→12) e le fixture dei test esistenti.

### Fence e delta

Fence dichiarata: `data/**`, `supabase/migrations/**`, loro test. **Estensione mecanica dichiarata:** `app/(app)/calendar/agenda.test.ts` (factory `task()` tipata su `Task`: una riga `estimate_min: null` — fix di fixture forzato dal tipo, zero comportamento). Prima stesura del commento in 0032 conteneva un nome proprio → BLOCCATA da `lint:sentinels` (il guard-rail di share-prep funziona); riformulato neutro.

**Commit:** `run-11/P1: schema decision (+0032)`
