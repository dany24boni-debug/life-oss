# LifeOS v3 — Craft Audit (run-13, P1)

Data: 2026-07-17 · Autore: Claude (Fable 5, run-13) · Stato: input per P2/P3 di run-13; i JUDGMENT confluiscono nella lista del report 99m.

**Metodo.** Sette dimensioni di caccia (stati d'interazione mancanti · drift tipografico/spaziale vs token Ember · parità dark/light · gap skeleton/empty · transizioni incoerenti · tap target < 44 px · copy it-IT oggettivamente sbagliata) su cinque gruppi di superfici + due passate trasversali (contratto a11y con rapporti di contrasto calcolati; inventario completo del motion). Agenti paralleli con obbligo di citazione verbatim; **ogni finding qui sotto è stato ri-verificato nel sorgente da chi scrive** (grep/sed sulle righe citate) — i batch che non hanno superato la verifica sono stati scartati e rilanciati (nota di processo nel 99m).

**Classi di rischio.** `SAFE` = oggettivamente migliore, zero gusto (lo fissa questo run, P2/P3). `JUDGMENT` = gusto/prodotto/valore di token globale — NON si tocca in run-13; va alla lista decisioni del 99m. Nel dubbio: JUDGMENT.

**Severità.** H = rotto o violazione a11y su percorso primario · M = spigolo evidente · L = finitura.

---

## Le famiglie sistemiche (un fix, N siti)

### F1 · `--em-r-full` non esiste — i pill rendono quadrati — `SAFE · M`
`rounded-[var(--em-r-full)]` è usato in **8 siti** ma il token non è definito da nessuna parte (ember.css ha solo `--em-r-sm/md/lg/xl`): `border-radius` è invalid-at-computed-value → **0**. I "cerchi" 1–5 dell'energia di Sera, il badge pacing di /esami e i chip categoria di /spese (min-h-11!) rendono **quadrati**; le barre perdono le estremità tonde. Il gemello funzionante è `rounded-full` (ProfileChip).
- Siti: `sera/sera-screen.tsx:350` · `esami/esami-screen.tsx:265,293,297` · `spese/spese-screen.tsx:107,111,278,293`.
- Fix: **P2** definisce `--em-r-full: 9999px` accanto agli altri radius (una riga, 8 siti guariti). `FIXED-IN-RUN-13 (P2)`

### F2 · Palette cruda usata COME testo — parità light + contrasto AA — `SAFE · M/H`
`--em-ember/salvia/segnale` sono i FILL; per il testo esistono le varianti `--em-*-text` ("accent used AS text on dark: lifted for contrast", rimappate in light). I siti che colorano testo col crudo falliscono AA in light (`#6fa96f`/`#ff6b35` su bianco ≈ 2,8:1; `#e5484d` ≈ 3,9:1) e alcuni anche in dark:
- `esami/esami-screen.tsx:166-172` (`STATUS_TONE`) applicato come `color:` a `:267` — il badge pacing. Split: `STATUS_TEXT` per il testo, tone crudo resta a barra/tinta. `FIXED-IN-RUN-13 (P3)`
- `calendar/calendar-screen.tsx:243` (errore sync) · `calendar/page.tsx:58,67` (banner esito import). `FIXED-IN-RUN-13 (P3)`
- `gym/progress-table.tsx:189-190` (Δ ▲/▼) · `gym/session-grid.tsx:557` (chip recupero a target). `FIXED-IN-RUN-13 (P3)`
- `abitudini/habit-card.tsx:126` (streak) · `:139` ("Fatta"). `FIXED-IN-RUN-13 (P3)`
- `corpo/corpo-screen.tsx:334` (delta peso; nel fix collassato il ternario ridondante 335-337). `FIXED-IN-RUN-13 (P3)`
- `impostazioni/account-sync.tsx:56` (lastError). `FIXED-IN-RUN-13 (P3)`
- Icone di stato col crudo (minimo non-text 3:1 fallito in light, ~2,8): `_components/today-habits.tsx:139` · `abitudini/habit-sheet.tsx:143` · `dieta/oggi-tab.tsx:458` (IconCheck selezione). `FIXED-IN-RUN-13 (P3)`

### F3 · Tap target sotto il pavimento 44 px — `SAFE` (rimedi per sito)
Due rimedi, scelti per sito: **(a)** taglia diretta dove c'è spazio visivo; **(b)** `.em-hit` (utility P2: estensione dell'area di tocco via pseudo-elemento, **zero cambiamento visivo**) dove la forma compatta è parte del disegno.
- (a) `esami/exam-detail.tsx:174,186` stepper ±1 `size="sm"`=36px che CONTRADDICE il proprio docstring ":8 stepper da 44px" → `md`. `FIXED-IN-RUN-13 (P3)`
- (a) `_components/pwa-install.tsx:202,210` "Installa LifeOS"/"Non ora" `size="sm"` su card touch-only (in Impostazioni le stesse azioni sono md) → drop `size`. `FIXED-IN-RUN-13 (P3)`
- (a) `spese/spese-screen.tsx:58-78` frecce mese ‹ › ghost sm ~31×36 → `min-h-11 min-w-11`. `FIXED-IN-RUN-13 (P3)`
- (a) `_components/tasks/task-detail.tsx:407` cestino sottotask h-9 → h-11 (la riga è già min-h-11). `FIXED-IN-RUN-13 (P3)`
- (a) `dieta/oggi-tab.tsx:333` "Applica" proposta `min-h-9` → `min-h-11` (il sibling a :318 è già min-h-11). `FIXED-IN-RUN-13 (P3)`
- (a) `dieta/piano-tab.tsx:430` "+" della WeekGrid h-9 → h-11. `FIXED-IN-RUN-13 (P3)`
- (a) `dieta/alimenti-tab.tsx:111` summary "Archiviati" ~20px → `flex min-h-11 items-center` + hover di casa. `FIXED-IN-RUN-13 (P3)`
- (a) `focus/focus-screen.tsx:213` chip preset h-9 → h-11 (i vicini MinuteBtn/StepBtn sono h-11). `FIXED-IN-RUN-13 (P3)`
- (a) `gym/gym-screen.tsx:627` chip filtro Libreria h-8 · `gym/exercise-picker.tsx:99` chip gruppo h-8 (il file promette "righe alte 44px+") · `gym/day-editor.tsx:575` "+ aggiungi qui" h-8 · `:717` WeekdayChips h-8 w-8 · `gym/session-grid.tsx:575` campanella chime h-9 w-9 → h-11 (w-11 sui quadrati). `FIXED-IN-RUN-13 (P3)`
- (a) `abitudini/abitudini-screen.tsx:116` "Torna a oggi" testo nudo ~20px → `min-h-11 inline-flex items-center`. `FIXED-IN-RUN-13 (P3)`
- (a) `_components/reminders-cards.tsx:46,67` "Segna tutti letti" (~20px) e "Ok" (~32px) → `min-h-11` (la riga riserva già 44). `FIXED-IN-RUN-13 (P3)`
- (a) `impostazioni/protected-days.tsx:104` "Rimuovi" ~32px → `min-h-11`. `FIXED-IN-RUN-13 (P3)`
- (a) `sera/sera-recap.tsx` · `_components/ritual/ritual-body.tsx:284,338` azioni rollover e chip stima `min-h-9`/`h-9` → `min-h-11`/`h-11` (nel file il pavimento è già min-h-11 ovunque altro). `FIXED-IN-RUN-13 (P3)`
- (b) `abitudini/habit-card.tsx:155` chip +N (gesto primario quantity) · `:253` "totale…" · `:272` input h-8 · `corpo/corpo-screen.tsx:219` chip finestra 7/30/90 h-8 · `_components/tasks/task-detail.tsx:364` "×" tag 24px → `.em-hit` (la pillola resta visivamente h-8; l'area di tocco sale a 44). `FIXED-IN-RUN-13 (P3)`

### F4 · Pop-in dove il pattern Skeleton esiste già — `SAFE · M/L`
Il pattern di casa (Skeleton + `aria-busy`, PROP-imp-01) manca in:
- `calendar/event-detail.tsx:45` — sheet vuota mentre `useEvent` risolve (il gemello task-detail:67 ha lo skeleton). `FIXED-IN-RUN-13 (P3)`
- `esami/exam-detail.tsx:39` · `spese/expense-detail.tsx:36` — stessa cosa. `FIXED-IN-RUN-13 (P3)`
- `gym/exercise-detail.tsx:262` — "Le ultime sedute": eyebrow orfano su vuoto, poi la tabella salta dentro. `FIXED-IN-RUN-13 (P3)`
- `dieta/food-picker.tsx:92-96` — flash "La libreria è vuota…" durante il load (`foods === undefined` collassato a `[]`). `FIXED-IN-RUN-13 (P3)`
- `dieta/oggi-tab.tsx:141-223` — header obiettivi: mostra l'hint "senza profilo" mentre settings/pesata caricano, poi riflow (il gemello corpo è guardato). `FIXED-IN-RUN-13 (P3)`

---

## Finding puntuali (SAFE)

### CRAFT-sera-01 · Recap Palestra può dire "fatta · fatta" — `M`
`sera/sera-recap.tsx:79` fallback `doneDay?.name ?? "fatta"` + `:89` `done={doneGym !== undefined}` + `:112-113` suffisso "· fatta": sessione conclusa senza `program_day_id` (caso supportato) → "fatta · fatta". Fix: sopprimere il suffisso quando il valore È già il fallback. `FIXED-IN-RUN-13 (P3)`

### CRAFT-sera-02 · Link "collega Google dal Calendario" senza hover — `L`
`sera/sera-screen.tsx:386`: l'idioma underline-link di casa porta `transition-colors … hover:text-[…]` (page.tsx:83, sera-recap.tsx:124); questo è l'unico inerte. `FIXED-IN-RUN-13 (P3)`

### CRAFT-shell-01 · "Recenti" della palette non mostrerà mai le schede gym — `M`
`palette/palette-body.tsx:42` filtra i recenti a `length <= 40`; `palette/sources.ts:45` genera id `gym-card:<uuid>` = 45 char → scritti da pushRecent, scartati alla lettura successiva. Proprio la sorgente che il docstring pubblicizza. Fix: cap a 64. `FIXED-IN-RUN-13 (P3)`

### CRAFT-task-01 · Toggle completa/riapri senza aria-pressed — `L`
`_components/tasks/task-item.tsx:228-234`: i due sibling dello stesso concetto (agenda-list TaskCheck, week-board SlotRow) espongono `aria-pressed`; qui manca. `FIXED-IN-RUN-13 (P3)`

### CRAFT-task-02 · Genere di "task" incoerente — `L` (copy, a verbale)
Convenzione dominante maschile ("Fatti" tab, "task completati", "1 task spostato", "task pronti/rimasti/aperti"); fuori coro: `tasks-screen.tsx:195-196` "Fatte oggi"/"Fatte · N", `today-section.tsx:136` "fatta/fatte oggi", `tasks-screen.tsx:156` "Sposta tutte a oggi". Fix: allineare al maschile. `FIXED-IN-RUN-13 (P3)`

### CRAFT-cal-01 · "Elimina evento" ghost neutro, il gemello task è danger — `L`
`calendar/event-detail.tsx:205` vs `task-detail.tsx:467` (`text-[var(--em-segnale-text)] hover:bg-[var(--em-segnale-tint)]`). Fix: stessa classe. `FIXED-IN-RUN-13 (P3)`

### CRAFT-sett-01 · Glifo "–" dello slot saltato a text-[10px] — `M`
`settimana/week-board.tsx:246` — l'unica violazione del pavimento 12px nel gruppo (la regola del token: "Nothing smaller"). Fix: mark SVG come il check (stroke, h-3.5). `FIXED-IN-RUN-13 (P3)`

### CRAFT-sett-02 · Il tasto "s" non è dichiarato + lo stato "saltato" non è annunciato — `M`
`week-board.tsx:206-226`: l'aria-label dice solo "tieni premuto per saltato" (istruzione touch) per ENTRAMBI gli stati none/skipped; il fallback tastiera "s" (legge run-08: la label dichiara il gesto) è invisibile e uno slot saltato è indistinguibile da uno intonso per AT. Fix: label con stato risolto ("saltato/fatto/da fare") + "premi S per saltato"; stessa menzione nell'help di settimana-screen:182-184. `FIXED-IN-RUN-13 (P3)`

### CRAFT-sett-03 · "1 slot copiati su lunedì." — `M` (plurale)
`settimana/plan-manager.tsx:189`. Fix: ramo singolare. `FIXED-IN-RUN-13 (P3)`

### CRAFT-gym-01 · Riordino esercizi nel giorno: solo pointer, zero tastiera — `M` (contratto a11y)
`gym/day-editor.tsx:296,463`: grip `<button>` con solo `onPointerDown`, label "Trascina…" — WCAG 2.1.1; ogni ALTRO riordino dell'app ha il percorso tastiera (abitudini, ritual, programs-panel), e il contratto è SCRITTO in `gym/use-row-drag.ts:8` ("Fallback tastiera a carico del chiamante") — day-editor è l'unico chiamante inadempiente. Fix: l'idioma run-11 P6 — `onKeyDown` ArrowUp/Down sul grip + label "…o frecce su e giù". `FIXED-IN-RUN-13 (P3)`

### CRAFT-gym-02 · Chip selezionato perde la transizione che il gemello deselezionato ha — `L`
`gym/gym-screen.tsx:429` (rating) e `:626-627` (filtri Libreria): `transition-colors` solo nel ramo non-attivo → selezione a scatto, deselezione animata. Fix: transizione nella parte comune. `FIXED-IN-RUN-13 (P3)`

### CRAFT-gym-03 · Doppio pt-4 sotto la tab bar di /gym — `L`
`gym/gym-screen.tsx:290` aggiunge `pt-4` dentro il tabpanel che ui/tabs.tsx:104 già padda → 32px contro i 16 delle altre superfici a tab. Fix: drop del wrapper pt-4. `FIXED-IN-RUN-13 (P3)`

### CRAFT-gym-04 · Colonna sticky della ProgressTable dipinta surface su sheet surface-2 — `M`
`gym/progress-table.tsx:62,153`: dentro Modal/BottomSheet (surface-2) la colonna sticky usa `bg-[var(--em-surface)]` → striscia più scura in dark. Fix: surface-2. `FIXED-IN-RUN-13 (P3)`

### CRAFT-stats-01 · "lun -> dom" ASCII in tre caption, "→" altrove — `L` (copy)
`stats/stats-screen.tsx:212,245` · `stats/diet-panel.tsx:93` vs il glifo vero in diet-panel:123 e month-recap:197. `FIXED-IN-RUN-13 (P3)`

### CRAFT-stats-02 · KG_DELTA senza `useGrouping: "always"` — `L` (invariante di repo)
`stats/month-recap.tsx:31` + copia in `diet-panel.tsx:23`: l'invariante run-09 (AGENTS.md, greppabile su ogni NumberFormat it-IT) è saltata solo qui. Fix: aggiungere l'opzione (niente hoist: churn). `FIXED-IN-RUN-13 (P3)`

### CRAFT-dieta-01 · Hover della GridMealCell anima box-shadow con transition-colors — `L`
`dieta/piano-tab.tsx:461`: la proprietà transita ma è quella sbagliata → snap. Fix: `transition-shadow`. `FIXED-IN-RUN-13 (P3)`

### CRAFT-dieta-02 · "1 pasti copiati su Mer." — `M` (plurale)
`dieta/piano-tab.tsx:230`. Fix: ramo singolare. `FIXED-IN-RUN-13 (P3)`

### CRAFT-dieta-03 · Etichette minuscole: "annulla" ×3, "cambia", "‹ ricerca" — `L` (copy)
`food-picker.tsx:105,225` · `piano-tab.tsx:662,1041` · `oggi-tab.tsx:691` vs sentence-case ovunque ("Annulla" nei toast, "‹ Piani"). Fix: capitalizzare (con esse `plan-manager.tsx:378` "annulla" di settimana). `FIXED-IN-RUN-13 (P3)`

### CRAFT-hab-01 · Chip +N e contatore "−" senza hover — `L`
`abitudini/habit-card.tsx:155,172`: gli unici controlli della card senza feedback desktop (dots e "totale…" ce l'hanno; il gemello qty-stepper pure). Fix: `hover:text-[var(--em-text)]`. `FIXED-IN-RUN-13 (P3)`

### CRAFT-corpo-01 · StepBtn peso: niente hover + glifo text-lg fuori scala — `L`
`corpo/corpo-screen.tsx:190`: il gemello qty-stepper ha `hover:text-[…]` e resta in scala. Fix: hover + em-body (anche habit-card:172 per il text-lg). `FIXED-IN-RUN-13 (P3)`

### CRAFT-esami-01 · Traccia barre bg-surface-2 invisibile in light — `M`
`esami/esami-screen.tsx:293` · `spese/spese-screen.tsx:107`: in light surface e surface-2 sono entrambi #ffffff → la traccia sparisce. La ricetta di casa: `bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)]` (ui/progress.tsx:42). `FIXED-IN-RUN-13 (P3)`

### CRAFT-esami-02 · "Importati 1 esami" / "Importate 1 spese" / "Importate 1 righe" — `L` (plurali)
`esami/import-button.tsx:45` · `spese/import-button.tsx:44` · `impostazioni/account-sync.tsx:114-119` (righe/erano/non valide ×3). Fix: rami singolari. `FIXED-IN-RUN-13 (P3)`

### CRAFT-imp-01 · Export/import/svuota senza `loading` — `L`
`impostazioni/account-sync.tsx:131-141,198-206`: azioni lunghe (backup JSON, wipe) solo `disabled`; il Button di casa ha lo spinner width-lock usato da ogni altro flusso. Fix: `loading` sull'azione in corso. `FIXED-IN-RUN-13 (P3)`

### CRAFT-imp-02 · CTA ospite replica il primary ma perde l'active — `L`
`impostazioni/page.tsx:148`: Link-bottone copiato da Button primary senza `active:bg-[…]` (ui/button.tsx:16). Fix: aggiungere la classe. `FIXED-IN-RUN-13 (P3)`

### CRAFT-oggi-01 · TileLink disegna un ring focus ember custom — `L`
`_components/today-tiles.tsx:269`: unico focus-visible custom del gruppo (`outline-[var(--em-ember)]`); il ring globale monocromo è la legge. Fix: drop delle tre utility. `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-01 · Field: required solo visivo — `M`
`ui/field.tsx:41-51`: l'asterisco è aria-hidden e le render-props non passano `aria-required`. Fix additivo sulle props. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-02 · RowMenu dei task: role="menu" senza frecce né focus-return — `L`
`_components/tasks/task-item.tsx:408-435`. Fix: ArrowUp/Down tra i menuitem + refocus del trigger alla chiusura (idiomi già in Select). `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-03 · Toast errore annunciati polite — `L`
`ui/toast.tsx:111`: `role="status"` anche per tone error. Fix: `role="alert"` sul solo tone error. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-04 · Griglia calendario senza role="row" — `L`
`ui/calendar.tsx:162-181`: grid → gridcell senza righe (pattern APG). Fix: wrapper `role="row"` per settimana. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-05 · Clear "×" dei picker è interattivo DENTRO il button trigger — `L`
`ui/date-picker.tsx:91-109` · `ui/time-picker.tsx:124-153`: `role="button"` annidato in `<button>` (HTML invalido, AT inaffidabile). Fix: hoist a sibling posizionato. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-06 · Badge text-3 su surface-2 a 4,38:1 in dark — `M`
Calcolato: #858b99 su #232730 = 4,38 (< 4,5 AA testo piccolo). Siti non-disabled reali: `abitudini-screen.tsx:311` ("archiviata") · `today-timeline.tsx:358` · `agenda-list.tsx:82` · `session-grid.tsx:354,380`. Fix sanzionato dal brief ("contrast fixes via correct token choice"): text-2 su questi siti (6,87:1). **Nota di verifica:** il sesto sito citato dall'agente (`week-board.tsx:292`, titolo dello slot fatto) sta su `--em-surface` (card), NON su surface-2 → 4,83:1, PASSA — non toccato. `FIXED-IN-RUN-13 (P3)` (5 siti)

### CRAFT-a11y-07 · Palette: input combobox senza aria-autocomplete — `L`
`ui/command-palette.tsx:173-186`. Fix: `aria-autocomplete="list"`. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-08 · role="listbox" senza il contratto tastiera del ruolo — `L`
`ui/calendar.tsx:281-293` (WeekStrip: 7 option tutti tabbabili, niente roving/frecce) · `ui/time-picker.tsx:234` (24+12 option idem). Il ruolo promette un tab-stop + frecce; il riferimento interno è il roving di Tabs e il radiogroup di Sera. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-09 · Tablist senza nome accessibile — `L`
`ui/tabs.tsx:57-61`: nessuna prop label esiste; quattro superfici espongono la loro navigazione primaria come tablist anonima. Fix: prop opzionale `label` → `aria-label` (+ i 4 call site). (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-10 · Il Button in loading perde il nome accessibile — `L`
`ui/button.tsx:77-81`: `invisible` = `visibility:hidden` → label fuori dall'accessibility tree; mentre carica il bottone è un controllo `aria-busy` senza nome. Fix: `opacity-0` (pixel identici, nome conservato). (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-a11y-11 · Scroll-lock: ripristino stantio su chiusura fuori ordine — `L`
`ui/internal.tsx:117-122`: con overlay A poi B aperti, se A smonta per primo il cleanup di B ripristina il SUO `prev` = "hidden" → body bloccato. Fix: catturare l'overflow originale a livello modulo sulla transizione 0→1, ripristinarlo sull'1→0. (ui/ FLAGGED) `FIXED-IN-RUN-13 (P3)`

### CRAFT-motion-01 · Uscite overlay: sheet/modal/toast smontano a scatto — `M`
`ui/bottom-sheet.tsx:59` · `ui/modal.tsx:39` · `ui/toast.tsx:48-50`: enter on-token, exit istantaneo. **Mandato P2** (macchina di chiusura + keyframes out + `--em-ease-in`). `FIXED-IN-RUN-13 (P2)`

### CRAFT-motion-02 · Drag della sheet annullato: snap senza transizione — `L`
`ui/bottom-sheet.tsx:54-56` + `:76-77`: sotto soglia `setDragY(0)` senza transizione sul panel. **Mandato P2** (transizione transform quando non in drag). `FIXED-IN-RUN-13 (P2)`

### CRAFT-motion-03 · Layer di reveal dello swipe task flippano opacity senza transizione — `L`
`_components/tasks/task-item.tsx:195,204`. Fix: `transition-opacity duration-[var(--em-dur-tap)]`. `FIXED-IN-RUN-13 (P3)`

---

## JUDGMENT — non si toccano in run-13, vanno alla lista del 99m

| ID | Tema | Evidenza | La domanda per Davide |
| --- | --- | --- | --- |
| J-01 | Hover della cella "done" nella griglia set | session-grid.tsx:379 | Le celle loggate meritano un hover proprio (shadow-lift)? Le ghost ce l'hanno. |
| J-02 | Riga esame senza hover | esami-screen.tsx:251 | Hover sulla riga-bottone dentro card bordata: che forma (bg pieno? inset?)? |
| J-03 | Radius micro fuori scala | settimana-screen.tsx:236,239 (4px) · month-heat.tsx:58 (5px) · kbd palette (4px) · kbd del rail ⌘K app-nav.tsx:147 (4px, copia byte-identica del dialetto kbd — sito aggiunto in run-13 P4b, filed dal reviewer P6 come LOW) | Nasce un token micro-radius (~4px) o restano eccezioni documentate? |
| J-04 | Timer di /focus a text-5xl font body | focus-screen.tsx:86 | Adottare em-display (40px, Bricolage) o em-display-xl (64)? Cambia il volto del timer. |
| J-05 | Dialetti di chip selezionabile | profile-section.tsx:222 vs spese-screen.tsx:278 | Ring attivo hairline-strong@120ms o ember@180ms? Un canone per tutti i chip. |
| J-06 | Toast con Annulla: 5s bastano? | ui/toast.tsx:90 | Allungare il dwell dei toast azionabili (o role=alert + timer)? |
| J-07 | --em-text-3 al limite AA | 4,38:1 su surface-2 (fixato locale, P3); 4,15:1 su calce in LIGHT (eyebrow) | Scurire text-3 light (~#6a6e78) a livello token? Tocca tutto il tema chiaro. |
| J-08 | Destructive: bianco su segnale 3,91:1 | ui/button.tsx:26-29 | Scurire il fill destructive (nuovo --em-segnale-solid)? Sposta il rosso di sistema. |
| J-09 | MonthHeat solo-colore | month-heat.tsx:55-60 (aria-hidden) | Aggiungere riassunto testuale per AT (contenuto nuovo)? |
| J-10 | Marker timeline che doppiano i pannelli | (ereditata 99k#2) | Ritirare il pannello o il marker? |
| J-11 | Rituale a qualunque ora | (ereditata 99k#1) | Gate a fascia mattutina? |
| J-12 | "Più avanti" = +8 giorni | (ereditata 99k#3) | Giorno giusto o serve un picker? |
| J-13 | Chips stima 15/30/60/90 | (ereditata 99k, brief vs PROP 15/30/1h/2h) | Confermare i tagli sul device. |
| J-14 | Attrezzatura plate calculator | (ereditata 99l#1) | Passo bilanciere ±2,5 default 20 e tagli 25…0,5 combaciano col rack vero? |
| J-15 | PR solo peso al set | (ereditata 99l#2) | Bastano? (reps/volume restano a fine seduta) |
| J-16 | Soglie correlazioni | (ereditata 99l#3) | 5 giorni/gruppo e finestra 60g da tarare coi dati veri. |
| J-17 | "Il tuo mese": delta peso prima→ultima | (ereditata 99l#4, triage: resta così) | Confermare sul device (media mobile è su /corpo da run-13 P4). |
| J-18 | /dieta wide solo sul tab Piano | (ereditata 99l#5) | Il salto di larghezza cambiando tab stona? |
| J-19 | 88rem: come respira sul 1440p | (ereditata run-10) | La larghezza wide va bene dal vivo? |
| J-20 | Coalescing toast acqua | (ereditata 99k/99l PROP-note) | Un toast coalescente per le raffiche di quick-log? |
| J-21 | CTA sm=36px su flussi touch-primari | sera-screen:116,404,417 · sera-recap:240 · today-focus:46,76 · dieta oggi-tab:385 "Fatto" | Promuovere a md i CTA primari di Sera/Focus/Dieta? (Il token sm resta per i secondari.) |
| J-22 | Larghezza grip di riordino w-8 (32px) | task-item:316 · abitudini-screen:294 | Allargare a w-11 OVUNQUE (scelta di sistema, ruba ~12px ai titoli)? |
| J-23 | Chip del parser quick-add h-8 dismiss-only | quick-add.tsx:167 · event-quick-add.tsx:135 | Estendere l'hit-area (rischio overlap con l'input sopra)? |
| J-24 | Link-header dei moduli su Oggi ~20px | today-gym.tsx:39 · today-timeline.tsx:191 · today-habits:39 | .em-hit sui link di testata (o accettare: il corpo card è il target)? |
| J-25 | Priorità/Ripeti chips 36px vs weekday 44px adiacenti | task-detail.tsx:316,584 vs :621 | Allineare i tre gruppi segmentati a h-11? |
| J-26 | Submit event-quick-add non collassa su mobile | event-quick-add.tsx:113-120 | Adottare icona+label nascosta come il gemello task? |
| J-27 | "Peso 30 g" / chip "7g/30g/90g" | diet-panel.tsx:118 · corpo-screen.tsx:225 | "gg" (o "giorni") al posto di "g"? Su superfici cibo/peso "g" legge grammi. |
| J-28 | "Sotto pace" (lib legacy, fuori fence) | lib/esami/pacing.ts:75 | Rinominare "Sotto ritmo"? (tocca la lib condivisa) |
| J-29 | Streak row del habit-sheet pop-in | habit-sheet.tsx:137 | Riservare lo spazio (skeleton) o collasso attuale? |
| J-30 | Trend /corpo con UNA pesata: chart "ready" vuota | corpo-screen.tsx:264-271 | Marker a cerchio singolo o empty state? |
| J-31 | Celle WeekGrid dieta: flash "0 kcal" pre-items | piano-tab.tsx:451-588 | Gate per-cella (rumore skeleton) o numero soppresso? |
| J-32 | Brief di Oggi: CLS di una riga al load | today-brief.tsx:41-44 | min-h di riserva o pop accettato? |
| J-33 | Uscite dei popover (select/picker/menu/palette) | inventario motion C | Estendere la macchina exit P2 anche ai popover in un run futuro? |
| J-34 | Swap di tab / theme switch / skeleton→content / mese calendario a scatto | inventario motion C | Quali di questi meritano un crossfade? (parade risk) |
| J-35 | Reflow dello stack toast senza animazione | ui/toast.tsx:65-69 | FLIP layout animation (macchineria nuova)? |
| J-36 | Loop hardcoded: spinner 800ms · indeterminate 1.4s · shimmer 1.6s | button.tsx:103 · progress.tsx:48 · ember.css:292 | Nasce un token loop o restano costanti documentate? |
| J-37 | Sistema Pulse morto in globals.css | globals.css:100-183 (7 keyframes, --dur-card 220≠240) | Ritirarlo in un run di pulizia legacy? (fuori fence run-13) |
| J-38 | ember-text su ember-tint = 4,26:1 in light | scheda-view:213 · programs-panel:152,311 · exercise-detail:311 (badge "attivo/oggi") | Alleggerire la tinta light (14%→8-10%) o scurire ember-deep? Tuning di token. |
| J-39 | Giorni fuori-mese: text-3 + opacity-60 ≈ 2,2–2,7:1 ma cliccabili | ui/calendar.tsx:197 | Togliere opacity-60 (gerarchia visiva più piatta) o accettare l'idioma calendario? |
| J-40 | Bordi dei controlli a ~1,6:1 (WCAG 1.4.11 chiede 3:1) | checkbox/radio/input via --em-hairline(-strong) | Rinforzare hairline-strong o nuovo --em-control-border? Tocca l'intero linguaggio dei bordi. |
| J-41 | BottomSheet senza dismiss visibile/AT-raggiungibile | bottom-sheet.tsx:64-98 (overlay aria-hidden, handle aria-hidden; Esc c'è) | Aggiungere un bottone "Chiudi" nell'header della sheet (come Modal)? Aggiunta di design. |

---

## Inventario motion — sintesi (il dettaglio guida P2)

- **Dentro `(app)`+`ui` la disciplina è quasi perfetta**: 175 transizioni su token durata (120/180/240/320), 13 animazioni su keyframe em-*, easing espliciti dove serve; zero `transition` nudi, zero ms hardcoded — le uniche eccezioni sono i tre loop (J-36).
- **Il gap strutturale è l'uscita**: ogni overlay entra animato e smonta a scatto (CRAFT-motion-01/02, mandato P2); i popover idem (J-33).
- **Due gate reduced-motion coesistono**: quello Ember scoped `.em-scope *` (ember.css:355) e quello GLOBALE `*` di globals.css:188 — i portali ri-applicano `.em-scope`, l'unico codice fuori scope (Overseer, root loading, 27 file legacy) è coperto dal gate globale. Nessuna animazione JS-driven sfugge (verificato: solo direct-manipulation pointer). Il gate Ember copre AUTOMATICAMENTE ogni keyframe/utility nuova di P2 (clampa le proprietà, non i nomi).
- **em-dot--live censito**: 14 usi, tutti semantica "vivo/adesso" o conferma (nav attiva, sync busy, sessione in corso, PR) — nessuno decorativo; P2 non moltiplica, non ritira.
- **Legacy**: 50 transizioni a default 150ms in 27 file fuori `(app)` + sistema Pulse morto — FUORI FENCE (J-37).

## Esito delle passate "clean" (vale quanto i finding)

Contratto dialoghi (role/aria-modal/trap/restore/Esc) ✓ · combobox Select e palette da APG ✓ · tabs/switch/checkbox/radio/progress ✓ · nessun tabIndex positivo, nessun autoFocus ladro ✓ · icon-button tutti con aria-label ✓ · gesti↔tastiera: swipe task (RowMenu), riordini abitudini/ritual/programs (frecce dichiarate), mese calendario (PageUp/Down) ✓ — l'eccezione è CRAFT-gym-01 · zero hex/rgba hardcoded in TUTTE le superfici (app) (la parità dark/light regge by construction; le eccezioni sono F2) · pavimento 12px rispettato ovunque tranne CRAFT-sett-01 · plurali it-IT corretti ovunque tranne i cinque elencati · numeri it-IT con useGrouping "always" ovunque tranne CRAFT-stats-02 · griglia calendario h-11 w-11 ✓ · due-pannelli calendario run-12 regge in entrambi i form factor ✓ · WeekGrid dieta con skeleton lg dedicato ✓ · tastiera del riordino abitudini (run-11 P6) reale e dichiarata ✓ · outline-none dei tre input testuali (gym note, qty, habit) NON sopprime il ring globale (specificità verificata) ✓.
