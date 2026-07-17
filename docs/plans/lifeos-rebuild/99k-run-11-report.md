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

---

## P2 · Il rituale del mattino — "Pianifica la giornata"

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **984/984, 77 file** (+19: `ritual-logic.test.ts`). **Smoke produzione:** `/` **200** da ospite; la card è ASSENTE dall'HTML SSR per costruzione (snapshot server = `undefined` → la shell rende null; la card appare post-idratazione solo nei giorni non pianificati/congedati — pattern InstallTodayCard).

### Il flusso (un invito, mai un cancello)

Card "Pianifica la giornata" PRIMA sezione di Oggi (sopra i tile), congedabile col "Non oggi" (memoria per-giorno), quattro passi tutti saltabili con "Avanti", chiusa a metà tiene ciò che è fatto — ogni azione è una mutazione reale immediata, non un wizard con submit:

- **a · Da ieri (rollover).** I task arretrati (`useOverdueTasks`, il set candidato È la lista In ritardo — nessuna verità nuova) con tre azioni per riga: **"Oggi"** e **"Più avanti"** = `actions.snooze(t, {day})` (riuso: toast "Spostato a … · Annulla"); "Più avanti" punta a `laterRange(today).from` (+8, la finestra run-10). **"Lascia"** non tocca i dati: il task resta In ritardo su /tasks, solo il rituale smette di chiederlo (Set locale di sessione). Con 2+ righe compare **"Porta tutte a oggi"** (`moveAllToToday`, undo cumulativo esistente). Deciso l'ultimo arretrato il passo SPARISCE e si scivola avanti da soli.
- **b · La lista di oggi (stime).** I task aperti di oggi con chip 15'/30'/1h/1h30 (`RITUAL_ESTIMATE_CHOICES` = 15/30/60/90 del brief), `aria-pressed`, tint ember da selezionato (il calco del picker preset di /focus). Tap sul chip attivo = toglierla. Facoltative per contratto; in coda "Stimati: 1h45" quando ce n'è.
- **c · In che ordine (playlist).** Riordino dei task aperti di oggi: drag dalla maniglia (`useRowDrag` di casa), **frecce su/giù visibili** (pattern ArrowButton) E **tastiera sulla maniglia** (ArrowUp/Down con `aria-label` che dichiara il gesto — la maniglia nasce onesta, a differenza della bugia abitudini che il P6 sanerà). Persiste con `actions.reorder` → `sort_order` (semantica esistente).
- **d · Capacità.** `capacityLine(somma stime, minuti liberi)`: i minuti liberi = finestra [adesso → 23:00] meno gli eventi con orario del giorno (locali + Google, `buildDayAgenda` con `tasks: []` — i task NON sono blocchi, sono l'altra metà dell'equazione), sovrapposizioni fuse, default 60' per eventi senza fine. Sopra: **"Hai pianificato 5h30 su ~4h libere."** + "Qualcosa può aspettare domani." — riga gentile, MAI bloccante; dentro: stessa forma senza allarme; zero stime: "il conto resta a task", onesto.

**Lo stamp.** "Fatto" (ultimo passo) → `planned_at` + numeri del piano (task/stime/libere) in localStorage per-giorno + toast "Giornata pianificata · Annulla" (l'undo riapre la card). "Non oggi" DOPO aver toccato dati = piano parziale: stampa comunque (il brief P5c lo dirà); senza aver toccato nulla è solo congedo. Domani è un giorno nuovo (chiavi potate alla scrittura, pattern brief-cache).

### Il budget di Oggi: la lezione del primo colpo

Prima stesura monolitica: chunk **59.976 B** (+12,1 kB, a 24 byte dal tetto di FINE RUN — inaccettabile col P3 in arrivo). Rimedio da brief ("dynamically imported segments"), due tagli:
1. **Shell + corpo lazy**: `today-ritual.tsx` (shell: SOLO gate di visibilità — idratazione/congedo/pianificato) + `ritual-body.tsx` caricato con `next/dynamic` SOLO quando la card va mostrata. Una giornata già pianificata o congedata non paga i byte dei quattro passi.
2. **`ritual-state.ts` separato da `ritual-logic.ts`**: lo store sempre-caricato importa solo parse/chiavi/potatura; la matematica di capacità e i passi restano nel modulo importato SOLO dal corpo (webpack non tree-shakava tra i due — misurato: "Hai pianificato" era nel chunk della home, ora non più).

**Misure finali:** Oggi **52.423 B raw (16.306 gzip)** = +4.578 raw sul baseline (shell+store+state+runtime di lazy-load); corpo del rituale in chunk on-demand da **10.966 B raw (3.921 gzip)**. Headroom al tetto 60.000: **7.577 B** per P3+P5.

### Fence e delta

Fence: `_components/ritual/**` (nuovi: shell, body, store, state, logic, test) + montaggio in `page.tsx` + UNA riga in `today-adesso.tsx`. Anchored edits sui pre-esistenti:
- `page.tsx`: import + `<TodayRitual google={googleEvents} />` tra `</header>` e `<TodayTiles />` (prima: `{/* Tile reali … */}\n<TodayTiles />` subito dopo l'header).
- `today-adesso.tsx`: `function useNowHhmm(…)` → `export function useNowHhmm(…)` (una parola + docstring: l'orologio al minuto della home si condivide col rituale invece di duplicarlo).

Delta dichiarati: (1) niente pulsante "Salta" separato — con azioni istantanee per passo, "Avanti" senza aver agito È saltare (un bottone in meno, stessa semantica del brief); (2) i chip stima non hanno toast-undo: il chip selezionato è visibile e ri-tappabile (il pattern EnergyPicker di Sera — l'undo a toast resta per le mutazioni il cui effetto sparisce dalla vista, come gli spostamenti); (3) "Lascia" non marca `touched` (nessun dato toccato → da solo non vale lo stamp).

**Commit:** `run-11/P2: morning ritual`

---

## P3 · La timeline di oggi — "La tua giornata"

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **991/991, 78 file** (+7: `timeline-logic.test.ts`). **Smoke produzione (porta pulita):** `/` **200**, la sezione "La tua giornata" è nell'HTML SSR, la vecchia sezione "Adesso" non esiste più.

### La risoluzione CROSS-05: Agenda + Adesso CONVERGONO (non coesistono)

Come da PROP ("la sezione Agenda + Adesso di Oggi convergono in un componente solo"), la scelta è **sostituzione**: `TodayTimeline` prende il posto di ENTRAMBE — niente stato duplicato perché lo stato vive negli stessi hook condivisi di prima (`useTodayPlanSlots` resta l'unica verità del piano di oggi, ora consumata da timeline+brief+tile). Una colonna in ordine d'ora, ogni voce col SUO gesto nativo:

- **Fascia senza orario in testa** (la convenzione buildDayAgenda), arricchita: **marker Palestra** (in corso → "riprendi" / fatta / suggerita col nome del giorno-scheda, sempre deep-link `gymCardHref` — run-10 P2), **marker Pasti** ("2 di 4" → /dieta), eventi all-day, e i task senza orario **nell'ordine playlist del rituale** (`orderBandTasks`: i task per `sort_order`, non più alfabetici; eventi dove stavano), con la **stima quieta** ("30'") quando c'è.
- **Flusso con orario**: slot del piano (il `SlotRow` VERO di settimana: tap = fatto, 450ms = saltato, "s" da tastiera, evidenza del corrente via `findNowSlot`) · eventi locali e Google (righe AgendaRow: scheda al tap, badge Google read-only) · task con orario (check inline con undo run-10) · **fasi focus concluse** all'ora del loro `created_at` ("Focus · 25'", attenuate). Ordinamento in `buildTimedStream` (puro): minuto, poi slot < voce < focus, stabile.
- **Cursore "adesso"**: punto ember + filo tra l'ultima voce passata e la prima futura (le voci del minuto corrente restano sopra: sono "in corso"), `aria-hidden` (l'informazione vera sono gli orari), aggiornato dal `useNowHhmm` condiviso.
- WeekStrip + densità + deep-link a /calendar + le schede dettaglio evento/task: TUTTO riuso dall'Agenda di prima. Empty state onesto ("Giornata libera") solo quando non c'è NIENTE, marker compresi.

### Cancellazioni grep-gated

```
$ grep -rn "TodayAgenda|today-agenda" app lib components ui data   → SOLO app/(app)/page.tsx (il mount)
$ grep -rn "TodayAdesso" app                                       → SOLO app/(app)/page.tsx (il mount)
```
→ `today-agenda.tsx` ELIMINATO (assorbito per intero); in `today-adesso.tsx` è rimosso il componente `TodayAdesso` ma il FILE VIVE coi due hook condivisi (`useTodayPlanSlots`, `useNowHhmm` — consumati da brief, tile, rituale e timeline), docstring riscritto onesto. `AgendaList` resta (la usa /calendar); la sua `AgendaRow` ora è esportata e rende l'annotazione opzionale `meta` (additiva: /calendar non la imposta e resta com'era).

### Budget Oggi

**55.776 B raw (17.456 gzip)** = +3.353 sul post-P2 (la timeline al netto delle due sezioni assorbite). Headroom al tetto 60.000: **4.224 B** per P5c/P5d — basta per le righe del brief e il widget esami; se il P5d non ci sta, andrà collassato o rimandato con delta (regola del brief).

### Fence e delta

Fence: `today-timeline.tsx` + `timeline-logic.ts`(+test) nuovi; `page.tsx` (swap mount); estensioni dichiarate — `data/hooks.ts` (+`useFocusSessions`, selettore read-only sancito dalla fence "read-only selectors"), `calendar/agenda.ts` (campo opzionale `meta` su AgendaItem), `agenda-list.tsx` (export AgendaRow + rendering `meta`), `today-adesso.tsx` (rimozione componente assorbito), `format-min.ts` estratto da ritual-logic (il modulo minuscolo condiviso: la timeline non trascina la matematica di capacità nel chunk della home).

Delta: (1) il marker dieta è "Pasti · N di M" (stato del giorno) — la "variante del giorno" come concetto per-giorno NON esiste nel modello (le varianti sono per-pasto): il P5b porterà la proposta variante-allenamento DENTRO la card pasto di /dieta, dov'è il gesto; (2) i marker palestra/pasti DUPLICANO di proposito una riga di contesto con le sezioni sotto (sono il "posto nel flusso", le sezioni restano i pannelli coi numeri) — se in uso il doppione pesasse, si ritira il pannello in run-12, non il marker; (3) PROP-oggi-02 (ordine per fascia oraria delle sezioni) assorbita in gran parte dalla timeline stessa (la giornata ORA è consapevole dell'ora per costruzione): la promozione/retrocessione delle sezioni resta aperta, delta al P7.

**Nota di processo:** il primo smoke sembrava mostrare la timeline assente dall'SSR — era un server `next start` SOPRAVVISSUTO dallo smoke P2 sulla porta 3000 che serviva la build vecchia (il `pkill` non l'aveva preso). Da qui in poi gli smoke chiudono la porta per PID. Nessun bug nel codice: sulla porta pulita l'SSR è corretto al primo colpo.

**Commit:** `run-11/P3: today timeline`

---

## P4 · La chiusura della sera — Sera si de-siloizza

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **991/991, 78 file** (nessun test nuovo: composizione di selettori già testati ai loro run; zero logica pura nuova — il riuso è il punto). **Smoke produzione (server chiuso per PID prima di ogni build):** `/sera` **200** con recap E storico nell'HTML SSR, zero error-digest; `/` **200** con la timeline.

### Il recap ("La giornata") — i fatti prima del come è andata

`SeraRecap` in testa a /sera, TUTTO da selettori read-only esistenti:
- **Task** `3 su 5` (`useTasksSummary`) · **Abitudini** `4 su 6` (`useHabitBoard`) · **Focus** `50'` (`useFocusMinutesByDay`, formato `formatMin` condiviso).
- **Palestra: QUALE scheda** — sessione conclusa → il NOME del giorno-scheda (`useProgramDay(program_day_id)`, hook già esistente) con deep-link `gymCardHref` alla card; in corso → "in corso"; niente → "—" quieto, mai colpevolizzante.
- **Dieta — `remainingVsTarget` FINALMENTE renderizzato** (il fantasma dell'audit P1): "Dieta: 1.850 / 2.100 kcal · ne restano 250 · 128 / 160 g proteine" — stessa derivazione degli obiettivi di /dieta (`calorieTargetKcal`/`proteinTargetG` dal profilo+pesata), stessi formatter (`formatInt`, `formatGramsFromDg` — la lezione it-IT del grouping resta in UN posto). Sopra il target: "N oltre", onesto. Senza piano né extra: nessuna riga; senza profilo: solo il consumato.

**"Prepara domani":** i task APERTI di oggi → `date = domani` (`snoozeDate("domani")`, la stessa pura dello snooze) con UN toast cumulativo "N task pronti per domani · Annulla" (undo ripristina ogni data) — il calco di `moveAllToToday`, scritto contro `appRepos()` direttamente (il precedente è il TaskCheck dell'agenda). Domattina il rituale si apre già carico: i task SONO di domani, il passo rollover non ha nulla da chiedere. Diario e Drive: byte intoccati.

### PROP-sera-01 — l'aggancio serale su Oggi (fence estesa, dichiarata)

`TodaySera` su Oggi: dopo le 20:00 (orologio condiviso `useNowHhmm`), se il check-in di stasera NON esiste, una card quieta "Sera — Com'è andata la giornata? →" che porta a /sera e sparisce da sola a check-in iniziato (`useCheckin === null` come unico gate dati; in SSR/caricamento rende null, zero flicker). È il pezzo di Set A che chiude CROSS-04 lato sera; il brief P4 non lo nominava esplicitamente ma Set A sì — fence estesa a `_components/today-sera.tsx` + una riga di mount in `page.tsx`, dichiarato qui.

### Budget Oggi

**56.574 B raw (17.604 gzip)** = +798 per l'aggancio serale (il recap vive nel chunk di /sera, non della home). Headroom al tetto: **3.426 B** per P5c/P5d.

### Delta dichiarati

1. **PROP-sera-02 ("Domani" testuale) NON in questo run** — sostituita dal brief con "Prepara domani" (già annotato al P1): il cerchio CROSS-04 si chiude coi TASK veri invece che con una frase da ricopiare.
2. **Niente util condivisa per remaining-vs-target**: PROP-diet-01 la colloca nell'header di /dieta (dove `consumato / target` è GIÀ renderizzato dal run-09) — la riga di Sera riusa le pure esistenti e i formatter; una util di rendering condivisa non è specificata dalla PROP e sarebbe un'astrazione per due usi divergenti. PROP-diet-01 (il numero "restano" DENTRO /dieta) resta aperta per il triage.
3. **Nessun test nuovo**: il recap è composizione 1:1 di selettori/pure già golden/testati (remainingVsTarget, snoozeDate, formatMin, dayTotals); l'unica "logica" nuova è formattazione di stringhe a vista.

**Nota di processo (il digest fantasma):** il primo smoke di /sera mostrava un error-digest SSR con fallback allo skeleton — non era il codice: era la build rigenerata SOTTO un `next start` sopravvissuto (manifest disallineati al volo). Con la sequenza onesta (kill per PID → build → start → curl) l'SSR è pulito e stabile su due probe consecutivi. Gli smoke del run da qui in poi usano lo script `probe` con questa sequenza.

**Commit:** `run-11/P4: evening shutdown + sera recap`
