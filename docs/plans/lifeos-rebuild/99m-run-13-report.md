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
