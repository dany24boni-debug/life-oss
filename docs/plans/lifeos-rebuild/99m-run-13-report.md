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
