-- SECURITY: fm_insert_transaction / fm_retag_transaction are SECURITY DEFINER and
-- trust their p_owner argument. Supabase's default privileges grant EXECUTE on new
-- public functions to anon + authenticated, which let the public anon key call these
-- RPCs over PostgREST and write into ANY owner's ledger (RLS is bypassed by SECURITY
-- DEFINER). The app + MCP server only ever call these through the service-role client,
-- so revoking anon/authenticated/public is safe and closes the cross-tenant hole.
--
-- NOTE: any future `create or replace` of these functions re-applies the default
-- grants — re-run this REVOKE after redefining them.
revoke execute on function public.fm_insert_transaction(
  text, uuid, text, date, bigint, bigint, text, txn_direction, text, text, text, text, text, boolean, uuid, uuid
) from anon, authenticated, public;

revoke execute on function public.fm_retag_transaction(text, uuid, jsonb) from anon, authenticated, public;
