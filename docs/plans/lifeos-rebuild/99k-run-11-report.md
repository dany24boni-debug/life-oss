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
