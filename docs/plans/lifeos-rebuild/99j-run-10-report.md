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
