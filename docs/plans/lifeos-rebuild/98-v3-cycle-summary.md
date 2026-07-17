# LifeOS v3 — Sintesi del ciclo (run 10 → 13)

Data: 2026-07-17 · Stato: chiusura della finestra v3; input per il triage del prossimo ciclo.
I dettagli per-prompt vivono nei report: `99j` (run-10) · `99k` (run-11) · `99l` (run-12) · `99m` (run-13) · l'audit di craft in `v3-craft-audit.md`.

---

## Cosa ha costruito il ciclo, run per run

- **Run-10 — «Fondamenta di prodotto»**: l'audit di prodotto (v3-proposals.md, 477 righe); la palestra scheda-centrica (card per giorno, griglia storica, deep-link `/gym?scheda=`); i token di larghezza per-pagina (lettura vs `--em-page-wide` 88rem via `:has()`); otto quick win (undo su abitudini/agenda/spese/capitoli, "Ultima volta" nel micro-editor, "Più avanti", tile tappabili, skeleton Impostazioni).
- **Run-11 — «La giornata guidata»**: il rituale del mattino (rollover, stime, playlist, capacità — invito mai cancello, corpo lazy); la timeline unica di Oggi (Agenda+Adesso convergono, cursore adesso, marker palestra/pasti); la chiusura serale (recap coi numeri veri, "Prepara domani"); i moduli si parlano (slot→scheda, dieta×allenamento, brief col piano, esami su Oggi). Schema: 0032 (estimate_min, training), Dexie v12.
- **Run-12 — «Palestra pro, i numeri, la craft bar»**: plate calculator (subset-sum in grammi interi, profilo attrezzatura sincronizzato su lo_settings — 0033, zero bump Dexie); il momento PR al set + marcatore storico; /stats elevata (4 correlazioni oneste, pannello dieta, delta settimanali, "Il tuo mese" navigabile); command palette ⌘K (corpo lazy, ranking, schede per nome, "Logga acqua" con undo); desktop che spende la larghezza (griglia settimanale dieta, calendario a due pannelli); "Restano N kcal" in /dieta.
- **Run-13 — «La passata di craft»**: l'audit multi-agente (34 SAFE fixati, 41 JUDGMENT catalogati); il motion layer (easing d'uscita, exit animation su sheet/modal/toast, `.em-hit`, `--em-r-full` che guarisce 8 siti); il consistency pass (tap target ≥44, palette-cruda→token -text, skeleton mancanti, 5 plurali, contratti ARIA di listbox/menu/grid/field); media mobile 7g su /corpo + bottone ⌘K sul rail; /gym −10,3 kB (split lazy misurati A/B); hardening dei lazy (degradano, non crashano); questi docs.

## I numeri del ciclo

| Metrica | Inizio run-10 | Fine run-13 |
| --- | --- | --- |
| Test | 862 / 71 file *(baseline 99j)* | **1043 / 83 file** |
| Oggi (route chunk raw) | 47.845 → congelato 59.729 (r12) | **59.461** (tetto 60.000) |
| Layout (app) | 38.370 | **31.211** |
| /gym | 86k pre-r10 → 103.393 (r12) | **93.674** (−10,3 kB in r13) |
| /stats | 10.894 | **25.096** (l'elevazione r12) |
| /dieta | 52.271 | **58.503** |
| Migrazioni scritte (mai applicate) | — | **0032, 0033** (runner: in ordine dopo 0031) |
| Dexie | v11 | **v12** (un solo bump nel ciclo) |
| Dipendenze nuove | 0 | **0** |

## Le leggi imparate (ora in AGENTS.md)

1. **Residenza dei chunk**: webpack non tree-shaka tra moduli; export nuovi in moduli che la home non importa (home-modules noti: gym/logic, gym/card-history, stats/logic, corpo/logic, _components/*). A/B onesti con `git stash -u` + build fresca.
2. **React.lazy, mai next/dynamic, nel gruppo (app)**; factory con `.catch` (il chunk che non arriva degrada); sheet ever-mounted perché le exit-animation sopravvivano.
3. **Il motion layer**: enters ease-out, exits ease-in più corte; il gate reduced-motion è property-based e copre tutto automaticamente; `.em-hit` per i tap-target senza cambiare un pixel; accent-as-text SOLO con le varianti `--em-*-text`.
4. **Larghezza per-pagina**: `data-page-width="wide"` dove la larghezza si spende.
5. **"Committato ≠ mergiato"**: il P0 verifica il merge-state da `main`, mai fidarsi del brief.
6. **Gli audit si fanno con quote verbatim verificate** — gli agenti senza obbligo di citazione fabbricano finding plausibili (incidente run-13 P1, protocollo a verbale).

## Il backlog COMPLETO per il triage (niente è perso)

### Decisioni da device (la lista JUDGMENT di 99m, in testa a quel report)
J-01…J-41 — le domande a una riga rispondibili dal telefono: rituale/ora, marker vs pannelli, "+8 giorni", chips stima, attrezzatura reale, PR solo-peso, soglie correlazioni, salto wide di /dieta, 88rem dal vivo, coalescing acqua, CTA sm→md, grip w-8, timer text-5xl, dialetti chip, micro-radius, toast azionabili, token text-3/destructive/hairline (AA), tinte light, heatmap AT, dismiss della sheet, exit dei popover, tabs/theme/skeleton-swap animati?, reflow toast, loop tokens, Pulse morto, em-pressable da applicare?, "Peso 30 g", "Sotto pace", streak-row, chart a un punto, flash 0-kcal della WeekGrid, CLS del brief, quick-add eventi collassato, altezze Priorità/Ripeti.

### PROP aperte senza schema (Sonnet-sized, pronte)
PROP-task-04/WOW-12 (triage tastiera) · PROP-cal-01 (vista settimana) · PROP-cal-03 (eventi in testa a /tasks) · PROP-cal-05 (scorciatoia nuovo evento) · PROP-gym-06 (timer recupero opt-in, contro-design: solo se richiesto) · PROP-hab-03/WOW-08 (traguardi streak) · PROP-hab-04 (board 2 colonne) · PROP-focus-01 fase 1 (focus su task, contesto) · PROP-focus-02 (barre 14g) · PROP-focus-03 (spacebar) · PROP-diet-02/WOW-04 (recenti extra) · PROP-diet-03 (carbo/grassi visibili) · PROP-spese-02 (delta mese) · PROP-imp-02 (consolidamento import) · WOW-11 (logbook) · entry point MOBILE della palette · copia-giorno nella WeekGrid desktop (serve la spec single-affordance) · stamp rituale cross-device.

### PROP aperte CON schema (una migrazione ciascuna, da raggruppare)
PROP-task-03 (ricorrenze mensili) · PROP-cal-04 (ricorrenza eventi) · PROP-gym-05 (marker set, valore L) · PROP-hab-05 (schedule N/settimana) · PROP-focus-01 fase 2 (task_id su FocusSession) · PROP-sera-02 ("domani" vero — il cuore dello shutdown) · PROP-spese-03 (budget categorie) · PROP-corpo-02 (obiettivo peso) · CROSS-01 fase 2 (module_link sullo slot) · PROP-esami-03 (CTA scaduti — PRIMA decidere se il campo voto entra nel modello).

### Residui tecnici
Il rimescolo commons di /stats (~3,2k, contabilità da rimisurare se serve il conto pulito) · il sistema Pulse morto in globals.css (ritiro = run di pulizia legacy) · i tre loop hardcoded (spinner/indeterminate/shimmer: token o costanti documentate) · PROP-oggi-02 residuo (promozione/retrocessione sezioni per fascia).

## Il gate di attivazione (Davide)

`17-activation-checklist.md` aggiornata: §0 migrazioni 0032→0033 IN ORDINE + aggiornare TUTTI i device dopo l'apply (LWW per-riga) · §0b login gate (Redirect URLs, `NEXT_PUBLIC_APP_URL`, template OTP con `{{ .Token }}`) · push §1-8 come da run-09.
