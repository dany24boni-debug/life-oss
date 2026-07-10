-- Life OS - Phase 1 cleanup
-- Drops any pre-existing trigger/function on auth.users that enforces a
-- legacy institutional-email domain check (Phase 0 V0 artifact).
-- Idempotent: safe to run repeatedly. Preserves our own triggers
-- (on_auth_user_created, on_auth_user_email_updated).
--
-- Sprint S4 (share-prep) scrub: the original literal pattern referenced
-- a specific university domain. The replacement pattern below
-- ('legacy_institutional_email') matches nothing on fresh installs (no
-- function with that source has ever existed); the loop is therefore a
-- no-op for new clones, and a no-op on already-migrated DBs (legacy
-- artifacts were dropped at the original apply time).

do $$
declare
  r record;
begin
  -- 1) Drop non-internal triggers on auth.users that are NOT the ones we manage.
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on t.tgrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
      and t.tgname not in ('on_auth_user_created', 'on_auth_user_email_updated')
  loop
    execute format('drop trigger if exists %I on auth.users cascade', r.tgname);
    raise notice 'Dropped trigger: %', r.tgname;
  end loop;

  -- 2) Drop functions whose source mentions the legacy institutional-
  --    email keywords, excluding our own (handle_new_user,
  --    handle_user_email_update). Post-S4 the keywords are placeholders
  --    that match nothing on fresh installs — see header comment.
  for r in
    select n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where (p.prosrc ilike '%legacy_institutional_email%' or p.prosrc ilike '%legacy_institutional_signup%')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      and p.proname not in ('handle_new_user', 'handle_user_email_update')
  loop
    execute format(
      'drop function if exists %I.%I(%s) cascade',
      r.nspname, r.proname, r.args
    );
    raise notice 'Dropped function: %.%(%)', r.nspname, r.proname, r.args;
  end loop;
end $$;

-- 3) Verify only our triggers remain on auth.users.
select t.tgname as trigger_name,
       case when t.tgisinternal then 'internal' else 'user' end as kind
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'auth' and c.relname = 'users'
order by t.tgname;