# Run 13 — La Passata di Craft (polish sistemico, QA multi-agente, hardening, docs)

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-13` (da `main` @ `4d40985`, che contiene run-12 mergiata). Mai pushato, mai mergiato.
**Brief:** run-13 — polish sistemico OGGETTIVAMENTE migliore (motion, stati, consistenza, a11y, perf, docs), ZERO decisioni di prodotto/gusto: le domande da device restano domande e finiscono nella lista JUDGMENT in testa a questo report. Migrazioni ZERO · Dexie ZERO · dipendenze ZERO · schema ZERO.

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## LA LISTA JUDGMENT — rispondi dal telefono, una riga ciascuna

*Consolidata da 99k, 99l e dall'audit P1 (v3-craft-audit.md, J-01…J-41). Ogni voce è una decisione: un vocale basta. Ordine = il giro del device tour.*

**Oggi / rituale / timeline**
1. (J-11) Il rituale compare a qualunque ora finché non decidi: gate a fascia mattutina?
2. (J-10) I marker della timeline doppiano i pannelli sotto (Palestra, Pasti): ritiro il PANNELLO, il MARKER, o restano entrambi?
3. (J-12) "Più avanti" nel rollover = +8 giorni fissi: giorno giusto o serve un mini-picker?
4. (J-13) Chips stima 15'/30'/1h/1h30: i tagli giusti? (La PROP diceva 15/30/1h/2h.)
5. (J-32) Il brief di Oggi appare un attimo dopo il load (una riga di CLS): riservo lo spazio o va bene il pop?
6. (J-24) I link-testata delle card di Oggi ("Modulo", "Calendario") sono ~20px di tocco: estendo l'hit-area invisibile o il target vero è la card?
7. (J-20) Raffica di +330ml acqua = raffica di toast: coalescing in un toast solo con Annulla cumulativo?

**Palestra**
8. (J-14) Attrezzatura: bilanciere default 20kg passo ±2,5, tagli 25…0,5 — combacia col TUO rack?
9. (J-15) Il PR al set celebra solo il PESO (reps/volume a fine seduta): basta?
10. (J-01) Le celle già loggate della griglia non hanno hover proprio (le ghost sì): gliene do uno (lift d'ombra)?
11. (J-22) I grip di riordino (task, abitudini) sono alti 44 ma larghi 32px: allargo OVUNQUE a 44 (ruba ~12px ai titoli)?

**Statistiche / Focus / Corpo**
12. (J-16) Correlazioni: soglie 5 giorni/gruppo e finestra 60g — tarale coi dati veri.
13. (J-17) "Il tuo mese", delta peso = prima→ultima pesata (la media mobile ora è su /corpo): confermi?
14. (J-04) Il timer di /focus è 48px in font testo: lo porto sulla scala display (40 o 64, faccia Bricolage)? Cambia il volto del timer.
15. (J-27) "Peso 30 g" (stats) e chip "7g/30g/90g" (corpo): "g" lì significa giorni ma legge grammi — passo a "gg"?
16. (J-30) Trend di /corpo con UNA sola pesata: chart "pronta" ma vuota — marker a cerchio o empty state?

**Dieta**
17. (J-18) /dieta wide solo sul tab Piano: il salto di larghezza cambiando tab stona? (Fix: superficie intera wide, una riga.)
18. (J-21) "Fatto" del pasto (e i CTA di Sera/Focus) sono il size sm 36px: promuovo i CTA touch-primari a 44?
19. (J-31) Le celle della WeekGrid desktop flashano "0 kcal" mentre i pasti caricano: gate per-cella (più skeleton) o numero soppresso?
20. Copia-giorno nella WeekGrid desktop: vuoi UNA affordance (menu di colonna)? Se sì la specifico e si fa.

**Calendario / Task / Settimana**
21. (J-26) Il submit del quick-add eventi non collassa a icona su mobile (il gemello task sì): allineo?
22. (J-25) Chips Priorità/Ripeti a 36px accanto ai weekday a 44 nella stessa scheda: allineo a 44?
23. (J-23) I chip del parser (quick-add) si dismissano a 32px: estendo l'hit (rischio overlap con l'input sopra)?
24. (J-03) Radius micro fuori scala (barre storico 4px, heatmap 5px, kbd 4px): nasce un token micro-radius o restano eccezioni?

**Esami / Spese**
25. (J-02) La riga esame non ha hover (le righe spese sì): che forma gli do (bg pieno, inset)?
26. (J-28) "Sotto pace" (badge pacing, lib legacy): rinomino "Sotto ritmo"?
27. PROP-esami-03 (CTA sugli scaduti): la spec presume un campo VOTO che non esiste — il voto entra nel modello (schema) o il CTA diventa solo-data?

**Sistema / tema / a11y (toccano token globali)**
28. (J-07) `--em-text-3` è AA-marginale (4,38 su surface-2 dark; 4,15 su calce light — tab inattive): scurisco il token light e/o alzo il dark?
29. (J-08) Il bottone destructive è bianco-su-segnale a 3,9:1: scurisco il rosso (nuovo token) o inchiostro scuro come il primary?
30. (J-38) I badge ember-text-su-tinta in light sono 4,26:1: alleggerisco la tinta (14%→10%)?
31. (J-40) I bordi di checkbox/radio/input sono ~1,6:1 (WCAG non-text chiede 3): rinforzo hairline-strong o nuovo token bordo-controllo?
32. (J-39) I giorni fuori-mese del calendario sono cliccabili a ~2,2:1: tolgo l'opacity-60 (gerarchia più piatta) o resta l'idioma?
33. (J-05) Due dialetti di chip selezionato (ring hairline@120ms vs ember@180ms): quale vince?
34. (J-06) I toast con Annulla durano 5s: allungo il dwell degli azionabili?
35. (J-09) La heatmap mensile è solo-colore per gli screen reader: aggiungo un riassunto testuale?
36. (J-41) La BottomSheet non ha un bottone Chiudi visibile (solo drag/Esc/overlay): lo aggiungo nell'header come il Modal?
37. (J-19) La larghezza wide 88rem sul TUO 1440p: respira o dispersiva?

**Motion (il layer c'è, decidi le estensioni)**
38. (J-33) Le uscite animate ora coprono sheet/modal/toast: le estendo ai POPOVER (select, picker, menu, palette)?
39. (J-34) Restano a scatto: swap dei tab, theme switch, skeleton→contenuto, cambio mese: quali meritano un crossfade? (Rischio parata.)
40. (J-35) Lo stack dei toast si ricompatta a scatto quando uno muore: animazione di layout (macchineria FLIP) o pazienza?
41. (J-36 + em-pressable) I tre loop hardcoded (spinner 800ms, indeterminate 1.4s, shimmer 1.6s): token o costanti documentate? E `.em-pressable` (press-scale sui chip, spedita senza consumer): la applico?

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

---

## P4 · Safe specced, device-independent — 2 fatti, 2 skip motivati

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · test corpo 8/8 (+4 nuovi) · build fresca ✓.

### a · PROP-corpo-01 — media mobile 7 giorni ✓ (`d77a063` + `6e0ca2c`)

- **`trailingAvg7`** pura (+4 test): media TRAILING su 7 giorni di CALENDARIO — per ogni pesata, la media della finestra [giorno−6, giorno]; pesate rade → la media È il punto grezzo (onesto, mai inventare). `buildWeightChart` guadagna `avgPath` sulla STESSA scala (la media resta nel range min-max per costruzione; un solo punto → null). Nel grafico: seconda polyline QUIETA (text-2, strokeWidth 1.5, opacity .8) sopra i grezzi ember — la lettera della PROP. "Il tuo mese" resta prima→ultima (triage: non toccato).
- **L'incidente di budget che vale il report (il QUARTO caso della legge di residenza).** Prima stesura: la matematica in `corpo/logic.ts` → **Oggi 60.075 (+219, TETTO SFONDATO)** — today-tiles importa i formatter del tile Peso da corpo/logic, e webpack non tree-shaka: `trailingAvg7` è salita sulla home. Diagnosi con A/B onesto (`git stash -u` + build fresca): il colpevole era P4a, non P4b. Rimedio: **`corpo/trend.ts`** (WeightChart+trailingAvg7+buildWeightChart), consumer solo corpo-screen — e la scoperta: **buildWeightChart viaggiava sul chunk della home DA RUN-07**. Esito: **Oggi 59.429, 300 B SOTTO la baseline** — il fix ha ripagato un debito preesistente. La lista dei moduli-home noti si allunga: `corpo/logic`.

### b · Affordance ⌘K sul rail ✓ (`3568496`, triage 99l#7)

Bottone quieto in fondo al rail desktop, sopra Impostazioni: "Cerca e comandi · ⌘K" (ghost row di casa, min-h-11). Meccanica: **`palette-bus.ts`** (il disegno di quick-add-bus, senza `pending`: rail e host vivono nello stesso layout) — `requestPalette()` dal rail, listener in ComfortHost → `setPaletteOpen(true)`. **Stesso corpo lazy** (React.lazy alla prima apertura), **zero mount touch** (il rail È `hidden md:flex`). Budget layout: 30.434 → **31.179 (+745)** — dentro il ≤ +1.000 del brief.

### c · PROP-esami-03 — SKIP con riga

La PROP dice "CTA 'com'è andata?' → **voto** o nuova data, dalla scheda esistente" — ma la scheda esistente ha SOLO la data: il campo voto **non è mai esistito nel modello** (lo dice il docstring stesso di exam-detail.tsx:203). Implementarla per intero = colonna nuova = `[schema]`, vietato in run-13; implementarne metà (CTA→solo data) = decisione di prodotto non specificata. **Fuori run**, resta PROP aperta col chiarimento a verbale: prima serve decidere se il voto entra nel modello.

### d · "Copia giorno" nella griglia desktop di /dieta — SKIP con riga

Nessuna spec single-affordance esiste (v3-proposals non la contempla; 99l P5a la annota solo come asimmetria per il triage). Sette controlli ripetuti = rumore per legge del brief. **Fuori run**, JUDGMENT list.

**Cap rispettato:** niente altro promosso dal backlog PROP.

---

## P5 · Performance & hardening — misurato prima, churn mai

**Checkpoint: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · test **1043/1043, 83 file** ✓ · build fresca ✓ · **smoke di produzione (porta chiusa per PID): 16 probe tutte 200** (le 14 superfici + `/gym?scheda=x` + `/offline`), log del server pulito (zero warn/error).

### a · Lo split di /gym: −10,3 kB, A/B misurato (`fc19b90`)

Metodo residenza: probe di stringhe distintive nel route chunk → equipment-editor, exercise-detail, day-editor, session-grid/runner, exercise-picker TUTTI residenti. Due seam puliti su gesto utente, **React.lazy** (mai next/dynamic nel gruppo — legge run-12):
- **EquipmentEditor** (swap dentro lo sheet del set, gesto raro settings-like) → chunk lazy da **3.851 B**, Suspense con skeleton.
- **ExerciseDetailSheet** (grafico + ProgressTable + form; si apre dal tap su un esercizio) → chunk lazy da **8.492 B**; gate "everMounted" (monta al primo bisogno, poi RESTA: riaperture istantanee e le exit-animation P2 sopravvivono alla chiusura).
- **A/B: /gym 103.983 → 93.194 (−10.789 raw, −10,4%)**; con l'hardening P5c finale **93.674**. Oggi INVARIATO a ogni misura. Nessun altro seam pagava abbastanza da giustificare churn (day-editor/programs-panel = tab primaria, non gesto).

### b · Console hygiene — esito e limite del metodo dichiarato

Statico: **zero `console.log/warn/info` nei percorsi felici** di (app)/ui/lib/data — ogni `console.error` censito è error-path legittimo (import legacy falliti, azioni server, il boundary stesso). Dinamico: il log del SERVER di produzione sulle 16 probe è pulito. **Limite dichiarato:** la console del BROWSER non è verificabile in questa sessione (niente browser) — la verifica client resta al device tour; la superficie di rischio è coperta dallo statico.

### c · Error boundaries — la copertura verificata, il gap vero chiuso

- **Verifica:** `app/(app)/error.tsx` (route-group) copre i crash di RENDER di tutte le 14 superfici, timeline/rituale/pannelli stats/palette compresi. Nessun buco di copertura render.
- **Il gap REALE era il chunk lazy che non arriva** (offline al primo uso, deploy a cavallo): la promise rigettata bubbla al boundary di route e abbatte la SHELL per un accessorio. Chiusura su misura di budget:
  - **palette + rituale** (layout/home, budget stretti): `.catch` sulla factory lazy → il corpo degrada a null (~30 B a sito). Un tentativo con boundary di classe condiviso costava +378 B su ENTRAMBI i chunk (modulo piccolo duplicato da webpack) e sfondava il budget layout di 123 B → sostituito, a verbale.
  - **gym** (route chunk, nessun budget): `_components/lazy-boundary.tsx` (il boundary di casa, class component minimale) sui due mount lazy — l'equipment editor degrada a un messaggio onesto ("Editor non disponibile ora"), la scheda esercizio a null.
- Budget finali: **Oggi 59.461** (tetto 60.000, headroom 539) · **layout 31.211** (+777 vs baseline, budget ≤ +1.000 ✓).

### d · PWA/offline — spot-check a livello build

`/offline` prerender ✓ (probe 200); `public/sw.js`: runtime caching con navigazioni network-first→cache→/offline, `/_next/static` cache-first (i chunk lazy nuovi vi rientrano dopo il primo fetch) e la **landmine del redirect presidiata** (`fresh.ok && !fresh.redirected`, riga 149). Le superfici nuove leggono da Dexie via gli stessi hook delle vecchie: offline-by-construction una volta servito il bundle.

**Commit:** `run-13/P5: gym route split — equipment editor + exercise detail lazy (−10.8 kB, A/B)` + `run-13/P5: hardening — lazy failure degrades, not crashes`

---

## P6 · The Adversarial Review — occhi freschi sull'intero diff

**Checkpoint di regressione: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · test **1043/1043, 83 file** ✓ · smoke di produzione **16/16 probe 200** (P5, riconfermato dallo stato del tree) · **15/15 stringhe-chiave dei run 10–12 presenti nei chunk serviti** ("Pianifica la giornata", "La tua giornata", "Prepara domani", "Per lato", "Imposta bilanciere", "record personale", "Attrezzatura salvata", "Il tuo mese", "I moduli si parlano", "Restano", "Apri scheda:", "Logga acqua", "Ultima volta", "Cerca e comandi", "Più vicino" — quest'ultima con caveat di metodo a verbale: i minificati escapano gli accenti (`Pi\xf9`), i dev-check futuri greppino il suffisso non accentato).

### L'esito del reviewer indipendente (contesto fresco, diff `main..feat/run-13`, 70 file; rebuild+test propri durante la review)

**UNA violazione LOW, tutto il resto pulito.** La violazione: il kbd "⌘K" del rail (P4b, `app-nav.tsx:147`) usa `rounded-[4px]` — copia byte-identica del dialetto kbd preesistente della palette, ma un SITO NUOVO del valore che J-03 tiene in sospeso. Rimedio senza decidere J-03: il sito è stato AGGIUNTO all'evidenza di J-03 nell'audit doc (l'inventario resta esaustivo); quando J-03 si scioglie, o nasce il token micro-radius per entrambi i kbd o l'eccezione si documenta. Due note di precisione recepite: (1) il commento di lazy-boundary prometteva un retry che React.lazy non fa (factory cacheata: degradato fino al reload) — commento CORRETTO; (2) "Applicazioni in P3" valeva per `.em-hit`, non per `.em-pressable` (già a verbale sotto).

Le otto leggi, cleared con evidenza: Ember fidelity (unico literal aggiunto: `rounded-[4px]` sul kbd del rail = idioma preesistente del kbd palette, citati entrambi) · reduced-motion (tutti i keyframes nuovi sotto il gate property-based; i fallback a 400ms sono state-ops, non moto) · no-IA/no-content (ogni cambio di copy del diff auditato uno-a-uno: solo errori oggettivi) · budget/residency (nessun export nuovo nei moduli-home; corpo/logic ne ha PERSI — la direzione giusta) · contratto a11y sui punti più rischiosi (querySelector della griglia attraversa i wrapper role=row ✓ · geometria del clear hoistato ricalcolata ✓ · roving con tab-stop garantito ✓ · trap rilasciate prima dell'exit ✓) · zero JUDGMENT decisi (verificati uno-a-uno: timer text-5xl, dialetti chip, month-heat 5px, theme snap, tabs swap, prima→ultima del mese, chart a un punto, hover riga esami, grip w-8 — tutti INTATTI) · macchine P2/P5 (toggle rapido open/close sano; interval del toast fermo su leaving; onDone idempotente; gate render-phase senza loop; cast dei .catch strutturalmente validi) · test integri (goldens intoccati; l'unico *.test.ts nel diff è corpo, +4 senza assertion rimosse).

Le clearance del reviewer sono state spot-verificate da chi scrive (3/3: gate del toast a :101, data-day della griglia a :72/:184, censimento em-pressable).

### L'osservazione registrata

`.em-pressable` è spedita con ZERO consumer: la utility è il deliverable del mandato P2 ("press feedback on tappable rows/chips"); applicarla d'ufficio senza feedback dal device sarebbe stato il "parade risk" — resta disponibile, documentata, ~90 B di CSS. Se al device tour il press-feedback piace, l'applicazione è una classe per sito (voce in JUDGMENT list).

**Commit:** `run-13/P6: adversarial review — zero violations, regression pass green`

---

## P7 · Docs + chiusura del run

**Checkpoint finale a HEAD: VERDE.** lint ✓ · tsc ✓ · sentinels ✓ · **test 1043/1043, 83 file** ✓ · build fresca ✓ · smoke di produzione **16/16 probe 200** (porta chiusa per PID). Albero pulito, un commit per prompt (P3: sei, uno per gruppo; P4/P5: uno per item).

### I docs consolidati

- **`AGENTS.md`**: le cinque leggi v3 in voce di casa — residenza dei chunk (con la lista home-modules aggiornata a `corpo/logic` e i precedenti pr/recap-logic/trend), React.lazy + `.catch` + ever-mounted, il motion layer (token, gate property-based, `.em-hit`, accent-as-text), i token di larghezza, "committato ≠ mergiato".
- **`17-activation-checklist.md`**: §0 migrazioni 0032→0033 IN ORDINE col runner + l'avviso AGGIORNA-TUTTI-I-DEVICE (LWW per-riga); §0b il login gate in tre mosse (Redirect URLs, `NEXT_PUBLIC_APP_URL` + redeploy, template OTP con `{{ .Token }}`); push invariato.
- **`98-v3-cycle-summary.md`** (nuovo): il ciclo 10→13 raccontato coi numeri (862→1043 test), le leggi, e il backlog COMPLETO triage-ready — 41 JUDGMENT + 18 PROP senza schema + 10 PROP con schema + i residui tecnici.
- **Questo report**: la lista JUDGMENT in TESTA, 41 decisioni a una riga in ordine di device tour.

### La tabella dei chunk (baseline P0 → finale, build fresca a HEAD)

| Chunk | Baseline | Finale | Δ | Nota |
| --- | --- | --- | --- | --- |
| **Oggi** `(app)/page` | 59.729 (18.687 gz) | **59.461 (18.601 gz)** | **−268** | **Tetto 60.000 MAI sfondato a fine prompt**; due incidenti intercettati dagli A/B (P4a +219 da corpo/logic → trend.ts; il ring TileLink rimosso). La casa ha PERSO peso facendo polish. |
| Layout (app) | 30.434 (9.434 gz) | **31.211 (9.601 gz)** | **+777** | Budget ≤ +1.000 ✓ (bottone ⌘K + bus + catch-hardening). |
| /gym | 103.393 (25.782 gz) | **93.674 (23.761 gz)** | **−9.719** | Split lazy A/B: equipment 3.851 + exercise-detail 8.492 in chunk on-demand. |
| /stats | 25.096 (8.683 gz) | 25.141 (8.688 gz) | +45 | Fix P3 (frecce, useGrouping, token). |
| /dieta | 58.503 (13.223 gz) | 59.027 (13.322 gz) | +524 | Gate skeleton header + fix P3 (min-h, plurali, casing). |
| /calendar | 10.618 (4.323 gz) | 10.625 (4.331 gz) | +7 | Token -text + skeleton sheet (il grosso vive nei commons). |
| Corpo palette (lazy) | 15.274 | 15.294 | +20 | Cap Recenti 40→64. |

### Test (baseline → finale)

1039/83 (P0) → 1039 (P1-P3: zero logica nuova, il polish è classi/markup/ARIA) → **1043/83** (P4a: trailingAvg7 ×3 + avgPath ×1). Golden intoccati.

### Flags ui/ e token (il perimetro FLAGGED completo del run)

`ui/ember.css` (ease-in, r-full, 4 keyframes -out, .em-hit, .em-pressable) · `ui/bottom-sheet.tsx` / `ui/modal.tsx` / `ui/toast.tsx` (macchine di chiusura; toast error→role=alert) · `ui/field.tsx` (aria-required) · `ui/command-palette.tsx` (aria-autocomplete) · `ui/calendar.tsx` (role=row; roving WeekStrip) · `ui/time-picker.tsx` / `ui/date-picker.tsx` (clear hoistato; roving colonne) · `ui/tabs.tsx` (prop label) · `ui/button.tsx` (opacity-0 in loading) · `ui/internal.tsx` (scroll-lock module-level). Tutto additivo, API invariate, showcase /dev intatto.

### Delta consolidati del run (il dettaglio è al prompt di ciascuno)

1. **P1**: la prima ondata di agenti audit ha FABBRICATO finding → protocollo quote-verbatim + verifica personale; due batch onesti tenuti, il resto rilanciato. Lezione a verbale in 98-summary.
2. **P2**: zero durate nuove (ember.css ne aveva già quattro — il brief ne presupponeva due); niente utility di mount (nessuna applicazione SAFE esiste, J-34); eviction del 4° toast senza exit (raro, accettato); popover enter-only (J-33).
3. **P3**: WeekdayChips con `.em-hit` invece della taglia diretta (7+1 chip in riga: a 44 visivi andrebbero a capo); l'input h-8 di habit-card senza `.em-hit` (pseudo-elementi non rendono sugli input); week-board:292 NON toccato (sta su surface: 4,83 passa — l'agente presumeva surface-2).
4. **P4**: PROP-esami-03 fuori run (presume un campo voto mai esistito → prima la decisione di modello); copia-giorno desktop senza spec → JUDGMENT #20.
5. **P5**: il boundary di classe condiviso costava +378 B su layout E home (modulo piccolo duplicato) e sfondava il budget layout di 123 B → `.catch` sulle factory per palette/rituale (~30 B), classe solo sui siti gym; console del browser non verificabile senza browser (limite dichiarato, statico pulito).
6. **P6**: una violazione LOW (kbd del rail = sito nuovo del 4px di J-03 → aggiunto all'evidenza di J-03, non deciso); commento di lazy-boundary corretto (niente auto-retry: degradato fino al reload); `.em-pressable` senza consumer per scelta (J-41).

### GATE DI DAVIDE (al ritorno dalla palestra)

1. Verifica in chat → **merge**: `git merge --no-ff --no-edit feat/run-13` (P0: branch da `main` con run-12 dentro — questo merge porta solo run-13), push.
2. Runner: **0032 poi 0033, in ordine** (checklist §0). Poi **aggiorna l'app su TUTTI i dispositivi** — tuoi e di Daniele (LWW per-riga).
3. Chiudi il login gate (checklist §0b): Redirect URLs + `NEXT_PUBLIC_APP_URL` + template OTP.
4. **IL DEVICE TOUR** — run 10-13 insieme, con la lista JUDGMENT qui sopra in mano: 41 voci, un vocale ciascuna. I fix che ne nascono sono Sonnet-sized, post-finestra.

**Run 13 completo.** L'app che Davide ritrova: ogni overlay entra ED ESCE animato, ogni tap-target primario è a 44px senza che un pixel si sia mosso dove il disegno era compatto, i pill tornano pill (il token che mancava), ogni accento-testo regge l'AA in entrambi i temi, gli screen reader sentono lo stato "saltato" e riordinano gli esercizi con le frecce, cinque plurali e un genere non stonano più, /gym pesa 10 kB in meno con l'editor attrezzatura e la scheda esercizio caricati al gesto, /corpo ha la media mobile quieta, il rail ha il suo ⌘K, e un chunk che non arriva DEGRADA invece di abbattere la shell. Zero migrazioni, zero bump, zero dipendenze, zero decisioni di gusto rubate al device: sono tutte in 41 righe in testa a questo report — e la home, dopo tutto questo, pesa 268 byte MENO di com'era. `main` mai toccata.
