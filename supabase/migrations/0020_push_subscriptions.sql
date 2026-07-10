-- Life OS — Run 04, prompt 08: tabella RISERVATA alle notifiche push web
-- (prompt 17). Scritta ora insieme alle tabelle sync così l'applicazione
-- delle migrazioni al gate di Davide è un colpo solo; NESSUN codice la usa
-- fino al prompt 17.
--
-- Prefisso `lo_` come il resto delle tabelle nuove (0019). NON è una tabella
-- specchio del sync engine: le subscription push sono per-dispositivo e
-- nascono/muoiono lato server, quindi id server-side (gen_random_uuid) e
-- niente colonna server_updated_at/tombstone.
--
-- Colonne dal contratto Web Push (PushSubscription.toJSON()):
--   endpoint  — URL unico della subscription presso il push service
--   p256dh    — chiave pubblica del client (base64url)
--   auth      — segreto di autenticazione (base64url)
-- UNIQUE (user_id, endpoint): ri-registrare lo stesso browser aggiorna,
-- non duplica.
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lo_push_subscriptions_endpoint_unique unique (user_id, endpoint)
);

create index if not exists idx_lo_push_subscriptions_user
  on public.lo_push_subscriptions (user_id);

alter table public.lo_push_subscriptions enable row level security;

drop policy if exists "Users own lo_push_subscriptions" on public.lo_push_subscriptions;
create policy "Users own lo_push_subscriptions" on public.lo_push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.lo_push_subscriptions to authenticated;
revoke all on public.lo_push_subscriptions from anon;

notify pgrst, 'reload schema';
