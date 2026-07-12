-- Life OS — Run 08, prompt 3: specchio sync del Planner settimanale
-- (modelli di settimana "Settimana lavoro": piano attivo, slot orari
-- per giorno feriale scritti una volta, check per (slot, settimana
-- ISO) con id derivato dal CLIENT
-- `lifeos:slot-check:<slot_id>:<iso_week>` — una riga per slot per
-- settimana per costruzione, pattern lo_sera/lo_body/lo_habit_logs:
-- quindi nessun unique(user_id, slot_id, iso_week) server-side).
-- La storia è append-only per costruzione: i check delle settimane
-- passate sono righe indipendenti che nessuno riscrive.
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0026, in ordine.
--
-- Convenzioni identiche a 0019/0021-0026. Colonne 1:1 con gli schemi
-- di data/schemas.ts. Niente FK tra tabelle entità (0019: i push sono
-- per-tabella, l'ordine di arrivo non è garantito). "Al più un piano
-- attivo" è un invariante del client (repo), non un vincolo server.
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_week_plans (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_plan_slots (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_hhmm text not null check (start_hhmm ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_hhmm text check (end_hhmm is null or end_hhmm ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title text not null,
  notes text,
  sort_order double precision not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_slot_checks (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_id uuid not null,
  iso_week text not null check (iso_week ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  state text check (state is null or state in ('done', 'skipped')),
  checked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Indice di pull + trigger + RLS + grant (il blocco per-tabella di 0019).
do $$
declare
  t text;
begin
  foreach t in array array['lo_week_plans', 'lo_plan_slots', 'lo_slot_checks']
  loop
    execute format(
      'create index if not exists idx_%1$s_pull on public.%1$I (user_id, server_updated_at)',
      t
    );

    execute format(
      'drop trigger if exists trg_%1$s_touch_server on public.%1$I', t
    );
    execute format(
      'create trigger trg_%1$s_touch_server before insert or update on public.%1$I
         for each row execute function public.lo_touch_server_updated_at()',
      t
    );

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Users own %1$s" on public.%1$I', t);
    execute format(
      'create policy "Users own %1$s" on public.%1$I for all to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );

    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ============================================================
-- RPC lo_push: stessa funzione, allowlist completa al run-08 P3.
-- ============================================================
create or replace function public.lo_push(p_table text, p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'lo_tasks', 'lo_events', 'lo_gym_exercises', 'lo_gym_plans',
    'lo_gym_sessions', 'lo_gym_sets', 'lo_reminders', 'lo_settings',
    'lo_esami', 'lo_spese', 'lo_sera',
    'lo_gym_programs', 'lo_gym_program_days', 'lo_gym_program_slots',
    'lo_body',
    'lo_habits', 'lo_habit_logs',
    'lo_week_plans', 'lo_plan_slots', 'lo_slot_checks'
  ];
  set_list text;
  written integer;
begin
  if auth.uid() is null then
    raise exception 'lo_push richiede un utente autenticato';
  end if;
  if p_table is null or not (p_table = any(allowed)) then
    raise exception 'lo_push: tabella non consentita (%)', coalesce(p_table, 'null');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'lo_push: p_rows deve essere un array json';
  end if;

  -- SET dinamico: tutte le colonne tranne le chiavi e quella del server.
  select string_agg(format('%1$I = excluded.%1$I', column_name), ', ')
    into set_list
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table
    and column_name not in ('id', 'user_id', 'server_updated_at');

  execute format(
    $f$
    insert into public.%1$I as t
    select r.*
    from jsonb_populate_recordset(
      null::public.%1$I,
      (
        select coalesce(jsonb_agg(
          (e - 'server_updated_at') || jsonb_build_object('user_id', auth.uid())
        ), '[]'::jsonb)
        from jsonb_array_elements($1) e
      )
    ) r
    on conflict (user_id, id) do update set %2$s
    where t.updated_at < excluded.updated_at
    $f$,
    p_table, set_list
  ) using p_rows;

  get diagnostics written = row_count;
  return written;
end;
$$;

grant execute on function public.lo_push(text, jsonb) to authenticated;
revoke execute on function public.lo_push(text, jsonb) from anon, public;

notify pgrst, 'reload schema';
