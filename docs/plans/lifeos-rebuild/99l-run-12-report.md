# Run 12 — Palestra Pro, I Numeri, La Craft Bar (Set B + WOW)

**Modello:** Fable 5, effort max. **Sessione:** non presidiata, auto mode.
**Branch:** `feat/run-12` (da `main` @ `ff17b91`, che contiene run-11 mergiata). Mai pushato, mai mergiato.
**Brief:** run-12 — Set B "Palestra pro + numeri" (§4: plate calculator, PR al set, correlazioni native, "Il tuo mese") + il layer craft/WOW (§3: command palette ⌘K) + i layout desktop rimandati da run-10 (dieta a griglia, calendario due pannelli, "ne restano" in /dieta). Regola cardinale: **il chunk di Oggi è CONGELATO a 59.729 B raw** — tutto ciò che nasce in questo run vive in /gym, /stats, /dieta, /calendar o nel layout (solo shell palette, corpo lazy). P7 prova Oggi byte-identico o ridotto.

Questo report è fence-exempt e viene aggiornato a ogni prompt.

---

## P0 · Pre-flight gate

**1. Clean tree.** `git status --porcelain` → vuoto. ✓

**2. Merged-state check (la lezione run-11).** Da `main`: `git ls-files docs/plans/lifeos-rebuild | grep 99k` → `99k-run-11-report.md` PRESENTE. `main` @ `ff17b91` = "Merge branch 'feat/run-11'" — run-11 (e con lei run-10) è mergiata. **Caso pulito: `feat/run-12` branchata da `main`.** Nessun delta di lineage, un solo merge al gate.

**3. Branch.** Creato `feat/run-12` e switchato. ✓

**4. Baseline verde PRIMA di ogni edit (dalla radice, come da AGENTS.md).**
- `npm run lint` → pulito ✓
- `npm run typecheck` → pulito ✓
- `npm run lint:sentinels` → pulito ✓ ("no personal-data sentinels found")
- `npm test` → **Test Files 78 passed (78) · Tests 998 passed (998)** ✓ — al numero l'atteso del brief (~998/78) e il finale run-11.
- `npm run build` → ✓ (webpack, build fresca dopo `rm -rf .next`, tutte le route presenti)

**Baseline di dimensione (metodo 99h: chunk client della route, raw + gzip).**

| Chunk | File | Raw | Gzip | Nota |
| --- | --- | --- | --- | --- |
| **Oggi** `(app)/page` | `page-21696031733f0d65.js` | **59.729 B** | 18.689 B | **= il numero CONGELATO del brief, al byte.** Tetto: ≤59.729. |
| Layout `(app)` | `layout-27f267e27f7fbf5e.js` | **38.370 B** | 11.989 B | = atteso brief. Budget run: ≤ +2.500 B raw (shell palette). |
| /gym | `page-ae7f72034eaec2ed.js` | 96.527 B | 23.927 B | Brief dice ~96.163 (misura 99j post-P2 run-10): **+364 B di drift run-11** — delta dichiarato, la baseline vera di questo run è 96.527. |
| /stats | `page-8af6ba278f87770b.js` | 10.894 B | 4.180 B | Nessun budget formale; registrato. |
| /dieta | `page-b82f75ee6d188924.js` | 52.271 B | 11.503 B | Idem. |
| /calendar | `page-9c28585efb65fd0c.js` | 10.425 B | 4.270 B | Idem. |

**5. Letture (per intero, in ordine):** `AGENTS.md` · `docs/plans/lifeos-rebuild/v3-proposals.md` (477 righe — Set B §4, WOW §3, PROP-diet-05, PROP-cal-02, PROP-diet-01) · `99k-run-11-report.md` (282 righe).

**Delta brief ↔ documenti:**
1. `/gym` baseline: il ~96.163 del brief è la misura 99j (run-10 P2); run-11 ha mosso il chunk a 96.527 senza registrarlo (nessun prompt gym in run-11 — drift da moduli condivisi). Registrato qui, nessuna azione.
2. Il brief run-12 dice "PROP-gym-03 profilo per-dispositivo, localStorage come il chime"; il P1 di questo brief indica invece la casa naturale nel profilo SINCRONIZZATO (colonne nullable sulla riga profilo esistente). Il brief vince su scope/invarianti (il P1 decide); delta annotato per il P1.
3. Set B in v3-proposals include anche PROP-stats-01 (DeltaChip), PROP-stats-02 (pannello dieta in stats), PROP-corpo-01 (media mobile) — il brief li assorbe in P3a/b ("DeltaChip finally used", "diet becomes visible in /stats"); PROP-corpo-01 non è nominata dal brief run-12 → resta fuori set salvo spazio, delta al P3.
4. Domande aperte 99k rilevanti qui: i marker timeline che doppiano i pannelli (possibile fonte di byte se Oggi dovesse dimagrire — NON necessario: il run non tocca la home) e il budget home a 271 B dal tetto (questo run lo CONGELA invece di spenderlo).

Pre-flight PASS.

**Commit:** `run-12/P0: preflight + baseline`
