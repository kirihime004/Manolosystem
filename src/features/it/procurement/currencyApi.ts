import { supabase } from "@/lib/supabase/client";
import type { Currency, CompanyCurrencySettings, ExchangeRate } from "@/types/database";

export async function listCurrencies(activeOnly = true): Promise<Currency[]> {
  let query = supabase.from("currencies").select("*");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.order("code");
  if (error) throw error;
  return data as Currency[];
}

export async function getCompanyCurrencySettings(companyId: string): Promise<CompanyCurrencySettings | null> {
  const { data, error } = await supabase
    .from("company_currency_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as CompanyCurrencySettings | null;
}

export async function updateCompanyBaseCurrency(companyId: string, currencyId: string): Promise<void> {
  const { error } = await supabase
    .from("company_currency_settings")
    .update({ base_currency_id: currencyId })
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function listExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase.from("exchange_rates").select("*").order("effective_date", { ascending: false });
  if (error) throw error;
  return data as ExchangeRate[];
}

export async function createExchangeRate(input: {
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
  effectiveDate: string;
  source?: string | null;
}): Promise<ExchangeRate> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .insert({
      from_currency_id: input.fromCurrencyId,
      to_currency_id: input.toCurrencyId,
      rate: input.rate,
      effective_date: input.effectiveDate,
      source: input.source ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ExchangeRate;
}

export async function setExchangeRateActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("exchange_rates").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function getExchangeRate(fromCurrencyId: string, toCurrencyId: string, onDate?: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_exchange_rate", {
    p_from_currency_id: fromCurrencyId,
    p_to_currency_id: toCurrencyId,
    p_on_date: onDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as number | null;
}

// ---------------------------------------------------------------------
// Formatting helpers -- currency symbols/decimals always come from the
// currencies table, never hard-coded per spec section 19.
// ---------------------------------------------------------------------
export function formatMoney(amount: number, currency: Pick<Currency, "symbol" | "decimal_places"> | null | undefined): string {
  if (!currency) return amount.toLocaleString();
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: currency.decimal_places,
    maximumFractionDigits: currency.decimal_places,
  });
  return `${currency.symbol}${formatted}`;
}
