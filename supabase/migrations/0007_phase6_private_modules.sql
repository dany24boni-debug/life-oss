-- Life OS — Phase 6 schema (Private Modules)
-- Tables for the whitelist-gated Chameleon OS module. Idempotent.

-- =============================================================================
-- CHAMELEON OS — milestones
-- =============================================================================
create table if not exists public.chameleon_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text check (status in ('todo','in_progress','done','dropped')) default 'todo',
  target_date date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_chameleon_milestones_user_status
  on public.chameleon_milestones (user_id, status);

alter table public.chameleon_milestones enable row level security;
drop policy if exists "Users own chameleon_milestones" on public.chameleon_milestones;
create policy "Users own chameleon_milestones" on public.chameleon_milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- CHAMELEON OS — partner sync log
-- =============================================================================
create table if not exists public.chameleon_partner_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  duration_minutes int check (duration_minutes > 0),
  topics text,
  decisions text,
  next_actions text,
  created_at timestamptz default now()
);

create index if not exists idx_chameleon_sync_user_date
  on public.chameleon_partner_sync (user_id, date desc);

alter table public.chameleon_partner_sync enable row level security;
drop policy if exists "Users own chameleon_partner_sync" on public.chameleon_partner_sync;
create policy "Users own chameleon_partner_sync" on public.chameleon_partner_sync
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- Owner promotion happens explicitly via `scripts/promote-to-owner.mjs <email>`
-- after the owner signs up. No automatic trigger ships with this migration.
-- =============================================================================

notify pgrst, 'reload schema';
