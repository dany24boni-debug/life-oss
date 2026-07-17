-- Life OS — Run 11, prompt 1: i campi della giornata guidata.
-- SOLO due ALTER su tabelle esistenti — nessuna tabella nuova, quindi
-- NESSUNA ridichiarazione di lo_push (0029 resta finale a 28 tabelle:
-- il SET dinamico della funzione raccoglie da solo le colonne nuove via
-- information_schema, e jsonb_populate_recordset IGNORA le chiavi json
-- che non sono ancora colonne — un client nuovo che pusha su un server
-- non ancora migrato non rompe nulla: il campo cade a terra finché
-- questa migrazione non viene applicata).
--
-- 1. `lo_tasks.estimate_min` (PROP-task-05): durata stimata del task in
--    MINUTI INTERI (chips 15/30/60/90 nel rituale del mattino); null =
--    nessuna stima, mai obbligatoria. Alimenta il capacity-check del
--    rituale (somma stime vs tempo libero dall'agenda).
-- 2. `lo_meal_variants.training` (CROSS-02 fase 2): true = variante da
--    giorno di allenamento — nei giorni di allenamento la card del
--    pasto la PROPONE (mai imposta, un tap per applicare); null/false =
--    variante normale.
--
-- Gli schemi entità hanno `.default(null)`: le righe pre-run-11 (e i
-- backup) passano il parse senza scarti (house pattern run-09).
-- ATTENZIONE AL GATE: LWW è per-riga — un client NON aggiornato che
-- riscrive una riga evoluta azzera i campi nuovi al push. Dopo apply:
-- aggiornare l'app su TUTTI i dispositivi collegati, nessuno escluso.
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0031, in ordine.
--
-- Idempotente (rerunnabile).

alter table public.lo_tasks
  add column if not exists estimate_min integer;

comment on column public.lo_tasks.estimate_min is
  'Durata stimata in minuti interi (rituale del mattino, run-11); null = nessuna stima.';

alter table public.lo_meal_variants
  add column if not exists training boolean;

comment on column public.lo_meal_variants.training is
  'true = variante da giorno di allenamento (proposta, mai imposta — run-11); null/false = normale.';

notify pgrst, 'reload schema';
