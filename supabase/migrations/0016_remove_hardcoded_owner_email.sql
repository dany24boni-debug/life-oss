-- Life OS — share-prep refactor
--
-- Rimuove l'hardcoded owner-email da migration 0007. La function
-- `handle_owner_bootstrap` + il trigger `on_auth_user_owner_bootstrap`
-- contenevano un literal email come SQL constant, side-effect-applicabile
-- a OGNI nuovo signup auth.
--
-- Su una clone pulita quella stringa era leak personale esplicito.
-- Soluzione: DROP totale del meccanismo di auto-bootstrap. L'ownership
-- promotion diventa azione esplicita via `scripts/promote-to-owner.mjs
-- <email>` (idempotent, post-signup).
--
-- Non perdo dati: i profili owner esistenti (chiunque abbia
-- `is_owner=true` dopo l'apply di 0007) restano invariati. La
-- function/trigger è solo per nuovi signup futuri — non aveva mai
-- toccato i dati esistenti se non al moment del signup originale.
--
-- Idempotente: re-apply non rompe nulla — drop ... if exists.

drop trigger if exists on_auth_user_owner_bootstrap on auth.users;
drop function if exists public.handle_owner_bootstrap();

-- Reload pgrst schema cache so the dropped function is no longer
-- reachable via PostgREST RPC (defence in depth — the trigger is
-- gone, but the function would still be RPC-callable until the
-- cache reloads).
notify pgrst, 'reload schema';
