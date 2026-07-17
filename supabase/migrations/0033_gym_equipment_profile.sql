-- Life OS — Run 12, prompt 1: profilo attrezzatura palestra su lo_settings.
-- SOLO due ALTER sulla tabella profilo esistente (il pattern 0025 di
-- height_cm/sex) — nessuna tabella nuova, quindi NESSUNA ridichiarazione
-- di lo_push (0029 resta finale a 28 tabelle: il SET dinamico raccoglie
-- da solo le colonne nuove via information_schema, e
-- jsonb_populate_recordset IGNORA le chiavi json che non sono ancora
-- colonne — un client nuovo che pusha su un server non ancora migrato non
-- rompe nulla: il campo cade a terra finché questa migrazione non viene
-- applicata).
--
-- 1. `lo_settings.gym_bar_kg` (PROP-gym-03): peso del bilanciere in kg;
--    null = profilo attrezzatura non configurato.
-- 2. `lo_settings.gym_plates` (PROP-gym-03): dischi posseduti, array json
--    [{"kg": 20, "n": 4}, ...] — n = dischi TOTALI di quel taglio (il
--    calcolatore usa le coppie: floor(n/2) per lato). Il contratto del
--    contenuto è dello zod client, pattern protected_days: jsonb nudo.
--
-- Il profilo attrezzatura è SINCRONIZZATO, non per-dispositivo: i dischi
-- sono una proprietà della palestra di chi si allena, non del telefono —
-- si configura comodi dal desktop, si usa sotto al bilanciere dal
-- telefono. Gli schemi entità hanno `.default(null)`: righe pre-run-12 e
-- backup passano il parse senza scarti (house pattern run-09).
-- ATTENZIONE AL GATE: LWW è per-riga — un client NON aggiornato che
-- riscrive la riga settings azzera i campi nuovi al push. Dopo apply:
-- aggiornare l'app su TUTTI i dispositivi collegati, nessuno escluso.
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0032, in ordine.
--
-- Idempotente (rerunnabile).

alter table public.lo_settings
  add column if not exists gym_bar_kg numeric
    check (gym_bar_kg is null or (gym_bar_kg >= 1 and gym_bar_kg <= 100));

comment on column public.lo_settings.gym_bar_kg is
  'Peso del bilanciere in kg (plate calculator, run-12); null = profilo attrezzatura non configurato.';

alter table public.lo_settings
  add column if not exists gym_plates jsonb;

comment on column public.lo_settings.gym_plates is
  'Dischi posseduti: array [{"kg": peso disco, "n": totale posseduti}] (plate calculator, run-12); null = non configurato.';

notify pgrst, 'reload schema';
