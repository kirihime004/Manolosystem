-- =========================================================================
-- Real double-entry accounting for IT and Admin asset disposal. Until now
-- both `after_insert_disposal()` (IT) and `dispose_admin_asset()` (Admin)
-- only flipped a status column -- disposing a $2,000 workstation left
-- zero trace in the books. This adds an explicit, separate posting step
-- (NOT bundled into the disposal action itself) so IT/Admin staff who
-- dispose an asset never need Finance permissions to do so -- a Finance
-- user posts the resulting entry afterward via its own action, matching
-- the platform-wide rule that financial postings are a distinct,
-- permission-gated step from the operational action that triggers them.
--
-- Accounting: since neither `assets` nor `admin_assets` track depreciation
-- (confirmed: no accumulated-depreciation column or schedule exists
-- anywhere), the full original purchase_price is written off as book
-- value. If the disposal recorded sale/return proceeds (IT's
-- `disposals.final_value`), the difference between cost and proceeds is
-- posted as a gain or loss (both use account 6910, which is signed by the
-- debit/credit side rather than needing a separate gain account), and the
-- proceeds themselves are posted to Cash (1100) -- the only account this
-- app can name without guessing which specific bank account received the
-- money. Skips posting (never guesses) when the asset has no recorded
-- purchase_price -- honest "nothing to write off" over a fabricated number.
-- =========================================================================
alter table public.disposals add column journal_entry_id uuid references public.journal_entries(id);
alter table public.admin_assets add column disposal_journal_entry_id uuid references public.journal_entries(id);

create or replace function public.post_it_asset_disposal_entry(p_company_id uuid, p_disposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_disposal public.disposals;
  v_asset public.assets;
  v_currency_id uuid;
  v_base_currency_id uuid;
  v_currency_note text := '';
  v_loss numeric;
  v_fixed_assets_account uuid;
  v_gain_loss_account uuid;
  v_cash_account uuid;
  v_je_id uuid;
  v_line_no int := 0;
begin
  if not public.has_permission(p_company_id, 'FINANCE.JOURNALS.POST') then
    raise exception 'Access denied';
  end if;

  select * into v_disposal from public.disposals where id = p_disposal_id and company_id = p_company_id;
  if v_disposal.id is null then raise exception 'Disposal record not found'; end if;
  if v_disposal.journal_entry_id is not null then raise exception 'This disposal already has a posted accounting entry'; end if;

  select * into v_asset from public.assets where id = v_disposal.asset_id;
  if v_asset.purchase_price is null or v_asset.purchase_price = 0 then
    raise exception 'Cannot post an accounting entry: this asset has no recorded purchase price.';
  end if;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = p_company_id;
  if v_base_currency_id is null then raise exception 'Company base currency is not configured'; end if;

  select id into v_currency_id from public.currencies where upper(code) = upper(v_asset.currency);
  if v_currency_id is null then
    v_currency_id := v_base_currency_id;
    v_currency_note := ' (currency code "' || v_asset.currency || '" could not be matched to a configured currency -- posted using the company base currency; verify and reclassify if needed)';
  end if;

  v_fixed_assets_account := public.get_account_by_code(p_company_id, '1500');
  v_gain_loss_account := public.get_account_by_code(p_company_id, '6910');
  v_cash_account := public.get_account_by_code(p_company_id, '1100');
  if v_fixed_assets_account is null or v_gain_loss_account is null then
    raise exception 'Required chart-of-accounts entries (1500 Fixed Assets, 6910 Gain/Loss on Disposal) are missing.';
  end if;

  v_loss := v_asset.purchase_price - coalesce(v_disposal.final_value, 0);

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (p_company_id, v_disposal.disposal_date, 'disposal', v_disposal.id,
    'Disposal of asset ' || v_asset.asset_code || ' (' || v_asset.name || ')' || v_currency_note, v_currency_id, v_base_currency_id)
  returning id into v_je_id;

  if coalesce(v_disposal.final_value, 0) > 0 then
    if v_cash_account is null then raise exception 'Required chart-of-accounts entry (1100 Cash) is missing.'; end if;
    v_line_no := v_line_no + 1;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, v_line_no, v_cash_account, 'Disposal proceeds: ' || v_asset.asset_code, v_disposal.final_value, 0);
  end if;

  if v_loss > 0.005 then
    v_line_no := v_line_no + 1;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, v_line_no, v_gain_loss_account, 'Loss on disposal: ' || v_asset.asset_code, v_loss, 0);
  elsif v_loss < -0.005 then
    v_line_no := v_line_no + 1;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, v_line_no, v_gain_loss_account, 'Gain on disposal: ' || v_asset.asset_code, 0, abs(v_loss));
  end if;

  v_line_no := v_line_no + 1;
  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
  values (v_je_id, v_line_no, v_fixed_assets_account, 'Write off asset cost: ' || v_asset.asset_code, 0, v_asset.purchase_price);

  perform public.post_journal_entry(v_je_id);

  update public.disposals set journal_entry_id = v_je_id where id = p_disposal_id;

  perform public.log_audit_event(p_company_id, 'ASSET_DISPOSAL_POSTED', 'disposal', p_disposal_id, jsonb_build_object('journal_entry_id', v_je_id));

  return v_je_id;
end;
$$;

grant execute on function public.post_it_asset_disposal_entry(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin assets: no `disposals`-style event table and no recorded sale
-- proceeds field -- always a full write-off of purchase_price. Already
-- carries a proper currency_id/base_currency_amount (computed at
-- purchase time via before_insert_admin_asset()), so this posts using
-- that historical snapshot rather than re-resolving currency.
-- ---------------------------------------------------------------------
create or replace function public.post_admin_asset_disposal_entry(p_company_id uuid, p_asset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset public.admin_assets;
  v_base_currency_id uuid;
  v_fixed_assets_account uuid;
  v_gain_loss_account uuid;
  v_je_id uuid;
begin
  if not public.has_permission(p_company_id, 'FINANCE.JOURNALS.POST') then
    raise exception 'Access denied';
  end if;

  select * into v_asset from public.admin_assets where id = p_asset_id and company_id = p_company_id;
  if v_asset.id is null then raise exception 'Admin asset not found'; end if;
  if v_asset.status not in ('DISPOSED', 'RETIRED', 'LOST', 'DAMAGED') then
    raise exception 'This asset has not been disposed.';
  end if;
  if v_asset.disposal_journal_entry_id is not null then raise exception 'This asset already has a posted disposal accounting entry'; end if;
  if v_asset.purchase_price is null or v_asset.purchase_price = 0 then
    raise exception 'Cannot post an accounting entry: this asset has no recorded purchase price.';
  end if;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = p_company_id;
  if v_base_currency_id is null then raise exception 'Company base currency is not configured'; end if;

  v_fixed_assets_account := public.get_account_by_code(p_company_id, '1500');
  v_gain_loss_account := public.get_account_by_code(p_company_id, '6910');
  if v_fixed_assets_account is null or v_gain_loss_account is null then
    raise exception 'Required chart-of-accounts entries (1500 Fixed Assets, 6910 Gain/Loss on Disposal) are missing.';
  end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (p_company_id, current_date, 'admin_asset_disposal', v_asset.id,
    'Disposal of admin asset ' || v_asset.asset_code || ' (' || v_asset.name || ')', coalesce(v_asset.currency_id, v_base_currency_id), v_base_currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit) values
    (v_je_id, 1, v_gain_loss_account, 'Loss on disposal: ' || v_asset.asset_code, v_asset.purchase_price, 0),
    (v_je_id, 2, v_fixed_assets_account, 'Write off asset cost: ' || v_asset.asset_code, 0, v_asset.purchase_price);

  perform public.post_journal_entry(v_je_id);

  update public.admin_assets set disposal_journal_entry_id = v_je_id where id = p_asset_id;

  perform public.log_admin_event(p_company_id, 'ADMIN_ASSET', p_asset_id, 'DISPOSAL_POSTED', null, null, jsonb_build_object('journal_entry_id', v_je_id), null);

  return v_je_id;
end;
$$;

grant execute on function public.post_admin_asset_disposal_entry(uuid, uuid) to authenticated;
