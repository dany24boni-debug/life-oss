-- Life OS — Run 09, prompt 3: ricorrenza dei task.
-- SOLO un ALTER su lo_tasks: la regola di ripetizione viaggia come
-- jsonb ({"freq":"daily"} oppure {"freq":"weekly","weekdays":[1,4]}),
-- null = mai. Nessuna tabella nuova, quindi NESSUNA ridichiarazione di
-- lo_push (l'allowlist non cambia; il SET dinamico della funzione
-- raccoglie da solo la colonna nuova via information_schema).
--
-- La ripetizione è BASATA SUL COMPLETAMENTO (client): completare
-- genera la prossima occorrenza con id derivato
-- `lifeos:task-recur:<completed_task_id>` — due dispositivi che
-- completano offline la stessa istanza convergono sulla stessa PK.
-- Lo schema entità ha `.default(null)`: le righe pre-run-09 (e i
-- backup) passano il parse senza scarti.
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0029, in ordine.
--
-- Idempotente (rerunnabile).

alter table public.lo_tasks
  add column if not exists recurrence jsonb;

comment on column public.lo_tasks.recurrence is
  'Regola di ripetizione ({"freq":"daily"|"weekly","weekdays":[1..7]}); null = mai. Spawn sul completamento, lato client (run-09).';

notify pgrst, 'reload schema';
