-- RPC mutations that touch transactions + allocations in ONE db transaction,
-- so the deferrable sum-to-total constraint is satisfied at commit. PostgREST
-- runs each REST insert as its own transaction, so these can't be split into
-- separate client calls.

-- Upsert a canonical transaction + (re)set a single full-amount allocation.
create or replace function fm_insert_transaction(
  p_owner text,
  p_account uuid,
  p_external_id text,
  p_posted date,
  p_amount bigint,
  p_raw_amount bigint,
  p_raw_sign text,
  p_direction txn_direction,
  p_currency text,
  p_merchant text,
  p_description text,
  p_pfc_primary text,
  p_pfc_detailed text,
  p_pending boolean,
  p_project uuid,
  p_category uuid
) returns uuid
language plpgsql security definer as $$
declare v_txn uuid;
begin
  insert into transactions (
    owner_id, financial_account_id, external_id, posted_at, amount_cents,
    raw_amount_cents, raw_sign_source, direction, currency, merchant_name,
    description, pfc_primary, pfc_detailed, pending)
  values (
    p_owner, p_account, p_external_id, p_posted, p_amount, p_raw_amount,
    p_raw_sign, p_direction, p_currency, p_merchant, p_description,
    p_pfc_primary, p_pfc_detailed, coalesce(p_pending, false))
  on conflict (financial_account_id, external_id) do update set
    amount_cents = excluded.amount_cents,
    merchant_name = excluded.merchant_name,
    description = excluded.description,
    pending = excluded.pending
  returning id into v_txn;

  delete from transaction_allocations where transaction_id = v_txn;
  insert into transaction_allocations (owner_id, transaction_id, project_id, category_id, amount_cents)
  values (p_owner, v_txn, p_project, p_category, p_amount);

  return v_txn;
end $$;

-- Re-tag / split a transaction. p_allocs = jsonb array of
-- {project_id, amount_cents, category_id?, note?}. Replaces all allocations.
create or replace function fm_retag_transaction(
  p_owner text,
  p_txn uuid,
  p_allocs jsonb
) returns void
language plpgsql security definer as $$
declare rec jsonb;
begin
  if not exists (select 1 from transactions where id = p_txn and owner_id = p_owner) then
    raise exception 'transaction not found for owner';
  end if;
  delete from transaction_allocations where transaction_id = p_txn;
  for rec in select * from jsonb_array_elements(p_allocs) loop
    insert into transaction_allocations (owner_id, transaction_id, project_id, amount_cents, category_id, note)
    values (
      p_owner,
      p_txn,
      (rec->>'project_id')::uuid,
      (rec->>'amount_cents')::bigint,
      nullif(rec->>'category_id', '')::uuid,
      nullif(rec->>'note', ''));
  end loop;
end $$;
