-- Life OS — Run 08, prompt 1: specchio sync del motore Abitudini
-- (abitudini boolean/counter/quantity con obiettivo giornaliero e
-- schedule per giorni feriali; log UNA riga per (abitudine, giorno)
-- garantita dal CLIENT per costruzione: id derivato
-- `lifeos:habit-log:<habit_id>:<date>`, pattern lo_sera/lo_body —
-- quindi nessun unique(user_id, habit_id, date) server-side, farebbe
-- solo fallire i push nei merge senza aggiungere verità).
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0025, in ordine.
--
-- Convenzioni identiche a 0019/0021-0025. Colonne 1:1 con gli schemi di
-- data/schemas.ts; array (weekdays) come jsonb, come tags/protected_days.
-- Niente FK tra tabelle entità (0019: i push sono per-tabella, l'ordine
-- di arrivo non è garantito).
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_habits (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null,
  kind text not null check (kind in ('boolean', 'counter', 'quantity')),
  unit text check (unit is null or char_length(unit) between 1 and 20),
  daily_target numeric check (
    daily_target is null or (daily_target > 0 and daily_target <= 100000)
  ),
  weekdays jsonb,
  sort_order double precision not null,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_habit_logs (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  date date not null,
  value numeric not null check (value >= 0 and value <= 1000000),
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
  foreach t in array array['lo_habits', 'lo_habit_logs']
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
-- RPC lo_push: stessa funzione, allowlist completa al run-08 P1.
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
    'lo_habits', 'lo_habit_logs'
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
