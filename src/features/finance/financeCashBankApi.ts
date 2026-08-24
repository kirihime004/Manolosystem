import { supabase } from "@/lib/supabase/client";
import type { CashAccount, BankTransaction, BankReconciliation } from "@/types/database";

export async function listCashAccounts(companyId: string): Promise<CashAccount[]> {
  const { data, error } = await supabase.from("cash_accounts").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as CashAccount[];
}

export async function createCashAccount(input: {
  companyId: string;
  name: string;
  accountType: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  currencyId: string;
  glAccountId: string;
  openingBalance?: number;
}): Promise<CashAccount> {
  const { data, error } = await supabase
    .from("cash_accounts")
    .insert({
      company_id: input.companyId, name: input.name, account_type: input.accountType, bank_name: input.bankName ?? null,
      account_number_masked: input.accountNumberMasked ?? null, currency_id: input.currencyId, gl_account_id: input.glAccountId,
      opening_balance: input.openingBalance ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CashAccount;
}

export async function updateCashAccount(id: string, patch: Partial<{ name: string; bankName: string | null; status: string }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.bankName !== undefined) fields.bank_name = patch.bankName;
  if (patch.status !== undefined) fields.status = patch.status;
  const { error } = await supabase.from("cash_accounts").update(fields).eq("id", id);
  if (error) throw error;
}

export interface BankTransactionFilters {
  reconciled?: boolean;
}

export async function listBankTransactions(cashAccountId: string, filters: BankTransactionFilters = {}): Promise<BankTransaction[]> {
  let query = supabase.from("bank_transactions").select("*").eq("cash_account_id", cashAccountId).order("transaction_date", { ascending: false });
  if (filters.reconciled !== undefined) query = query.eq("reconciled", filters.reconciled);
  const { data, error } = await query;
  if (error) throw error;
  return data as BankTransaction[];
}

export async function recordBankTransaction(input: {
  companyId: string;
  cashAccountId: string;
  transactionDate: string;
  transactionType: string;
  direction: "IN" | "OUT";
  amount: number;
  currencyId: string;
  reference?: string | null;
  description?: string | null;
}): Promise<BankTransaction> {
  const { data, error } = await supabase
    .from("bank_transactions")
    .insert({
      company_id: input.companyId, cash_account_id: input.cashAccountId, transaction_date: input.transactionDate,
      transaction_type: input.transactionType, direction: input.direction, amount: input.amount, currency_id: input.currencyId,
      reference: input.reference ?? null, description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BankTransaction;
}

export async function listBankReconciliations(cashAccountId: string): Promise<BankReconciliation[]> {
  const { data, error } = await supabase.from("bank_reconciliations").select("*").eq("cash_account_id", cashAccountId).order("statement_date", { ascending: false });
  if (error) throw error;
  return data as BankReconciliation[];
}

export async function createBankReconciliation(input: {
  companyId: string;
  cashAccountId: string;
  statementDate: string;
  statementBalance: number;
  systemBalance: number;
}): Promise<BankReconciliation> {
  const { data, error } = await supabase
    .from("bank_reconciliations")
    .insert({
      company_id: input.companyId, cash_account_id: input.cashAccountId, statement_date: input.statementDate,
      statement_balance: input.statementBalance, system_balance: input.systemBalance,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BankReconciliation;
}

export async function markTransactionsReconciled(transactionIds: string[], reconciliationId: string): Promise<void> {
  const { error } = await supabase.from("bank_transactions").update({ reconciled: true, reconciliation_id: reconciliationId }).in("id", transactionIds);
  if (error) throw error;
}

export async function completeBankReconciliation(id: string): Promise<void> {
  const { error } = await supabase.from("bank_reconciliations").update({ status: "COMPLETED", reconciled_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
