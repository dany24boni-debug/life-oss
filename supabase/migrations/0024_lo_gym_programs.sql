-- Life OS — Run 07, prompt 1: specchio sync dei Programmi di allenamento
-- (il modello del foglio reale: programma → giorni → slot con sezioni,
-- varianti e prescrizioni TESTUALI: reps "3–5", RIR "1–2" o "2/1/0").
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
-- Da applicare DOPO 0019-0023, in ordine.
--
-- Convenzioni identiche a 0019/0021-0023. Colonne 1:1 con gli schemi di
-- data/schemas.ts. In più, questo run EVOLVE due tabelle esistenti:
--   * lo_gym_sessions: + program_day_id (seduta partita da un giorno di
--     programma), + rating_1_10 (voto generale della seduta, dal foglio);
--   * lo_gym_sets: + rir_done (0-5), + rest_actual_s (recupero reale),
--     + feeling_1_10 — le colonne del foglio, per-set.
--   (weight_kg era GIÀ nullable da 0019: i set a corpo libero sono
--   legali da sempre; nessun cambiamento lì.)
-- Niente FK tra tabelle entità (0019: i push sono per-tabella, l'ordine
-- di arrivo non è garantito). "Al più un programma attivo" è un
-- invariante del client (repo), non un vincolo server: un vincolo qui
-- farebbe fallire i push nei merge tra dispositivi senza aggiungere
-- verità — la lettura sceglie l'updated_at più recente.
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_gym_programs (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  is_active boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_program_days (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null,
  name text not null,
  subtitle text,
  weekday smallint check (weekday is null or weekday between 1 and 7),
  sort_order double precision not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_program_slots (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null,
  exercise_id uuid not null,
  section text check (section is null or char_length(section) between 1 and 40),
  variant text check (variant is null or char_length(variant) between 1 and 80),
  target_sets integer not null check (target_sets between 1 and 10),
  target_reps text check (target_reps is null or char_length(target_reps) between 1 and 20),
  target_rir text check (target_rir is null or char_length(target_rir) between 1 and 20),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 900),
  bodyweight boolean not null,
  notes text,
  sort_order double precision not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ============================================================
-- Evoluzione delle tabelle esistenti (add column if not exists:
-- rerunnabile; il check inline vale alla creazione della colonna).
-- ============================================================
alter table public.lo_gym_sessions
  add column if not exists program_day_id uuid;
alter table public.lo_gym_sessions
  add column if not exists rating_1_10 smallint
    check (rating_1_10 is null or rating_1_10 between 1 and 10);

alter table public.lo_gym_sets
  add column if not exists rir_done smallint
    check (rir_done is null or rir_done between 0 and 5);
alter table public.lo_gym_sets
  add column if not exists rest_actual_s integer
    check (rest_actual_s is null or rest_actual_s between 0 and 3600);
alter table public.lo_gym_sets
  add column if not exists feeling_1_10 smallint
    check (feeling_1_10 is null or feeling_1_10 between 1 and 10);

-- Indice di pull + trigger + RLS + grant (il blocco per-tabella di 0019).
do $$
declare
  t text;
begin
  foreach t in array array[
    'lo_gym_programs', 'lo_gym_program_days', 'lo_gym_program_slots'
  ]
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
-- RPC lo_push: stessa funzione, allowlist completa al run-07.
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
    'lo_gym_programs', 'lo_gym_program_days', 'lo_gym_program_slots'
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
