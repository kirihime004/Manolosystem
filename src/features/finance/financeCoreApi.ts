import { supabase } from "@/lib/supabase/client";
import type {
  FiscalYear,
  FinancialPeriod,
  ChartOfAccount,
  CostCenter,
  ProfitCenter,
  JournalEntry,
  JournalEntryLine,
  JournalEntryApproval,
  GeneralLedgerRow,
  TrialBalanceRow,
} from "@/types/database";

// ---------------------------------------------------------------------
// Fiscal years & financial periods
// ---------------------------------------------------------------------
export async function listFiscalYears(companyId: string): Promise<FiscalYear[]> {
  const { data, error } = await supabase.from("fiscal_years").select("*").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as FiscalYear[];
}

export async function createFiscalYear(input: {
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}): Promise<FiscalYear> {
  const { data, error } = await supabase
    .from("fiscal_years")
    .insert({ company_id: input.companyId, name: input.name, start_date: input.startDate, end_date: input.endDate, is_current: input.isCurrent ?? false })
    .select("*")
    .single();
  if (error) throw error;
  return data as FiscalYear;
}

export async function listFinancialPeriods(companyId: string): Promise<FinancialPeriod[]> {
  const { data, error } = await supabase.from("financial_periods").select("*").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as FinancialPeriod[];
}

export async function generateFinancialPeriods(fiscalYearId: string, periodType: "MONTHLY" | "QUARTERLY" | "YEARLY"): Promise<FinancialPeriod[]> {
  const { data, error } = await supabase.rpc("generate_financial_periods", { p_fiscal_year_id: fiscalYearId, p_period_type: periodType });
  if (error) throw error;
  return data as FinancialPeriod[];
}

export async function getPeriodCloseChecklist(financialPeriodId: string): Promise<{ item: string; blocking_count: number }[]> {
  const { data, error } = await supabase.rpc("get_period_close_checklist", { p_financial_period_id: financialPeriodId });
  if (error) throw error;
  return data as { item: string; blocking_count: number }[];
}

export async function closeFinancialPeriod(financialPeriodId: string, force = false): Promise<void> {
  const { error } = await supabase.rpc("close_financial_period", { p_financial_period_id: financialPeriodId, p_force: force });
  if (error) throw error;
}

export async function reopenFinancialPeriod(financialPeriodId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("reopen_financial_period", { p_financial_period_id: financialPeriodId, p_reason: reason });
  if (error) throw error;
}

export async function lockFinancialPeriod(financialPeriodId: string): Promise<void> {
  const { error } = await supabase.rpc("lock_financial_period", { p_financial_period_id: financialPeriodId });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------
export async function listChartOfAccounts(companyId: string): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("company_id", companyId).order("code");
  if (error) throw error;
  return data as ChartOfAccount[];
}

export async function createAccount(input: {
  companyId: string;
  code: string;
  name: string;
  accountType: string;
  parentAccountId?: string | null;
  description?: string | null;
}): Promise<ChartOfAccount> {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      company_id: input.companyId, code: input.code, name: input.name, account_type: input.accountType,
      parent_account_id: input.parentAccountId ?? null, description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChartOfAccount;
}

export async function updateAccount(id: string, patch: Partial<{ name: string; description: string | null; status: string; parentAccountId: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.parentAccountId !== undefined) fields.parent_account_id = patch.parentAccountId;
  const { error } = await supabase.from("chart_of_accounts").update(fields).eq("id", id);
  if (error) throw error;
}

export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase.from("chart_of_accounts").update({ status: "ARCHIVED" }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Cost Centers / Profit Centers
// ---------------------------------------------------------------------
export async function listCostCenters(companyId: string): Promise<CostCenter[]> {
  const { data, error } = await supabase.from("cost_centers").select("*").eq("company_id", companyId).order("code");
  if (error) throw error;
  return data as CostCenter[];
}

export async function createCostCenter(input: { companyId: string; code: string; name: string; departmentId?: string | null }): Promise<CostCenter> {
  const { data, error } = await supabase
    .from("cost_centers")
    .insert({ company_id: input.companyId, code: input.code, name: input.name, department_id: input.departmentId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as CostCenter;
}

export async function updateCostCenter(id: string, patch: Partial<{ name: string; status: string; departmentId: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.departmentId !== undefined) fields.department_id = patch.departmentId;
  const { error } = await supabase.from("cost_centers").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteCostCenter(id: string): Promise<void> {
  const { error } = await supabase.from("cost_centers").delete().eq("id", id);
  if (error) throw error;
}

export async function listProfitCenters(companyId: string): Promise<ProfitCenter[]> {
  const { data, error } = await supabase.from("profit_centers").select("*").eq("company_id", companyId).order("code");
  if (error) throw error;
  return data as ProfitCenter[];
}

export async function createProfitCenter(input: { companyId: string; code: string; name: string; description?: string | null }): Promise<ProfitCenter> {
  const { data, error } = await supabase
    .from("profit_centers")
    .insert({ company_id: input.companyId, code: input.code, name: input.name, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProfitCenter;
}

export async function updateProfitCenter(id: string, patch: Partial<{ name: string; status: string; description: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.description !== undefined) fields.description = patch.description;
  const { error } = await supabase.from("profit_centers").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteProfitCenter(id: string): Promise<void> {
  const { error } = await supabase.from("profit_centers").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------
export interface JournalEntryFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listJournalEntries(companyId: string, filters: JournalEntryFilters = {}): Promise<JournalEntry[]> {
  let query = supabase.from("journal_entries").select("*").eq("company_id", companyId).order("date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data as JournalEntry[];
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase.from("journal_entries").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as JournalEntry | null;
}

export async function getJournalEntryLines(journalEntryId: string): Promise<JournalEntryLine[]> {
  const { data, error } = await supabase.from("journal_entry_lines").select("*").eq("journal_entry_id", journalEntryId).order("line_number");
  if (error) throw error;
  return data as JournalEntryLine[];
}

export async function createJournalEntry(input: {
  companyId: string;
  date: string;
  description: string;
  currencyId: string;
  baseCurrencyId: string;
}): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ company_id: input.companyId, date: input.date, description: input.description, currency_id: input.currencyId, base_currency_id: input.baseCurrencyId })
    .select("*")
    .single();
  if (error) throw error;
  return data as JournalEntry;
}

export async function addJournalEntryLine(input: {
  journalEntryId: string;
  lineNumber: number;
  accountId: string;
  description?: string | null;
  debit: number;
  credit: number;
  departmentId?: string | null;
  employeeId?: string | null;
  supplierId?: string | null;
  customerId?: string | null;
  costCenterId?: string | null;
  profitCenterId?: string | null;
}): Promise<JournalEntryLine> {
  const { data, error } = await supabase
    .from("journal_entry_lines")
    .insert({
      journal_entry_id: input.journalEntryId, line_number: input.lineNumber, account_id: input.accountId,
      description: input.description ?? null, debit: input.debit, credit: input.credit,
      department_id: input.departmentId ?? null, employee_id: input.employeeId ?? null,
      supplier_id: input.supplierId ?? null, customer_id: input.customerId ?? null,
      cost_center_id: input.costCenterId ?? null, profit_center_id: input.profitCenterId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JournalEntryLine;
}

export async function deleteJournalEntryLine(id: string): Promise<void> {
  const { error } = await supabase.from("journal_entry_lines").delete().eq("id", id);
  if (error) throw error;
}

export async function submitJournalEntryForApproval(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_journal_entry_for_approval", { p_journal_entry_id: id });
  if (error) throw error;
}

export async function postJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.rpc("post_journal_entry", { p_journal_entry_id: id });
  if (error) throw error;
}

export async function voidJournalEntry(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("void_journal_entry", { p_journal_entry_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function reverseJournalEntry(id: string, reason: string, reversalDate?: string): Promise<string> {
  const { data, error } = await supabase.rpc("reverse_journal_entry", { p_journal_entry_id: id, p_reason: reason, p_reversal_date: reversalDate ?? new Date().toISOString().slice(0, 10) });
  if (error) throw error;
  return data as string;
}

export async function listMyJournalApprovals(journalEntryId: string): Promise<JournalEntryApproval[]> {
  const { data, error } = await supabase.from("journal_entry_approvals").select("*").eq("journal_entry_id", journalEntryId).order("sequence");
  if (error) throw error;
  return data as JournalEntryApproval[];
}

export async function decideJournalEntryApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_journal_entry_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// General Ledger & Trial Balance
// ---------------------------------------------------------------------
export interface GeneralLedgerFilters {
  accountId?: string;
  departmentId?: string;
  employeeId?: string;
  supplierId?: string;
  customerId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listGeneralLedger(
  companyId: string,
  filters: GeneralLedgerFilters = {},
  page = 0,
  pageSize = 50,
): Promise<{ rows: GeneralLedgerRow[]; count: number }> {
  let query = supabase.from("v_general_ledger").select("*", { count: "exact" }).eq("company_id", companyId).order("date", { ascending: false });
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.costCenterId) query = query.eq("cost_center_id", filters.costCenterId);
  if (filters.profitCenterId) query = query.eq("profit_center_id", filters.profitCenterId);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return { rows: data as GeneralLedgerRow[], count: count ?? 0 };
}

export async function getTrialBalance(companyId: string, financialPeriodId: string): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.rpc("get_trial_balance", { p_company_id: companyId, p_financial_period_id: financialPeriodId });
  if (error) throw error;
  return data as TrialBalanceRow[];
}

export async function getAccountByCode(companyId: string, code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_account_by_code", { p_company_id: companyId, p_code: code });
  if (error) throw error;
  return data as string | null;
}
