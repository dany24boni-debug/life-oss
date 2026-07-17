# Run 10 — Product Audit, v3 Proposals, Gated Elevation

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-10` (off `main` @ `ecc92b7`). Mai pushato, mai mergiato.
**Brief:** run-10 — primo run del ciclo v3 "elevation". Fase A: audit di prodotto → `v3-proposals.md`. Fase B (gated): IA palestra scheda-centrica, pass di larghezza desktop, quick win S-effort (cap 8).

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## P0 · Pre-flight gate

**1. Clean tree.** `git status --porcelain` su `main` → vuoto. ✓

**2. Run-09 in HEAD.** `git ls-files docs/plans/lifeos-rebuild | grep 99i` → `99i-run09-report.md`. ✓ (HEAD `ecc92b7`, merge di `feat/run-09`.)

**3. Branch.** Creato `feat/run-10` e switchato. ✓

**4. Baseline verde PRIMA di ogni edit (dalla radice, come da AGENTS.md).**
- `npm run lint` → pulito ✓
- `npm run typecheck` → pulito ✓
- `npm run lint:sentinels` → pulito ✓ ("no personal-data sentinels found")
- `npm run build` → ✓ (webpack, tutte le route presenti)
- `npm test` → **Test Files 75 passed (75) · Tests 952 passed (952)** ✓ — combacia col finale run-09.

**Baseline di dimensione (metodo 99h/99i: chunk client della route, budget Oggi):**
- Oggi: `page-530ee343370a0da5.js` = **53.327 byte** (16.056 B gzip) — byte-identico al finale run-09 (~53 kB del brief confermato).
- Layout `(app)`: `layout-27f267e27f7fbf5e.js` = 38.370 byte (11.989 B gzip).

**5. Letture (per intero, in ordine):** `AGENTS.md`, `00-audit.md`, `01-blueprint.md`, `99g-run07-report.md`, `99h-run08-report.md`, `99i-run09-report.md`.

**Delta brief ↔ documenti:** nessun conflitto rilevato. Il brief dice "baseline ~53 kB raw" per Oggi — confermato al byte (53.327). La convenzione golden-test di AGENTS.md (import canonico `deriveUuidV8` da `data/ids.ts` post run-09/P6) è più aggiornata della memoria storica dei report 99g/99h — vince AGENTS.md, e comunque questo run non tocca id derivati per regola.

Pre-flight PASS.

**Commit:** `run-10/P0: preflight + baseline`

---

## P1 · Product audit → `v3-proposals.md`

**Fence rispettata:** zero modifiche a codice sorgente — `git status` al commit mostra SOLO `v3-proposals.md` + questo report. La lettura è stata totale: shell/Oggi/gym/settimana/ember letti in prima persona; le altre superfici auditate da 4 agenti Explore paralleli (Task+Calendario · Abitudini+Focus+Corpo · Dieta+Statistiche · Esami+Spese+Sera+Impostazioni) con evidenza file:riga per ogni claim, verificata a campione.

**Documento consegnato:** `docs/plans/lifeos-rebuild/v3-proposals.md` — §1 findings+proposte per tutti i 14 moduli con tap-count misurati (metrica FLSI), §2 otto integrazioni cross-modulo, §3 dodici wow features con nota di fattibilità local-first/zero-deps, §4 tre set raccomandati per run-11 + lista quick-win candidati per il P4.

**Findings load-bearing (il resto è nel documento):**
1. **La shell cappa tutto a 768 px** (`layout.tsx:44`, `max-w-2xl → md:max-w-3xl`): nessuna superficie dichiara `lg:`; su 1440p restano ~450 px vuoti. La board Settimana è GIÀ `md:grid-cols-7` ma dentro 768 px (~96 px/colonna): il sintomo riportato da Davide è la shell, non la board. I grafici di /stats sono perfino `max-w-md` (448 px).
2. **Zona morta task +8 giorni**: "Prossimi" è una finestra fissa +1..+7 (`tasks/logic.ts:301-306`) — un task datato oltre non compare in NESSUNA vista di /tasks.
3. **Undo asimmetrico sui log a un tocco**: dieta "Fatto" ce l'ha; abitudini (board+strip), check agenda, "Capitolo fatto" esami e aggiunta spese no.
4. **Dieta traccia carbo/grassi e non li mostra mai**; il "quanto manca" è calcolato (`remainingVsTarget`) e mai renderizzato.
5. **Statistiche mono-variabile**: zero correlazioni, dieta invisibile, `DeltaChip` esiste in ui/ e nessuno lo usa; recap solo settimanale.
6. **Sera è un silos completo** (niente entra, niente esce); Esami non esiste su Oggi (docstring di pacing.ts promette un widget mai costruito).
7. **Palestra**: il prefill "ultima volta" c'è ma è invisibile al momento della conferma; PR celebrati solo a fine seduta; chunk più pesante dell'app (86.172 B pre-P2).
8. **Impostazioni**: unica superficie (app) senza skeleton; tema sepolto sotto 5 card di import fotocopia.
9. **Bugia d'accessibilità in Abitudini**: il docstring dichiara riordino "drag + tastiera", la maniglia non ha handler tastiera.

**Stats del documento:** 44 PROP totali — per modulo: oggi 4 · task 5 · calendario 5 · palestra 6 · statistiche 4 · abitudini 5 · settimana 2 · focus 3 · dieta 5 · esami 3 · spese 3 · sera 2 · corpo 2 · impostazioni 2; più 8 CROSS e 12 WOW (con rimandi incrociati, non doppi conteggi dove coincidono). H-value: 19. Flag: 10 `[schema]`, 0 `[primitive]`, 15 `[cross]`, 9 `[home]`.

**Checkpoint:** solo docs → lint/typecheck/build/test non toccati dal diff; la suite resta quella del baseline P0 (952/952, riverificata al P2).

**Commit:** `run-10/P1: v3 proposals document`

---

## P2 · Palestra — IA scheda-centrica (MANDATORY)

**Checkpoint: VERDE.** lint ✓ (una `no-unused-vars` corretta al volo) · tsc ✓ · build ✓ · sentinels ✓ · test **963/963, 76 file** (baseline 952/75: **+11**, `app/(app)/gym/card-history.test.ts` nuovo — colonne storiche, ultima-esecuzione, riepilogo sezioni forma-Torso-A, bucket set per colonna, href della card). **Dev-check produzione (`npm start`, da ospite):** `/gym` **200** con le 4 tab nell'HTML SSR — "Scheda" PRIMA; `/gym?scheda=x` **200** (deep link); zero controlli nativi nell'HTML; nel chunk servito della route: "Logga oggi" ✓ "suggerita" ✓ "ultima:" ✓ "Storico della scheda" ✓ "Sessione libera" ✓ "Rivedi la seduta" ✓ "scheda=" ✓; nel chunk di Oggi: "Apri: " ✓ e "scheda=" ✓.

### La rotazione (dominio run-07 INTOCCATO — solo IA/navigazione/presentazione)

1. **`/gym` = le card.** Tab nuove: **Scheda** (default) · Storico · Libreria · Programmi — il tab "Allenamento" muore. `SchedaCards` (`scheda-view.tsx`): una card per giorno del programma attivo con nome, sottotitolo, **riepilogo sezioni** ("3 FORZA · 3 IPERTROFIA · 1 CORE", `sectionSummary` pura), **ultima esecuzione** (`lastDoneDate`: ultima CONCLUSA; le abbandonate non sono storia), chip **"suggerita"** sul next-up (STESSA rotazione di sempre, `useNextUpDay` — zero logica di scheduling nuova) e l'ember dot se la seduta del giorno è in corso. Da lg le card vanno a 2 colonne. In coda: "Sessione libera" (ghost — la scorciatoia sopravvive, non è più la porta) e il prompt import legacy (solo autenticati, storico vuoto — riuso di `EmptyHistoryImportPrompt`). Senza programma: EmptyState con CTA → tab Programmi + "Importa esempio: Torso A".
2. **La card = il cuore.** `SchedaCardView`: header (nome, sottotitolo, riepilogo, azione primaria) + **griglia storica Excel-style** (`CardHistoryGrid`): righe = esercizi nell'ordine della scheda nei **gruppi di sezione** (riuso `sectionGroups` del builder — mai riordino implicito), colonne = **date delle esecuzioni** più-recenti-prima con **"Oggi" evidenziata** quando esiste, celle = i set "62,5 × 9" (riuso `doneCellLabel`, formato compatto del progress-grid). Prima colonna **sticky** + `overflow-x-auto`: mobile ~2-3 colonne visibili, desktop quante ne entrano (la larghezza vera arriva col P3). Ogni riga porta la prescrizione ("4×3–5 · RIR 1 · rec 4'30", riuso `slotSummary`) e il **verdetto AUMENTA/RESTA inline** (riuso `verdictForSlot` sull'ultima seduta conclusa — nessuna logica di dominio nuova).
3. **"Logga oggi" DENTRO la card.** Primario nell'header: crea la sessione (`startSessionFromDay`, esistente) o riprende quella in corso del giorno, ed entra nella **griglia di log ESISTENTE** (`SessionGrid` — griglia senza countdown, RIR testuale, micro-editor: internals byte-intoccati) con BackButton verso la card. A fine seduta (`finishSession` esistente + riepilogo modale invariato) **si torna alla card con la colonna di oggi popolata**. Guardie: sessione attiva di un ALTRO giorno → "Riprendi la sessione in corso" (mai due attive per sbaglio); giorno già fatto oggi → riga "Fatta oggi · Rivedi la seduta" (editor storico esistente).
4. **L'ingresso session-centrico è una scorciatoia.** Deep link `/gym?scheda=<dayId>` (`gymCardHref`), letto via `useSearchParams` con **stato derivato nel render** (il deep link vale finché non navighi; niente setState-in-effect — la lezione lint di casa). Il tile Palestra di Oggi ora è un **Link** alla card suggerita: "Apri: Torso A" (era un bottone che creava la sessione e pushava); "Riprendi" porta alla card della sessione in corso (o a /gym per le libere). Nessun link morto: senza programmi il tile cade sul fallback "/gym".
5. **Profondità per-esercizio.** Tap sul nome (colonna sticky) → `ExerciseDetailSheet` esistente (sparkline, PR, e1RM/Δ/Forza Rel., verdetto) — riuso puro.

### Cancellazione grep-gated

`StartPanel` (il pannello di partenza session-first) — consumatori PRIMA della rimozione:
```
$ grep -rn "StartPanel" app lib components data ui
app/(app)/gym/gym-screen.tsx:482:function StartPanel({
```
Solo la definizione interna (il valore era già migrato nelle card) → rimossa; `EmptyHistoryImportPrompt` SOPRAVVIVE (riusato dalle card). `useNextUpDay`/`useProgramDays` escono dagli import di gym-screen (vivono in scheda-view).

### Fence audit

Diff su: `app/(app)/gym/{card-history.ts,card-history.test.ts,scheda-view.tsx}` (nuovi), `gym-screen.tsx`, `_components/today-gym.tsx` (SOLO bersagli dei link + copy del CTA — layout del tile intatto), questo report. `ui/` **zero diff** (nessun primitive nuovo: la griglia riusa il pattern sticky-column inline di progress-table). `data/**` **zero diff** — le righe caricano la storia col pattern "un hook per riga, numero stabile" (ricorsione dieta run-09); niente hook nuovi.

### Delta dichiarati

1. **Tap-count dell'avvio: 1 → 2** ("Apri: Torso A" → "Logga oggi"). È il costo dichiarato della rotazione: la porta è la scheda (il modello mentale di Davide), il log parte da lì; in cambio l'avvio avviene col contesto storico davanti. Il CTA cambia copy da "Inizia:" ad "Apri:" per onestà (fence: "link target, not layout" — il testo segue il bersaglio).
2. **Test della nuova IA a livello logico** (il repo non ha render-testing — convenzione run-07): card list con last-done → `lastDoneDate`+`sectionSummary`; colonne storiche da fixture → `historyColumns`+`setsBySessionForExercise`; il tile di Oggi → `gymCardHref` golden. "Logga oggi entra nel flusso" e "per-esercizio → progressi" sono riuso puro di componenti già testati ai loro run, verificati nel dev-check via chunk.
3. **Chunk /gym: 86.172 → 96.163 B raw** (23,8 kB gzip) — +10 kB per la vista nuova; /gym non ha budget formale, registrato per onestà. **Oggi: 53.327 → 53.798 B (+471 B)** — solo lo swap bottone→Link nel tile (budget P4/P5 intatto).

**Commit:** `run-10/P2: gym card-centric IA`
