# LifeOS v3 — Product Audit & Proposals (run-10, Phase A)

Data: 2026-07-17 · Autore: Claude (Fable 5, run-10) · Stato: input per il triage chat → run-11.

Metodo: walk di tutte le 14 superfici correnti con occhi di prodotto, su cinque assi —
(a) tap-count dei gesti quotidiani (metrica stile MacroFactor FLSI: azioni discrete da
app-aperta, cioè da Oggi, a gesto concluso), (b) densità e uso dello spazio mobile/desktop,
(c) gerarchia visiva, (d) micro-interazioni (undo, transizioni, empty/skeleton, tastiera),
(e) opportunità cross-modulo. Ogni claim è stato verificato nel codice (file:riga nei run
log degli agenti di audit; qui si citano i punti chiave).

Flags: `[schema]` richiede migrazione/Dexie bump · `[primitive]` richiede un componente
ui/ nuovo · `[cross]` attraversa moduli · `[home]` tocca Oggi (budget chunk ~53 kB raw).
Effort S/M/L · Valore H/M/L.

**Fatto strutturale che domina tutto il capitolo densità:** la shell vincola OGNI
superficie a `max-w-2xl → md:max-w-3xl` (768 px) — `app/(app)/layout.tsx:44`. Su un
1440p, tolto il rail da 224 px, restano ~450 px vuoti; su un 1920p ~930 px. Nessuna
superficie dichiara `lg:`/`xl:`. Le tabelle (gym progressi, settimana 7 colonne, dieta
piano, spese, esami) e i grafici (stats è perfino `max-w-md`) pagano il prezzo più alto.
→ risolto in questo run dal P3 (token di larghezza per-pagina); sotto, per modulo, resta
segnato dove la larghezza guadagnata va poi SPESA in run-11.

---

## §1 · Findings & proposte per modulo

### 1.1 Oggi (home)

**Tap-count oggi (da app aperta):** spuntare un'abitudine 1 · acqua +330 ml 1 · avviare
l'allenamento suggerito 1 · avviare un focus 1 · spuntare lo slot "Adesso" 1 · aggiungere
un task 2 + testo (FAB → digita → Invio) · pasto base "Fatto" 2 (tile Pasti → Fatto).
La home è già un pannello a un-tocco per quasi tutti i gesti quotidiani — il valore è
difenderlo, non aggiungerci chrome.

**Findings.** (1) Composizione fissa di 11 sezioni (brief → tile → abitudini → Adesso →
focus → while-away → task → agenda → palestra → promemoria → installa): la palestra, il
modulo più usato da Davide, è nona. Nessuna consapevolezza dell'ora: la sera la card
utile sarebbe Sera/domani, la mattina il piano. (2) I tile statistiche NON sono tappabili
tranne "Pasti" (unico avvolto in Link, `today-tiles.tsx:177`) — incoerenza pura: "Peso"
non porta a /corpo, "Streak" non porta a /stats. (3) La strip abitudini logga senza undo
(`today-habits.tsx:79-91`: toast solo su errore) mentre il pasto "Fatto" di dieta ha
l'Annulla — stesso gesto, garanzie diverse. (4) Esami e Sera non esistono su Oggi
(nessun countdown esame, nessun aggancio serale). (5) Su mobile i moduli non-tab si
raggiungono solo via Impostazioni → Moduli (3 tap per arrivare a /corpo).

- **PROP-oggi-01 — Tile tappabili, tutti.** Ogni StatCard di Oggi diventa un Link al suo
  modulo (Task→/tasks, Streak e Settimana→/stats, Palestra→/gym, Peso→/corpo, Piano di
  oggi→/settimana), stesso pattern focus-ring del tile Pasti. Riduce il costo di
  raggiungere i moduli su mobile (3 tap → 1 per /corpo quando il tile c'è). Effort S ·
  Valore H · `[home]`.
- **PROP-oggi-02 — Ordine consapevole dell'ora.** Dopo le 18 la sezione Sera (nudge
  check-in, PROP-sera-01) sale sopra i task e Palestra sale di rango al mattino; la
  composizione resta deterministica (fasce orarie fisse, niente ML). Effort M · Valore M
  · `[home]`.
- **PROP-oggi-03 — Undo sui log a un tocco della strip abitudini.** Il quick-log della
  strip (boolean/counter/quantity) mostra il toast con Annulla che riporta il valore
  precedente (stesso disegno del "Fatto" dieta). Effort S · Valore H · `[home]`.
- **PROP-oggi-04 — Countdown esami su Oggi.** Tile/riga "Analisi II · fra 9 giorni ·
  2 cap/dì" quando il prossimo esame è ≤14 giorni (riusa `computePacing`, oggi consumato
  solo dentro /esami). Effort S-M · Valore M · `[home]` `[cross]`.

### 1.2 Task

**Tap-count:** aggiunta col solo titolo 2 + testo (il quick-add persistente non è
autofocus al load); con data via NL identico (chips inline, zero tap extra — parità che
è il punto di forza del modulo); completare 1 (checkbox o swipe, con undo); snooze 2
(swipe sinistro → "Domani"); dettaglio 1.

**Findings.** (1) **Zona morta +8 giorni**: "Prossimi" è una finestra fissa +1..+7
(`tasks/logic.ts:301-306`) — un task datato oggi+8 non compare in Oggi, non in Inbox (ha
una data), non in Prossimi, non in Fatti: esiste solo nel calendario. (2) Il check
inline dall'agenda (`agenda-list.tsx:136-144`) NON passa dal path con undo dei task:
toast solo su errore. (3) Ricorrenze solo daily/weekly; niente mensili. (4) Priorità
solo display (nessun sort/raggruppamento); nessuna ricerca; un solo reminder per task.
(5) Micro-interazioni al top del repo (undo ovunque, optimistic, swipe, drag): è il
riferimento interno.

- **PROP-task-01 — Chiudere la zona morta di "Prossimi".** Sotto i 7 giorni a sezioni,
  una sezione "Più avanti" con i task datati oltre la finestra (query esistente
  `useUpcomingTasks` con range esteso, raggruppati per mese). Effort S · Valore H.
- **PROP-task-02 — Undo sul check inline in agenda.** Il completamento dall'agenda usa lo
  stesso toast "Fatto: … · Annulla" delle liste task (riuso di `useTaskActions` o del suo
  pattern). Effort S · Valore H · `[cross]` (il file è condiviso con Calendario/Oggi).
- **PROP-task-03 — Ricorrenze mensili.** "il 15 di ogni mese", "ultimo giorno del mese"
  nel parser + `RecurrenceSchema`. Effort M · Valore M · `[schema]` (il campo è jsonb ma
  il contratto zod/sync evolve: client vecchi rifiuterebbero la regola nuova al pull).
- **PROP-task-04 — Triage da tastiera (desktop).** j/k naviga, x completa, s snooze,
  Invio apre — sul pattern scorciatoie esistente (comfort-host). Effort M · Valore M.
- **PROP-task-05 — Durata stimata sul task.** Campo "durata" (15'/30'/1h/2h chips) per il
  capacity-check del rituale mattutino (WOW-05); senza di esso il check resta a conteggi.
  Effort M · Valore H · `[schema]` `[cross]`.

### 1.3 Calendario

**Tap-count:** evento oggi con orario 2 + testo (input → digita "cena 20:30" → Invio);
agenda di un giorno 1 (tap sulla cella); mese successivo 1 (o swipe).

**Findings.** (1) Solo vista mese + lista del giorno selezionato: nessuna vista
settimana, nessuna timeline oraria — e `WeekStrip` ESISTE già in ui/ ma è usata solo su
Oggi (`ui/calendar.tsx:260-337`). (2) Il mese domina il viewport; l'agenda del giorno —
il contenuto operativo — sta sotto quick-add con un header a eyebrow. (3) Dot di densità
tutti grigi, cap a 3, senza distinzione task/evento/Google. (4) Eventi senza ricorrenza
(`LocalEventSchema` non ha il campo), senza luogo, senza reminder (i reminder sono
solo-task). (5) Nessun drag-to-reschedule. (6) Il calendario mostra i task (dots +
agenda, spuntabili inline) ma /tasks non mostra gli eventi — asimmetria voluta finora,
da rendere almeno leggibile (riferimento Things 3: eventi come testo quieto in testa
alla lista del giorno).

- **PROP-cal-01 — Vista settimana.** Toggle mese/settimana: WeekStrip + agenda dei 7
  giorni impilati (mobile) o griglia oraria (desktop, dopo P3). Effort M · Valore H.
- **PROP-cal-02 — Due pannelli su desktop.** Da lg: mese a sinistra, agenda del giorno
  selezionato a destra (pattern "peek" dei prodotti craft): la larghezza P3 spesa dove
  serve. Effort M · Valore H.
- **PROP-cal-03 — Eventi in testa a "Oggi" dei task.** Nella lista Oggi di /tasks, gli
  eventi del giorno come righe di solo testo non interattive in testa (il vincolo Things
  3): contesto senza confusione. Effort S-M · Valore M · `[cross]`.
- **PROP-cal-04 — Ricorrenza eventi.** "ogni lunedì" anche sugli eventi locali,
  riusando `data/recurrence.ts`. Effort M · Valore M · `[schema]`.
- **PROP-cal-05 — Scorciatoia "nuovo evento".** Voce palette "Nuovo evento…" + tasto
  `e` sul modulo (bus quick-add come i task). Effort S · Valore M.

### 1.4 Palestra

**Tap-count:** avviare l'allenamento suggerito 1 da Oggi; prima serie: +2 (tap cella
fantasma → Conferma, peso/reps già prefillati dall'ultima volta); serie successive
idem. Con la rotazione scheda-centrica del P2 l'avvio diventa 2 (tile → card → "Logga
oggi") — un tap in più scambiato con il contesto storico della scheda, che è il modello
mentale dichiarato di Davide (il suo Excel).

**Findings.** (1) IA session-first ("Inizia allenamento" come porta d'ingresso) vs
modello mentale card-manager → **risolto dal P2 di questo run** (card per giorno-scheda,
griglia storica righe=esercizi × colonne=date, Logga oggi dentro la card). (2) Il
prefill "dall'ultima volta" nel micro-editor c'è ma è INVISIBILE: l'utente non vede
quanto fece l'ultima volta mentre conferma (il ghost Hevy-style è il pattern più amato
della categoria). (3) I record emergono solo nella schermata di fine, mai al momento
del set che li batte. (4) Niente plate calculator. (5) Chunk più pesante dell'app
(86 kB raw pre-P2) — non ha budget formale ma va tenuto d'occhio nel report.

- **PROP-gym-01 — IA scheda-centrica.** → implementata in questo run (P2). Verrà marcata
  DONE-IN-RUN-10.
- **PROP-gym-02 — "L'ultima volta" visibile nel micro-editor.** Riga quieta "Ultima
  volta: 62,5 × 9 @RIR1" sopra gli stepper (la storia è già caricata per il prefill:
  `session-grid.tsx:678-691`). Effort S · Valore H.
- **PROP-gym-03 — Plate calculator.** Dato un peso target e un profilo bilanciere+dischi
  (per-dispositivo, localStorage come il chime), i dischi per lato nel micro-editor.
  Matematica locale pura. Effort M · Valore H (la "chicca" della ricerca).
- **PROP-gym-04 — PR celebrato al momento del set.** In `confirmSet`, se il carico batte
  il massimo storico dell'esercizio (storia già in mano), toast ember "PR: 92,5 kg su
  Panca" — la celebrazione Hevy senza coriandoli. Effort S · Valore H.
- **PROP-gym-05 — Marker di set (warmup/failure).** Sul modello del foglio di Davide non
  esistono: valore basso, solo se lo chiede. Effort M · Valore L · `[schema]`.
- **PROP-gym-06 — Timer di recupero opt-in.** Esplicitamente contro il design dichiarato
  (griglia SENZA countdown): si propone solo come impostazione per-dispositivo spenta di
  default, e solo se Davide la vuole. Effort M · Valore L.

### 1.5 Statistiche

**Tap-count:** completamento settimana 0 (visibile all'apertura); riepilogo settimanale 1.

**Findings.** (1) Tutto mono-variabile e mono-finestra (settimana/mese correnti): niente
trend, niente confronti week-over-week — il componente `DeltaChip` esiste in ui/ ma
nessuno gli passa un delta. (2) Zero correlazioni cross-modulo. (3) La dieta è
INVISIBILE alle statistiche (nessun pannello kcal/proteine/aderenza) e non alimenta la
streak. (4) Il recap esiste solo settimanale (3 tile + barre task); nessun "Il tuo
mese". (5) I grafici sono cappati `max-w-md` (448 px!) dentro una shell già stretta —
il P3 li libera, run-11 deve spenderli.

- **PROP-stats-01 — Delta vs settimana scorsa.** StatCard di volume palestra e task
  chiusi con `DeltaChip` ("+12% vs settimana scorsa") — query già esistenti su range
  precedente. Effort S · Valore M.
- **PROP-stats-02 — Pannello Dieta.** Aderenza kcal (giorni nel ±10% del target),
  hit-rate proteine, trend peso 30g accanto: le tre serie esistono già nei port. Effort
  M · Valore H · `[cross]`.
- **PROP-stats-03 — Correlazioni native.** Ricostruite da zero nei moduli correnti (il
  legacy Insights resta intoccato): energia serale (sera) × completamento task; giorni
  di allenamento × completamento abitudini; minuti focus × task chiusi. Pattern a
  detector puro + card evidenza, dietro soglie di dati minimi oneste. Effort L · Valore
  H · `[cross]`.
- **PROP-stats-04 — "Il tuo mese".** → WOW-03 (recap mensile app-wide, casa naturale
  /stats).

### 1.6 Abitudini

**Tap-count:** boolean 1 (tutta la card è target) · acqua +330 1 · totale quantità 1 +
input · streak visibile a 0 tap (fiamma in card), dettaglio/heatmap 1.

**Findings.** (1) I log a un tocco NON hanno undo (board e strip Oggi; toast solo su
errore) — l'unico modulo dove il gesto primario è senza rete; archive/delete l'undo ce
l'hanno. (2) Il riordino dichiara "drag + tastiera" nel docstring ma la maniglia non ha
`onKeyDown`: la tastiera NON è implementata (`abitudini-screen.tsx:272-279`) — bugia
d'accessibilità da sanare. (3) Niente celebrazione ai traguardi di streak (7/30/100).
(4) Heatmap mensile nella scheda c'è già (riuso MonthHeat) — il mercato ce l'ha come
core e noi pure: ok. (5) Board single-column anche su desktop.

- **PROP-hab-01 — Undo sui log a un tocco.** Board + strip Oggi (vedi PROP-oggi-03:
  stessa implementazione, due superfici): toast "Fatta · Annulla" che ripristina il
  valore precedente del giorno. Effort S · Valore H.
- **PROP-hab-02 — Tastiera sul riordino.** Frecce su/giù sulla maniglia (pattern
  ArrowButton già in programs-panel) e docstring di nuovo onesto. Effort S · Valore M.
- **PROP-hab-03 — Traguardi di streak.** A 7/30/100 giorni, il toast del log porta una
  riga in più ("7 di fila — prima settimana piena"): celebrazione quieta, zero
  coriandoli. Effort S · Valore M.
- **PROP-hab-04 — Board a 2 colonne su desktop.** Da lg, `grid-cols-2`: metà scroll.
  Effort S · Valore M.
- **PROP-hab-05 — Schedule flessibile "N volte a settimana".** Oltre ai weekday fissi.
  Effort M · Valore M · `[schema]`.

### 1.7 Settimana

**Tap-count:** spuntare lo slot corrente 1 da Oggi (card Adesso) · spuntare un altro
slot 2 (nav + tap) · saltato = long-press 450ms (pattern di casa, con fallback "s").

**Findings.** (1) Su desktop la board è GIÀ `md:grid-cols-7` ma dentro 768 px: ~96 px a
colonna, titoli troncati — il caso più gridato del sintomo larghezza → **risolto dal P3
di questo run**. (2) Lo storico (barre 8 settimane + "salti più spesso") è già il
migliore uso di dati del repo. (3) Gli slot sono stringhe: "07:00 Palestra" non sa
niente della palestra — il ponte è la proposta cross più matura (→ §2.1).

- **PROP-sett-01 — Board desktop a tutta larghezza.** → implementata in questo run (P3).
- **PROP-sett-02 — Slot consapevoli del modulo.** → §2.1 (CROSS-01). Effort M · Valore H
  · `[cross]`.

### 1.8 Focus

**Tap-count:** avvia 1 (anche da Oggi e da palette) · pausa 1 · preset 1.

**Findings.** (1) Il motore è wake-safe e onesto (il tempo è calcolato, mai contato) —
solido. (2) Nessun legame col task su cui si lavora: il ponte TickTick è il gap numero
uno (FocusSession non ha task_id). (3) Sulla superficie non esiste storia oltre "oggi":
niente barre dei giorni. (4) Niente spacebar per avvia/pausa su desktop.

- **PROP-focus-01 — Focus su un task.** Fase 1 senza schema: "Avvia focus" dalla scheda
  task, col titolo del task come contesto della sessione corrente (stato del timer, non
  persistito). Fase 2 `[schema]`: `task_id` su FocusSession e minuti accreditati nella
  scheda task ("2h 15' di focus"). Effort S (fase 1) / M (fase 2) · Valore H · `[cross]`.
- **PROP-focus-02 — Barre degli ultimi 14 giorni su /focus.** ChartFrame + la stessa
  grammatica di WeekBars sui minuti (`useFocusMinutesByDay` già pronto). Effort S-M ·
  Valore M.
- **PROP-focus-03 — Spacebar = avvia/pausa.** Su /focus, quando nessun input ha il
  focus. Effort S · Valore M.

### 1.9 Dieta

**Tap-count:** pasto base "Fatto" 1 (2 da Oggi via tile) · con scelta variante (2+
varianti) 3 · extra dalla libreria 3 · voce libera 3 + due campi · kcal rimanenti
visibili a 0 tap MA solo come barra: il numero "quanto manca" è calcolato
(`remainingVsTarget`) e mai mostrato.

**Findings.** (1) Il flusso quotidiano è già tra i migliori della categoria per tap
(MacroFactor conterebbe 1-3); l'undo sul "Fatto" c'è. (2) Carboidrati e grassi sono
tracciati, editabili in libreria, sommati nei totali (decigrammi interi) e MAI mostrati
da nessuna parte nel giorno: dato pagato e non goduto. (3) Nessun "ripeti da ieri" /
recenti nel log del giorno: il pattern top di categoria manca. (4) Il builder Piano è a
chip-giorno singolo anche su desktop (dopo P3 può diventare griglia settimanale). (5)
Zero consapevolezza dei giorni di allenamento (→ §2.2).

- **PROP-diet-01 — Il numero che manca.** Nell'header del giorno, accanto alla barra:
  "restano 1.120 kcal · 52 g proteine" (già calcolato, mai renderizzato). Effort S ·
  Valore H.
- **PROP-diet-02 — Recenti negli extra.** Sopra la ricerca del picker extra, una riga di
  chips con gli ultimi 5 alimenti usati negli extra: ripetere lo spuntino tipico = 2
  tap. Effort S-M · Valore H.
- **PROP-diet-03 — Carbo e grassi, visibili con misura.** Riga completa nei totali del
  giorno e nella scheda pasto ("C 210 · G 61"), header invariato (kcal+proteine restano
  la gerarchia). Effort S-M · Valore M.
- **PROP-diet-04 — Varianti per giorno di allenamento.** → §2.2 (CROSS-02). `[schema]`
  `[cross]`.
- **PROP-diet-05 — Piano settimanale a griglia su desktop.** Dopo P3: i 7 giorni
  affiancati nel builder (oggi chip-navigazione). Effort M · Valore M.

### 1.10 Esami

**Tap-count:** capitolo fatto 1 (bottone inline in lista — già ottimo) · nuovo esame ~2
+ testo.

**Findings.** (1) "Capitolo fatto" è muto: nessun toast, nessun undo — un +1 sbagliato
si corregge solo aprendo la scheda e usando lo stepper. (2) Esami non esiste su Oggi
(il docstring di pacing.ts promette un widget "next exam" che non esiste — commento
stantio). (3) Un esame "Scaduto" mostra solo il badge: nessun CTA per chiudere o
rimandare. (4) Superficie statica (1 transizione in tutto).

- **PROP-esami-01 — Toast+undo su "Capitolo fatto".** "Capitolo 6 di 12 · Annulla".
  Effort S · Valore M.
- **PROP-esami-02 — Countdown su Oggi.** → PROP-oggi-04.
- **PROP-esami-03 — CTA sugli scaduti.** Su badge "Scaduto": "com'è andata?" → voto o
  nuova data, dalla scheda esistente. Effort S-M · Valore M.

### 1.11 Spese

**Tap-count:** totale mese 0 (primo blocco) · spesa con categoria default 2 + importo ·
categoria specifica 3.

**Findings.** (1) Il toast di aggiunta ("Spesa di 12,50 € aggiunta.") NON ha Annulla —
l'unica creazione one-shot del repo senza undo. (2) Nessun confronto col mese scorso.
(3) Nessun budget per categoria. (4) Superficie statica ma onesta; skeleton ok.

- **PROP-spese-01 — Undo sull'aggiunta.** Azione "Annulla" nel toast esistente
  (softDelete della riga appena creata). Effort S · Valore M.
- **PROP-spese-02 — Delta mese-su-mese.** Sotto il totale: "−12% vs giugno" (query del
  mese precedente + DeltaChip). Effort S · Valore M.
- **PROP-spese-03 — Budget per categoria.** Target mensile per categoria con barra
  rimanente. Effort M · Valore M · `[schema]`.

### 1.12 Sera

**Tap-count:** check-in minimo 1 (energia — salvataggio continuo, nessun submit) ·
completo 4 campi.

**Findings.** (1) Modulo completamente SILOS: non alimenta streak, stats, Oggi, brief;
niente entra, niente esce. (2) Nessun campo "domani" (la vecchia sezione placeholder fu
rimossa apposta — giusto; ma l'intenzione per domani è il pezzo che renderebbe Sera
utile al mattino dopo). (3) Nessun aggancio serale da Oggi. (4) L'energia 1-5 è la
serie perfetta per le correlazioni (PROP-stats-03).

- **PROP-sera-01 — Aggancio serale su Oggi.** Dopo le 20, se il check-in di oggi è
  vuoto: card quieta "Com'è andata? → Sera" (sparisce a check-in fatto). Effort S ·
  Valore M · `[home]` `[cross]`.
- **PROP-sera-02 — "Domani" vero.** Campo intenzione ("la cosa più importante di
  domani") nel check-in, mostrato la mattina dopo nel brief di Oggi. È il cuore dello
  shutdown ritual (WOW-06). Effort M · Valore H · `[schema]` `[cross]` `[home]`.

### 1.13 Corpo

**Tap-count:** pesata di oggi 1-2 (stepper prefillato dall'ultima, "Salva") · trend 30g
0 (default).

**Findings.** (1) Il modulo è già ben cablato in uscita (acqua, kcal, proteine, Forza
Relativa, pesata a fine seduta) — il migliore cittadino cross del repo. (2) Trend senza
media mobile: i punti grezzi ballano e la banda min-max non è una direzione. (3)
Nessun obiettivo di peso (nessuna linea target). (4) Grafico statico (nessun tooltip).

- **PROP-corpo-01 — Media mobile 7 giorni.** Seconda polyline quieta sopra i punti
  grezzi (pura matematica in logic.ts). Effort S-M · Valore M.
- **PROP-corpo-02 — Obiettivo di peso.** Campo nel profilo + linea target nel trend +
  "mancano 2,4 kg" onesto. Effort M · Valore M · `[schema]`.

### 1.14 Impostazioni

**Tap-count:** tema 1 (ma ~9ª card: costa scroll) · giorno protetto ~2 (ma ~11ª card).

**Findings.** (1) 13-14 card impilate; Tema e Giorni protetti sepolti sotto CINQUE card
di import quasi identiche (Gym/Agenda/Esami/Spese/Sere). (2) UNICA superficie del
gruppo (app) SENZA skeleton: le sezioni appaiono a scatti quando i dati arrivano
(profilo, giorni protetti, push rendono null in caricamento). (3) Profilo è l'hub
condiviso vero (altezza/sesso/attività → derived) e funziona.

- **PROP-imp-01 — Skeleton sulle sezioni.** Profilo, Giorni protetti, Push, Sync: shimmer
  invece del pop-in. Effort S · Valore M.
- **PROP-imp-02 — Una card "Importa dal vecchio LifeOS".** Le cinque card di import
  diventano una card con cinque righe (stesso pattern riga+bottone), in fondo. Tema e
  Giorni protetti risalgono. Effort M · Valore M.

---

## §2 · Integrazioni cross-modulo (i moduli si parlano)

- **CROSS-01 — Lo slot "Palestra" della Settimana conosce la scheda.** Uno slot il cui
  titolo matcha palestra/gym (fase 1 euristica; fase 2 `[schema]` con `module_link` sullo
  slot) mostra accanto al titolo il giorno-scheda suggerito ("07:00 Palestra · Torso A")
  e deep-linka alla card di /gym (la rotta card del P2: `/gym?scheda=<dayId>`). Il check
  dello slot resta lo slot; la scheda è contesto. Effort M · Valore H · `[cross]`.
- **CROSS-02 — Dieta consapevole dei giorni di allenamento.** Fase 1 (senza schema): la
  card pasto del giorno mostra il chip "giorno di allenamento" quando il weekday ha un
  giorno-scheda col weekday impostato o esiste una sessione oggi — puro contesto. Fase 2
  `[schema]`: flag `training` sulla MealVariant e pre-selezione della variante giusta nel
  giorno giusto ("Variante allenamento" proposta, mai imposta). Effort S / M · Valore H ·
  `[cross]` `[schema]` (fase 2).
- **CROSS-03 — Il brief diventa il rituale del mattino.** Oggi il brief è una riga vera
  (palestra, task, slot, pasti). Elevazione Sunsama-style in tre pezzi SENZA nuovo
  schema: (a) rollover esplicito — "3 task di ieri da decidere" con azione "porta a
  oggi" (esiste già `moveAllToToday`, manca il momento); (b) capacity-line onesta —
  "oggi: 4 task, 2 eventi, 3 slot" (con PROP-task-05 diventa un vero check ore-vs-piano
  → WOW-05); (c) ordine del giorno — il primo slot + il primo task in una riga. Effort M
  · Valore H · `[home]` `[cross]`.
- **CROSS-04 — Shutdown serale che chiude il cerchio.** PROP-sera-01 (aggancio) +
  PROP-sera-02 (intenzione per domani) + il brief del mattino che apre con l'intenzione
  scritta ieri sera. Sunsama senza cerimonia: due tocchi la sera, una riga la mattina.
  Effort M (somma) · Valore H · `[schema]` `[cross]` `[home]`.
- **CROSS-05 — Timeline unica del giorno su Oggi.** Vista Structured-style: eventi
  (locali+Google), task con orario e slot del piano fusi in UNA colonna verticale
  ordinata per ora, ciascuno col suo gesto nativo (check task, check slot). La sezione
  Agenda + Adesso di Oggi convergono in un componente solo — meno sezioni, più senso.
  Effort M-L · Valore H · `[home]` `[cross]`.
- **CROSS-06 — Correlazioni native in Statistiche.** → PROP-stats-03 (energia sera ×
  task; allenamento × abitudini; focus × throughput). Il legacy Insights resta congelato:
  è una riscrittura nei moduli correnti, non un port. Effort L · Valore H · `[cross]`.
- **CROSS-07 — Focus × Task.** → PROP-focus-01 (fase 1 contesto, fase 2 `[schema]`
  accredito minuti). `[cross]`.
- **CROSS-08 — Esami su Oggi.** → PROP-oggi-04 (countdown + capitoli/dì). `[cross]`
  `[home]`.

## §3 · Wow features (fattibilità local-first / zero-deps a fianco)

- **PROP-WOW-01 — Plate calculator** (→ PROP-gym-03). Effort M · Valore H. Fattibilità:
  matematica pura + profilo dischi in localStorage; zero deps, zero schema.
- **PROP-WOW-02 — PR celebrato al set** (→ PROP-gym-04). Effort S · Valore H.
  Fattibilità: la storia dell'esercizio è già caricata nel micro-editor.
- **PROP-WOW-03 — "Il tuo mese".** Recap mensile app-wide su /stats: sessioni, volume,
  PR del mese, % abitudini, minuti focus, task chiusi, peso Δ — numeri già tutti nei
  port; una schermata composta, tono review settimanale. Effort M-L · Valore H.
  Fattibilità: query locali esistenti, zero deps.
- **PROP-WOW-04 — Ripeti dagli extra recenti** (→ PROP-diet-02). Effort S-M · Valore H.
  Fattibilità: `useDayExtras` su range recente, dedupe per food_id.
- **PROP-WOW-05 — Overcommitment warning.** Nel brief: "hai pianificato più di quanto
  entra" quando somma durate task (PROP-task-05) + eventi > ore residue. Effort M ·
  Valore M-H · dipende da `[schema]` durate; versione conteggi onesta possibile subito.
- **PROP-WOW-06 — Shutdown ritual** (→ CROSS-04). Effort M · Valore H.
- **PROP-WOW-07 — Palette con azioni rapide.** Oltre a nav/task/focus/tema: "Acqua
  +330", "Pesata di oggi…", "Logga il pranzo", "Apri la scheda di oggi" — ogni azione un
  gesto repo già esistente. Effort S-M · Valore M-H (desktop). Fattibilità: la palette e
  i repo ci sono; solo cablaggio.
- **PROP-WOW-08 — Traguardi di streak** (→ PROP-hab-03). Effort S · Valore M.
- **PROP-WOW-09 — Timeline unica del giorno** (→ CROSS-05). Effort M-L · Valore H.
- **PROP-WOW-10 — Rituale del mattino** (→ CROSS-03). Effort M · Valore H.
- **PROP-WOW-11 — Logbook di bordo.** Archivio cronologico cross-modulo ("cosa ho fatto
  martedì?"): task chiusi, sessioni, pasti, focus, pesate in un feed per giorno —
  l'idea Logbook di Things sul nostro storico locale. Effort M-L · Valore M.
  Fattibilità: query per-giorno sui port esistenti; nessun dato nuovo.
- **PROP-WOW-12 — Triage tastiera task** (→ PROP-task-04). Effort M · Valore M.

## §4 · Set raccomandati per run-11 (tema, contenuto, taglia)

I 3 set impacchettano le proposte H-value in run coerenti. Dentro ogni set, l'ordine è
già di dipendenza. Le PROP `[schema]` sono raggruppate così che ogni set abbia AL PIÙ una
migrazione+bump Dexie (invariante di run mantenuto).

**SET A — "La giornata guidata" (Sunsama/Structured, ~6 prompt).**
CROSS-03 rituale mattino (M) → CROSS-05 timeline unica (M-L) → PROP-sera-01 aggancio
serale (S) → PROP-sera-02 "domani" `[schema]` (M) → CROSS-04 chiusura del cerchio (S) →
PROP-oggi-02 ordine orario (M) + PROP-oggi-04/CROSS-08 esami su Oggi (S-M).
Un solo `[schema]` (campo sera). Trasforma Oggi da elenco a giornata.

**SET B — "Palestra pro + numeri veri" (~5 prompt).**
PROP-gym-03/WOW-01 plate calculator (M) → PROP-gym-04/WOW-02 PR al set (S, se non caduto
in P4) → WOW-03 "Il tuo mese" (M-L) → PROP-stats-02 pannello dieta (M) → PROP-stats-01
delta settimanali (S) → PROP-corpo-01 media mobile (S-M).
Zero `[schema]`. Il set spende la larghezza P3 su stats e chiude il cerchio dei numeri.

**SET C — "I moduli si parlano" (~5-6 prompt).**
CROSS-01 slot→scheda (M) → CROSS-02 fase 1 chip allenamento (S) e fase 2 varianti
`[schema]` (M) → PROP-focus-01 focus×task fase 1 (S) e fase 2 `[schema]` (M) →
PROP-diet-02/WOW-04 recenti extra (S-M) → PROP-cal-01 vista settimana (M) o PROP-cal-02
due pannelli desktop (M).
Due `[schema]` piccoli (variante.training, focus.task_id) — separabili se il run deve
restare a una migrazione.

Fuori set (triage libero): PROP-task-03 ricorrenze mensili `[schema]`, PROP-imp-02
consolidamento import, PROP-diet-05 griglia piano desktop, PROP-hab-04 board 2 colonne,
PROP-spese-03 budget `[schema]`, PROP-corpo-02 obiettivo peso `[schema]`, WOW-11
logbook, PROP-cal-04 ricorrenza eventi `[schema]`.

---

## Quick wins candidati per P4 di QUESTO run (S, zero schema, zero primitive, non ambigui)

In ordine di preferenza del brief (undo → ghost → tap → transizioni → empty/skeleton →
tastiera); cap 8, la selezione finale avviene al P4:

1. PROP-hab-01 / PROP-oggi-03 — undo sui log abitudini (board + strip Oggi).
2. PROP-task-02 — undo sul check inline in agenda.
3. PROP-spese-01 — undo sull'aggiunta spesa.
4. PROP-esami-01 — toast+undo su "Capitolo fatto".
5. PROP-gym-02 — "L'ultima volta" nel micro-editor set.
6. PROP-task-01 — sezione "Più avanti" (zona morta +8g).
7. PROP-oggi-01 — tile di Oggi tappabili (`[home]`: re-misura chunk).
8. PROP-imp-01 — skeleton su Impostazioni.
Riserve: PROP-focus-03 spacebar; PROP-stats-01 delta; PROP-diet-01 numero rimanente.
