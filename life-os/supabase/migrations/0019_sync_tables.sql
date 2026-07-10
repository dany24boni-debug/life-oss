-- Life OS — Run 04, prompt 08: tabelle specchio del sync engine (B3.1/B3.2).
-- SOLO FILE: questa migrazione viene scritta dalla sessione ma NON applicata —
-- l'applicazione ai progetti Supabase è il gate di Davide (decisione D6 prima).
--
-- Disegno (una sezione per concern, tutto in un file perché le tabelle sono
-- un unico concern: lo specchio riga-per-riga del Dexie locale):
--
--   * Prefisso uniforme `lo_` per OGNI tabella nuova: il DB legacy ha già
--     `gym_sessions` e `user_events`, quindi le forme nuove non possono usare
--     i nomi nudi. `lo_tasks`, `lo_events`, `lo_gym_*`, `lo_reminders`,
--     `lo_settings` (+ `lo_push_subscriptions` in 0020, riservata al prompt 17).
--   * Il server è uno SPECCHIO passivo: le colonne entità combaciano 1:1 con
--     gli schemi zod di data/schemas.ts (già snake_case). Niente business
--     logic server-side, niente FK tra tabelle entità (i push sono per-tabella
--     e l'ordine di arrivo non è garantito: un set può arrivare prima della
--     sua sessione — esattamente come nel Dexie locale, che non ha FK).
--   * DUE timestamp con ruoli diversi:
--       - `updated_at` (client, base LWW): scritto dal client, MAI toccato dal
--         server. Un trigger touch qui romperebbe il last-write-wins.
--       - `server_updated_at` (server, cursore di pull): default now() +
--         trigger BEFORE INSERT OR UPDATE che lo forza sempre a now(). Il
--         cursore di pull legge questo, NON updated_at: un cursore sul clock
--         client perderebbe per sempre le righe di un dispositivo rimasto
--         offline (updated_at di ieri arriva sul server oggi, ma gli altri
--         dispositivi hanno già il cursore a oggi). Deviazione documentata
--         dal brief (che chiedeva l'indice su (user_id, updated_at)): l'indice
--         di pull è su (user_id, server_updated_at).
--   * PK composita (user_id, id): target di conflitto uniforme per l'upsert
--     (funziona anche per lo_settings, il cui id è il letterale 'local'), e
--     nessuno può "occupare" l'id altrui conoscendone l'UUID.
--   * `id` uuid (UUIDv7 generato dal client) su tutte le tabelle entità;
--     lo_settings usa `id text check (id = 'local')` — adattamento alla
--     realtà: la riga impostazioni locale ha id fisso "local", non un uuid.
--   * Orari "HH:MM" come text + check (NON `time`: PostgREST renderebbe
--     "HH:MM:SS" e romperebbe HhmmSchema al round-trip). Date civili come
--     `date` (round-trip "YYYY-MM-DD" esatto). Array/oggetti come jsonb.
--   * RLS per-utente su ogni tabella + grant espliciti (lezione 0018).
--   * Push tramite RPC `lo_push`: upsert con guardia LWW atomica
--     (`where t.updated_at < excluded.updated_at`) — un plain upsert
--     PostgREST non sa esprimerla e un push da un dispositivo stale
--     sovrascriverebbe la versione più nuova.
--
-- Idempotente (rerunnabile).

-- ============================================================
-- 0. Trigger condiviso: server_updated_at = now(), sempre.
-- ----------------------------------------------------------------
-- BEFORE INSERT OR UPDATE su ogni tabella lo_*: il client non può forgiare
-- il cursore di pull, e ogni scrittura reale (anche un upsert LWW vinto)
-- diventa visibile ai pull altrui. Quando la guardia LWW scarta l'update,
-- il trigger non scatta e server_updated_at resta fermo: niente eco.
-- ============================================================
create or replace function public.lo_touch_server_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- 1. Tabelle specchio (colonne entità 1:1 con data/schemas.ts)
-- ============================================================

create table if not exists public.lo_tasks (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  date date,
  "time" text check ("time" is null or "time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  priority smallint check (priority is null or priority in (1, 2, 3)),
  tags jsonb not null default '[]'::jsonb,
  module_link jsonb,
  status text not null check (status in ('open', 'done')),
  completed_at timestamptz,
  sort_order double precision not null,
  subtasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_events (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  all_day boolean not null,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_exercises (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null check (
    muscle_group in ('petto','schiena','gambe','spalle','braccia','addominali','cardio','altro')
  ),
  default_rest_seconds integer check (
    default_rest_seconds is null or default_rest_seconds between 0 and 900
  ),
  note text,
  is_custom boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_plans (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_sessions (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  plan_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_gym_sets (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  exercise_id uuid not null,
  set_number integer not null check (set_number between 1 and 99),
  weight_kg numeric check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 2000)),
  reps integer not null check (reps between 0 and 999),
  done_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_reminders (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'event')),
  ref_id uuid not null,
  fire_at timestamptz not null,
  fired_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.lo_settings (
  id text not null check (id = 'local'),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  theme text not null check (theme in ('dark', 'light', 'system')),
  protected_days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ============================================================
-- 2. Indici di pull + trigger + RLS + grant, uguali per tutte
-- ----------------------------------------------------------------
-- Un blocco DO unico così l'elenco delle tabelle vive in un posto solo.
-- Grant espliciti a authenticated (lezione 0018: mai fidarsi dei default),
-- revoca esplicita ad anon: queste tabelle si leggono/scrivono solo da
-- utenti autenticati, la RLS `auth.uid() = user_id` fa il resto.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'lo_tasks', 'lo_events', 'lo_gym_exercises', 'lo_gym_plans',
    'lo_gym_sessions', 'lo_gym_sets', 'lo_reminders', 'lo_settings'
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
-- 3. RPC di push: upsert con guardia LWW atomica
-- ----------------------------------------------------------------
-- SECURITY INVOKER (default): la RLS delle tabelle si applica al chiamante.
-- Difese: allowlist dura dei nomi tabella, user_id FORZATO a auth.uid() su
-- ogni riga (il client non può nemmeno sbagliarlo), server_updated_at
-- rimosso dall'input (lo possiede il trigger). La guardia
-- `where t.updated_at < excluded.updated_at` scarta i push stale: un
-- dispositivo rimasto indietro non può sovrascrivere una versione più nuova
-- (LWW anche lato server, non solo al pull). Righe identiche (eco del pull)
-- non aggiornano nulla e non muovono server_updated_at.
-- Ritorna il numero di righe effettivamente scritte (insert + update vinti).
-- ============================================================
create or replace function public.lo_push(p_table text, p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'lo_tasks', 'lo_events', 'lo_gym_exercises', 'lo_gym_plans',
    'lo_gym_sessions', 'lo_gym_sets', 'lo_reminders', 'lo_settings'
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
