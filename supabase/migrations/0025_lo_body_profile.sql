-- Life OS — Run 07, prompt 4: peso corporeo (lo_body) + profilo su
-- lo_settings (altezza, sesso, anno di nascita, livello di attività —
-- servono SOLO alle stime derivate: acqua, calorie; data/derived.ts).
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0024, in ordine.
--
-- Convenzioni identiche a 0019/0021-0024. lo_body è "una riga per
-- giorno" garantita dal CLIENT per costruzione (id derivato dalla data,
-- pattern lo_sera): nessun unique(user_id, date) server-side — farebbe
-- solo fallire i push nei merge senza aggiungere verità.
-- NOTA importer: nel DB legacy NON esiste una tabella di pesi corporei
-- (l'unico weight_kg è il carico di gym_workouts, già importato dal
-- run-04) — quindi nessun importer legacy per lo_body, per onestà.
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_body (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg >= 20 and weight_kg <= 400),
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ============================================================
-- Profilo su lo_settings (add column if not exists: rerunnabile;
-- i check inline valgono alla creazione della colonna).
-- ============================================================
alter table public.lo_settings
  add column if not exists height_cm smallint
    check (height_cm is null or height_cm between 100 and 250);
alter table public.lo_settings
  add column if not exists sex text
    check (sex is null or sex in ('m', 'f'));
alter table public.lo_settings
  add column if not exists birth_year smallint
    check (birth_year is null or birth_year between 1900 and 2100);
alter table public.lo_settings
  add column if not exists activity_level smallint
    check (activity_level is null or activity_level between 1 and 5);

-- Indice di pull + trigger + RLS + grant (il blocco per-tabella di 0019).
do $$
declare
  t text;
begin
  foreach t in array array['lo_body']
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
-- RPC lo_push: stessa funzione, allowlist completa al run-07 P4.
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
    'lo_body'
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
