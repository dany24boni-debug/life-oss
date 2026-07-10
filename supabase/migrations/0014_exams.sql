-- Life OS — Phase 10 schema (Esami / Pacing)
-- Sprint A feature 1: countdown intelligente + pacing.
-- Idempotent.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  exam_date date not null,
  total_chapters int not null default 0 check (total_chapters >= 0),
  completed_chapters int not null default 0 check (completed_chapters >= 0),
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Integrity invariant: completed never exceeds total. The server
  -- actions clamp this at write time, but a misbehaving client (or
  -- direct PostgREST call from a stale session) could bypass that.
  -- Belt-and-suspenders.
  constraint exams_chapters_consistency check (completed_chapters <= total_chapters)
);

-- Idempotent guard for the case where the table existed before this
-- constraint was added: ALTER ... ADD CONSTRAINT IF NOT EXISTS is
-- not supported by Postgres directly, so we use DO with a lookup.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exams_chapters_consistency'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
      add constraint exams_chapters_consistency
      check (completed_chapters <= total_chapters);
  end if;
end $$;

-- "Prossimo esame" widget runs:
--   select ... where user_id = auth.uid() order by exam_date asc limit 1
-- Index covers the WHERE + ORDER BY without touching the heap.
create index if not exists idx_exams_user_exam_date
  on public.exams (user_id, exam_date);

alter table public.exams enable row level security;

drop policy if exists "Users own exams" on public.exams;
create policy "Users own exams" on public.exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at touch trigger. Re-defined as CREATE OR REPLACE so the
-- migration is idempotent.
create or replace function public.touch_exams_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_exams_touch_updated_at on public.exams;
create trigger trg_exams_touch_updated_at
  before update on public.exams
  for each row execute function public.touch_exams_updated_at();

notify pgrst, 'reload schema';
