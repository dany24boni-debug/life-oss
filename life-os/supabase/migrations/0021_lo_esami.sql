-- Life OS — Run 05, prompt 3: specchio sync del modulo Esami (stub 15).
-- SOLO FILE: scritta dalla sessione, NON applicata — il gate è di Davide.
--
-- Convenzioni identiche a 0019 (leggere quel file per il razionale):
-- prefisso lo_, colonne entità 1:1 con ExamSchema di data/schemas.ts,
-- doppio timestamp (updated_at client per LWW, server_updated_at trigger
-- per il cursore di pull), PK composita (user_id, id), RLS + grant
-- espliciti, e la RPC lo_push RIDECLARATA con l'allowlist estesa —
-- l'upsert LWW passa da lì, una tabella fuori lista non è pushabile.
-- La tabella legacy `exams` (0014) resta INTATTA: sorgente read-only
-- dell'importer.
--
-- Idempotente (rerunnabile).

create table if not exists public.lo_esami (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  total_chapters integer not null check (total_chapters between 0 and 999),
  completed_chapters integer not null check (completed_chapters between 0 and 999),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- Stessa cintura di 0014: i completati non superano mai il totale.
  constraint lo_esami_chapters_consistency check (completed_chapters <= total_chapters)
);

-- Indice di pull + trigger + RLS + grant (il blocco per-tabella di 0019).
do $$
declare
  t text;
begin
  foreach t in array array['lo_esami']
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
-- RPC lo_push: stessa funzione di 0019, allowlist estesa con lo_esami.
-- (create or replace: applicata dopo 0019 la sostituisce integralmente.)
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
    'lo_esami'
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
