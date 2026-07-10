-- Life OS — Phase 8 schema (External Calendar Integration — V0)
-- Connects /agenda to external calendars (Google in V0, Apple later).
-- V0 scope: read-only Google Calendar via OAuth2.
-- Idempotent.

-- 1. Connected external accounts.
--    Tokens stored AES-256-GCM ciphertext (lib/crypto/token-cipher.ts) —
--    NEVER plaintext. Master key lives in TOKEN_ENCRYPTION_KEY env var.
create table if not exists public.external_calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text check (provider in ('google','apple')) not null,
  external_account_email text not null,        -- email of the linked external account
  access_token_ciphertext text not null,       -- AES-256-GCM (base64: iv|ciphertext|authTag)
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  scope text not null,                          -- granted OAuth scopes (space-separated)
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz default now()
);

-- One account per (user, provider, email). Allows multi-account in future
-- without schema change; V0 enforces a single Google account in app logic.
create unique index if not exists uniq_ext_calendar_account_per_user_email
  on public.external_calendar_accounts (user_id, provider, external_account_email);

create index if not exists idx_ext_calendar_accounts_user
  on public.external_calendar_accounts (user_id);

alter table public.external_calendar_accounts enable row level security;
drop policy if exists "Users own external_calendar_accounts" on public.external_calendar_accounts;
create policy "Users own external_calendar_accounts" on public.external_calendar_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Cached events imported from the external provider.
--    Re-populated on every refresh; UPSERT keyed on (account_id, external_id).
create table if not exists public.external_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.external_calendar_accounts(id) on delete cascade not null,
  external_id text not null,                   -- provider event id (e.g. Google event.id)
  external_calendar_id text not null,          -- e.g. 'primary'
  title text,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean default false,
  status text,                                  -- 'confirmed' | 'tentative' | 'cancelled'
  html_link text,                               -- deep-link back to the provider UI
  fetched_at timestamptz default now()
);

create unique index if not exists uniq_ext_calendar_event_per_account
  on public.external_calendar_events (account_id, external_id);

create index if not exists idx_ext_calendar_events_user_starts
  on public.external_calendar_events (user_id, starts_at);

create index if not exists idx_ext_calendar_events_account_starts
  on public.external_calendar_events (account_id, starts_at);

alter table public.external_calendar_events enable row level security;
drop policy if exists "Users own external_calendar_events" on public.external_calendar_events;
create policy "Users own external_calendar_events" on public.external_calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
