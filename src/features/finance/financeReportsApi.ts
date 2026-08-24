import { supabase } from "@/lib/supabase/client";

export interface PnlRow {
  account_type: "REVENUE" | "COGS" | "EXPENSE";
  account_code: string;
  account_name: string;
  amount: number;
}

export async function getProfitAndLoss(companyId: string, startDate: string, endDate: string): Promise<PnlRow[]> {
  const { data, error } = await supabase.rpc("get_profit_and_loss", { p_company_id: companyId, p_start_date: startDate, p_end_date: endDate });
  if (error) throw error;
  return data as PnlRow[];
}

export interface BalanceSheetRow {
  account_type: "ASSET" | "LIABILITY" | "EQUITY";
  account_code: string;
  account_name: string;
  amount: number;
}

export async function getBalanceSheet(companyId: string, asOfDate: string): Promise<BalanceSheetRow[]> {
  const { data, error } = await supabase.rpc("get_balance_sheet", { p_company_id: companyId, p_as_of_date: asOfDate });
  if (error) throw error;
  return data as BalanceSheetRow[];
}

export interface CashFlowSummary {
  beginning_cash: number;
  cash_inflows: number;
  cash_outflows: number;
  net_cash_flow: number;
  ending_cash: number;
}

export async function getCashFlow(companyId: string, startDate: string, endDate: string): Promise<CashFlowSummary> {
  const { data, error } = await supabase.rpc("get_cash_flow", { p_company_id: companyId, p_start_date: startDate, p_end_date: endDate });
  if (error) throw error;
  const rows = data as CashFlowSummary[];
  return rows[0];
}

export async function generateFinanceNotifications(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc("generate_finance_notifications", { p_company_id: companyId });
  if (error) throw error;
  return data as number;
}
