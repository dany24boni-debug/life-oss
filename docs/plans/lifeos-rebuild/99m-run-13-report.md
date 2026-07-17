# Run 13 — La Passata di Craft (polish sistemico, QA multi-agente, hardening, docs)

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-13` (da `main` @ `4d40985`, che contiene run-12 mergiata). Mai pushato, mai mergiato.
**Brief:** run-13 — polish sistemico OGGETTIVAMENTE migliore (motion, stati, consistenza, a11y, perf, docs), ZERO decisioni di prodotto/gusto: le domande da device restano domande e finiscono nella lista JUDGMENT in testa a questo report. Migrazioni ZERO · Dexie ZERO · dipendenze ZERO · schema ZERO.

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## LISTA JUDGMENT (da compilare al P7 — le decisioni che spettano a Davide)

*(placeholder: consolidata al P7 dalle domande aperte di 99k, 99l e dai finding JUDGMENT dell'audit P1)*

---

## P0 · Pre-flight gate

**1. Clean tree.** `git status --porcelain` → vuoto. ✓

**2. Merged-state check (la lezione run-11).** Da `main`: `git ls-files docs/plans/lifeos-rebuild | grep 99l` → `99l-run-12-report.md` PRESENTE. `main` @ `4d40985` = "Merge branch 'feat/run-12'" — run-12 (e con lei 10 e 11) è mergiata. **Caso pulito: `feat/run-13` branchata da `main`.** Nessun delta di lineage, un solo merge al gate.

**3. Branch.** Creato `feat/run-13` e switchato. ✓

**4. Baseline verde PRIMA di ogni edit (dalla radice, come da AGENTS.md).**
- `npm run lint` → pulito ✓
- `npm run typecheck` → pulito ✓
- `npm run lint:sentinels` → pulito ✓
- `npm test` → **Test Files 83 passed (83) · Tests 1039 passed (1039)** ✓ — al numero l'atteso del brief (~1039/83) e il finale run-12.
- `npm run build` → ✓ (webpack, build fresca dopo `rm -rf .next`, tutte le route presenti)

**Baseline di dimensione (metodo 99h: chunk client della route, raw + gzip, build fresca).**

| Chunk | File | Raw | Gzip | vs atteso brief |
| --- | --- | --- | --- | --- |
| **Oggi** `(app)/page` | `page-00a0cfdfcd6a93bd.js` | **59.729 B** | 18.687 B | = 59.729 ✓ — **tetto duro di fine run: 60.000** |
| Layout `(app)` | `layout-dc890032588a24a6.js` | 30.434 B | 9.434 B | ~30.436 (2 B di rumore hash) — budget run: ≤ +1.000 |
| Corpo palette (lazy) | `7418.40aceb92a4c9aaa6.js` | 15.274 B | 6.099 B | ~15.275 ✓ |
| /gym | `page-60a9fcad5c207a2f.js` | 103.393 B | 25.782 B | = 103.393 ✓ — candidato split P5 |
| /stats | `page-aaa2ee124d5e2c97.js` | 25.096 B | 8.683 B | = 25.096 ✓ |
| /dieta | `page-50a8bf1322345fef.js` | 58.503 B | 13.223 B | = 58.503 ✓ |
| /calendar | `page-889b221558331217.js` | 10.618 B | 4.323 B | = 10.618 ✓ |

**5. Letture (per intero, in ordine):** `AGENTS.md` · `99l-run-12-report.md` (340 righe) · `99k-run-11-report.md` (282 righe) · `docs/plans/lifeos-rebuild/v3-proposals.md` (477 righe).

**Delta brief ↔ documenti (valutazione P4 anticipata, dalla lettura):**
1. **PROP-corpo-01** (media mobile 7g): spec univoca in v3-proposals §1.13 ("seconda polyline quieta sopra i punti grezzi, pura matematica in logic.ts") → P4a procede. "Il tuo mese" resta prima→ultima (deciso al triage, il brief lo ribadisce — non si tocca).
2. **Rail ⌘K**: deciso al triage (99l domanda #7 → risposta nel brief P4b: bottone piccolo e quieto sul rail desktop, stesso corpo lazy, niente mount touch).
3. **PROP-esami-03** (CTA scaduti): la spec dice "CTA 'com'è andata?' → voto o nuova data, dalla scheda esistente" — da verificare al P4 che la scheda esistente abbia davvero i campi (voto/data); se sì è specificata abbastanza, altrimenti skip con riga.
4. **Copia-giorno nella griglia desktop /dieta**: NESSUNA spec single-affordance esiste (99l la annota solo come asimmetria per il triage) → P4d SKIP con riga, come previsto dal brief.
5. Le domande aperte di 99k (#1 rituale a qualunque ora, #2 marker vs pannelli, #3 "+8 giorni", #5 strategia budget home) e 99l (#1 attrezzatura, #2 PR solo peso, #3 soglie correlazioni, #4 delta peso mese, #5 salto larghezza tab dieta, #6 rimescolo commons) sono INPUT della lista JUDGMENT del P7 — non si decidono in run.

Pre-flight PASS.

**Commit:** `run-13/P0: preflight + baseline`

---

## P1 · The Grand Audit

**Fence rispettata:** solo `v3-craft-audit.md` + questo report; **zero file sorgente toccati** (tutto il lavoro è stato lettura/grep). **Checkpoint:** doc committato (nessun codice cambiato → niente build/test da rifare; la baseline P0 resta il verde di riferimento).

### Il dispositivo (e l'incidente di processo che vale il verbale)

Sette agenti paralleli come da brief (5 di superficie + contratto a11y + inventario motion). **La prima ondata (agenti Explore) ha FABBRICATO finding**: file inesistenti (`exam-sheet.tsx`, `impostazioni-screen.tsx`), righe citate che non contengono ciò che si afferma, difetti smentiti dal sorgente (chip "senza transizione" che ce l'hanno on-token, stepper "senza disabled" che ce l'ha ai bound). Su 10 finding spot-verificati del primo batch, **1 reale**. Protocollo adottato: (1) ogni batch si accetta solo dopo verifica grep/sed delle righe citate, fatta da chi scrive; (2) tutti gli audit rilanciati come agenti general-purpose con obbligo di **quote verbatim** per finding ("un finding senza quote è invalido"); (3) in parallelo, le dimensioni oggettivamente greppabili (font sub-12px, outline soppressi, durate hardcoded, colori crudi, onClick non focusabili, plurali template) le ho spazzate IO con grep deterministici, come rete di controllo. Esito: i batch general-purpose hanno retto la verifica (campioni 5/5 per batch); due batch della prima ondata (task/cal/sett e gym/stats/focus, più il motion) erano comunque onesti e sono stati tenuti DOPO verifica. **Lezione per i run futuri: gli audit si fanno con agenti che leggono i file per intero e citano verbatim; Explore serve a LOCALIZZARE, non a giudicare.**

### I numeri dell'audit

`v3-craft-audit.md`: **4 famiglie sistemiche** (F1 token `--em-r-full` inesistente → pill quadrati in 8 siti; F2 palette cruda come testo → parità light/AA in ~14 siti; F3 tap target sotto 44px → ~25 siti con due rimedi, taglia diretta o utility `.em-hit`; F4 pop-in senza skeleton → 6 siti) + **~30 finding puntuali SAFE** (tra cui 3 bug veri: "fatta · fatta" nel recap Sera, i Recenti della palette che scartano gli id delle schede gym, lo scroll-lock che resta bloccato su chiusura fuori ordine) + **41 voci JUDGMENT** (J-01…J-41, incluse le ereditate 99k/99l) che il P7 consolida nella lista per Davide. Copy oggettivamente sbagliata a verbale: 5 plurali rotti ("Importati 1 esami", "1 pasti copiati", "1 slot copiati", "Importate 1 spese", "Importate 1 righe"), il genere di "task" incoerente (Fatte/Fatti nello stesso file), tre "lun -> dom" ASCII, cinque etichette minuscole ("annulla"/"cambia"/"‹ ricerca").

### Le scoperte strutturali (input diretto di P2)

1. **Il gap motion è l'USCITA**: dentro `(app)`+`ui` la disciplina è quasi perfetta (175 transizioni on-token, zero `transition` nudi) ma ogni overlay smonta a scatto (sheet/modal/toast/popover) — enter animato, exit istantaneo.
2. **ember.css ha GIÀ quattro durate** (tap/control/card/screen — il brief ne presupponeva due): P2 non aggiunge durate, aggiunge l'easing d'uscita mancante (`--em-ease-in`), i keyframes -out, la macchina di chiusura e le utility.
3. **Due gate reduced-motion coesistono** (Ember scoped + globale legacy in globals.css): i portali ri-applicano `.em-scope`, nessuna animazione JS-driven sfugge; il gate Ember clampa per proprietà, quindi copre automaticamente ogni keyframe nuovo di P2.
4. **em-dot--live**: 14 usi censiti, tutti "vivo/adesso" o conferma — niente da unificare, niente da ritirare.

**Commit:** `run-13/P1: craft audit`

---

## P2 · The Motion Layer (FLAGGED)

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · build ✓ · test **1039/1039, 83 file**. **Budget: Oggi 59.729 B raw, HASH byte-identico alla baseline (`00a0cfdfcd6a93bd`)** — le primitive vivono nei commons, come previsto dalla legge di residenza run-11. Layout 30.434, hash identico. I byte veri del P2: commons `3456-*` 46.736 → **47.898 (+1.162)** (le tre macchine di chiusura), CSS bundle 80.396 raw/13.391 gz (keyframes+utility). Fuori dal metodo di misura route, registrati per onestà.

### Cosa è entrato in `ui/ember.css` (tutto FLAGGED)

1. **`--em-ease-in`** (`cubic-bezier(0.4,0,1,1)`) — l'easing d'uscita che mancava: le uscite accelerano via. **Delta dichiarato vs brief:** il brief presupponeva solo `--em-dur-tap`/`--em-dur-control` e contemplava una "terza durata ~200–240ms" — ember.css ne aveva GIÀ quattro (tap/control/card/screen: la 240 esiste, si chiama card). **Zero durate nuove.**
2. **Keyframes -out**: `em-fade-out` · `em-pop-out` · `em-sheet-out` · `em-toast-out`. Le uscite sono PIÙ CORTE delle entrate (control 180 vs card/screen) — lo standard.
3. **`--em-r-full: 9999px`** — il fix F1 dell'audit: una riga, 8 siti guariti (i "cerchi" di Sera, badge/barre esami, chip/barre spese tornano pill).
4. **`.em-hit`** — estensione dell'area di tocco a 44px via pseudo-elemento, zero pixel mossi (per i controlli F3b il cui look compatto è disegno). **`.em-pressable`** — feedback di pressione scale(0.97) a dur-tap, solo per elementi chip-scale (il precedente è il FAB `active:scale-95`). Applicazioni in P3.
5. **Gate reduced-motion: NESSUNA modifica necessaria** — il gate esistente clampa `animation-duration`/`transition-duration` per PROPRIETÀ sotto `.em-scope *`, quindi copre automaticamente ogni keyframe nuovo; i portali ri-applicano `.em-scope` (verificato dall'inventario P1). Il requisito "un solo gate CSS globale" era già soddisfatto; sotto reduced-motion le uscite durano 0.01ms e l'unmount è di fatto istantaneo, come prima.
6. **Delta dichiarato — niente utility di mount** (`em-rise`): il brief la elenca tra i momenti ricorrenti, ma NESSUN finding SAFE la applica (lo swap skeleton→contenuto è J-34, gusto) — una utility morta sarebbe CSS spedito a vuoto. Se il triage scioglie J-34, è una riga.

### Le macchine di chiusura (BottomSheet · Modal · Toast)

Pattern unico: `shown` + aggiustamento render-phase (mai setState sincrono negli effect — la lint di casa), fase `closing` che scambia la classe d'animazione, **unmount su `animationend`** (guardato su `e.target`) con **fallback a timeout 400ms** (un animationend perso non può lasciare un overlay morto a mangiare i tap — il contenitore è `fixed inset-0`), `pointer-events-none` durante la chiusura, riapertura a metà uscita gestita (la classe torna enter, `shown` resta). Toast: il timer/l'azione/la X ora portano a `leaving` (l'exit) invece che all'unmount diretto; il card smonta a fine animazione.

- **CRAFT-motion-01 → FIXED (P2).** Sheet/modal/toast ora escono come entrano.
- **CRAFT-motion-02 → FIXED (P2).** Il drag annullato della sheet ora MOLLEGGIA indietro (`transition-transform` a dur-tap sul panel; durante il drag l'inline `transition:none` la spegne, com'era).

### Delta dichiarati (oltre ai due sopra)

1. **Eviction del toast** (arriva il 4°, lo stack è 3): il più vecchio smonta dall'ESTERNO (filter del provider) → senza exit. Raro, dichiarato, accettato.
2. **Chiusura della sheet via drag**: `dragY` si azzera prima dell'exit → l'animazione parte da translateY(0) (micro-salto se il drag era lungo). Accettato: coreografare drag+exit richiederebbe stato condiviso drag→animazione.
3. **I popover NON migrano** (select, date/time-picker, menu task, palette): restano enter-only — J-33, scope deliberato (il brief nomina sheet/modal/toast). L'infrastruttura (keyframes, ease-in) è pronta.
4. **em-dot--live**: censimento P1 = 14 usi, tutti "vivo/adesso" o conferma — unificato per constatazione, nessuna moltiplicazione da fermare, nessun ritiro.

### Fence

`ui/ember.css` · `ui/bottom-sheet.tsx` · `ui/modal.tsx` · `ui/toast.tsx` + report. Test: nessuno nuovo (CSS + micro-stati; la suite intera resta verde — le macchine sono dietro le stesse prop `open/onClose`, API invariata).

**Commit:** `run-13/P2: motion layer (FLAGGED)`

---

## P3 · The Consistency Pass — tutti i SAFE, sei commit

**Checkpoint (fine pass): VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · test **1039/1039, 83 file** ✓ · build fresca ✓. **Budget Oggi: 59.729 → 59.689 (P3 gruppo 1: −40, il ring custom di TileLink rimosso pesava più dei min-h aggiunti) → 59.856 a fine pass (+127 netti vs baseline)** — SOTTO il tetto 60.000 di 144 B; la crescita è TUTTA className/markup del polish stesso (aria-pressed, handler tastiera del RowMenu, transizioni, min-h): giustificata dalla legge di budget. Layout: 30.434, invariato.

### I sei commit (gruppi P1 + il gruppo ui)

1. **oggi+sera+shell** (`e9f1ea5`): reminders "Ok"/"Segna tutti letti" a 44px · pwa-install Installa/Non ora a md · chip rollover+stima del rituale a 44px · TileLink senza ring custom (il globale monocromo è la legge) · "fatta · fatta" del recap Sera sanato · link "collega Google" con hover di casa · cap Recenti palette 40→64 (le schede gym ora ci ENTRANO) · icona strip abitudini ember→ember-text.
2. **task+calendario+settimana** (`5e12366`): aria-pressed sul check task · genere di "task" unificato al maschile ("Fatti oggi", "Sposta tutti a oggi") · cestino sottotask a 44px · "×" dei tag con `.em-hit` + transizione · layer di reveal dello swipe con transition-opacity · "Elimina evento" col danger dei gemelli · sheet evento con skeleton (pattern task-detail) · banner/errori calendario su token -text · glifo "saltato" da text-[10px] a SVG · label 3-stati dello slot + "premi S" dichiarato (label + help) · "1 slot copiato" · "Annulla" capitalizzato.
3. **palestra+statistiche+focus** (`382d4ae`): **tastiera sul riordino esercizi del day-editor** (entrambe le viste: frecce sul grip, label onesta — il contratto scritto in use-row-drag.ts era disatteso solo qui) · Δ della ProgressTable e chip recupero su token -text · colonna sticky su surface-2 · chip filtri/rating con transizione simmetrica e a 44px · "+ aggiungi qui", WeekdayChips (`.em-hit`), campanella chime a 44px · doppio pt-4 rimosso · skeleton sulla ProgressTable · "lun → dom" ×3 · useGrouping sui due KG_DELTA · chip preset focus a 44px.
4. **dieta+abitudini+corpo** (`4b1c942`): "Applica" e "+" della WeekGrid a 44px · summary "Archiviati" a 44px con hover · GridMealCell transition-shadow (la proprietà giusta) · "1 pasto copiato" · minuscole capitalizzate (Annulla ×3, Cambia, ‹ Ricerca) · header obiettivi dieta con gate skeleton (niente hint smentito) · food-picker senza flash "libreria vuota" · chip +N/totale/− con hover e `.em-hit` · "Torna a oggi" a 44px · streak/"Fatta"/delta peso/IconCheck su token -text · StepBtn con hover e glifo in scala (via text-lg) · ternario delta collassato.
5. **esami+spese+impostazioni** (`b8b6533`): STATUS_TEXT theme-adattivo per il badge pacing (il crudo resta a tinta/barra) · tracce barre su color-mix (visibili in light) · stepper ±1 a 44px (il docstring "44px" ora dice il vero) · sheet esame/spesa con skeleton · frecce mese a 44px · plurali import sanati (esame/spesa/righe ×3) · lastError su segnale-text · loading sui bottoni export/import/mantieni/svuota · "Rimuovi" a 44px · CTA ospite con active.
6. **ui primitives (a11y contract, FLAGGED)** (`b7278b7`): `aria-required` cablato in Field · role="alert" sui toast error · aria-autocomplete sulla palette · griglia calendario con role="row" per settimana (`display:contents`, layout intatto) · clear "×" dei picker HOISTATO a sibling (interattivo dentro <button> = albero invalido; spacer = pixel identici) · contratto tastiera dei listbox (WeekStrip + colonne TimePicker: roving tabindex + frecce + Home/End, fallback primo-item) · prop `label` su Tabs + i 4 call site nominati · Button in loading con opacity-0 (il nome accessibile resta) · scroll-lock con cattura dell'overflow originale a livello modulo (il bug della chiusura fuori ordine) · RowMenu con frecce ↑/↓ e focus-return al trigger · text-3→text-2 sui 5 badge su surface-2 (il sesto sito citato stava su surface e PASSA — verifica a verbale nell'audit doc).

### Delta dichiarati del P3

1. **WeekdayChips del day-editor: rimedio (b) `.em-hit` invece di (a) taglia diretta** — 7+1 chip in una riga flex: a 44px visivi andrebbero a capo su mobile; l'hit-area invisibile dà gli stessi 44px senza toccare il layout. Stessa cosa per i chip +N/totale/finestre-trend (il "small pill" è disegno).
2. **L'input quantità di habit-card (h-8) NON ha `.em-hit`**: gli pseudo-elementi non rendono sugli elementi replaced (`<input>`) — il target vero è il focus, e ci si arriva dal bottone "totale…" (che l'hit ce l'ha). Dichiarato.
3. **week-board:292 non toccato** (contrasto): il sito sta su surface, non surface-2 — 4,83:1 passa. La verifica è annotata nell'audit doc.
4. I tag `FIXED-IN-RUN-13` nell'audit doc sono stati scritti in stesura P1 come piano di lavoro; a fine P3 OGNI tag è stato onorato (riscontro voce-per-voce; l'unica eccezione parziale è il punto 2 qui sopra, annotata sul finding).

**Commits:** `run-13/P3: consistency — <gruppo>` ×6
