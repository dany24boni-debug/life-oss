-- Life OS — Run 09, prompt 5 (blueprint 17): ciò che manca alla
-- tabella riservata di 0020 per il percorso push completo.
--
-- Audit di 0020 (fatto prima di scrivere): lo_push_subscriptions ha
-- GIÀ endpoint, p256dh, auth, user_agent, created/updated e la UNIQUE
-- (user_id, endpoint). MANCA solo l'opt-in per categoria: si aggiunge
-- `categories` jsonb ({"reminders":bool,"brief":bool,"streak":bool}).
-- Null = nessuna categoria attiva (il sender salta la riga).
--
-- In più: `lo_push_sends`, il registro di idempotenza del sender
-- (SOLO service role: RLS accesa e NESSUNA policy = negato a tutti i
-- ruoli client; niente grant). Una riga per (utente, chiave di
-- dedupe): "reminder:<id>", "brief:<YYYY-MM-DD>", "streak:<YYYY-MM-DD>"
-- — il cron può girare quanto vuole, ogni notifica parte UNA volta.
-- NON è una tabella sync (nessuna voce nel registro client, nessuna
-- ridichiarazione di lo_push: l'allowlist non cambia).
--
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di
-- Davide. Da applicare DOPO 0030, in ordine.
--
-- Idempotente (rerunnabile).

alter table public.lo_push_subscriptions
  add column if not exists categories jsonb;

comment on column public.lo_push_subscriptions.categories is
  'Opt-in per categoria: {"reminders":bool,"brief":bool,"streak":bool}; null = nessuna attiva.';

create table if not exists public.lo_push_sends (
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, dedupe_key)
);

comment on table public.lo_push_sends is
  'Idempotenza del push-sender (service role only): una riga per notifica partita.';

-- RLS accesa senza policy: i ruoli client non leggono né scrivono;
-- il service role della Edge Function bypassa RLS per costruzione.
alter table public.lo_push_sends enable row level security;
revoke all on public.lo_push_sends from anon, authenticated;

notify pgrst, 'reload schema';
