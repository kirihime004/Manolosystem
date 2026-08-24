import { supabase } from "@/lib/supabase/client";
import type { SupplierBill, SupplierBillItem, SupplierBillApproval, SupplierPayment, AgingRow } from "@/types/database";

export interface SupplierBillFilters {
  status?: string;
  supplierId?: string;
}

export async function listSupplierBills(companyId: string, filters: SupplierBillFilters = {}): Promise<SupplierBill[]> {
  let query = supabase.from("supplier_bills").select("*").eq("company_id", companyId).order("bill_date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  const { data, error } = await query;
  if (error) throw error;
  return data as SupplierBill[];
}

export async function getSupplierBill(id: string): Promise<SupplierBill | null> {
  const { data, error } = await supabase.from("supplier_bills").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SupplierBill | null;
}

export async function getSupplierBillItems(billId: string): Promise<SupplierBillItem[]> {
  const { data, error } = await supabase.from("supplier_bill_items").select("*").eq("supplier_bill_id", billId).order("created_at");
  if (error) throw error;
  return data as SupplierBillItem[];
}

export async function listSupplierBillApprovals(billId: string): Promise<SupplierBillApproval[]> {
  const { data, error } = await supabase.from("supplier_bill_approvals").select("*").eq("supplier_bill_id", billId).order("sequence");
  if (error) throw error;
  return data as SupplierBillApproval[];
}

export async function listSupplierPayments(billId: string): Promise<SupplierPayment[]> {
  const { data, error } = await supabase.from("supplier_payments").select("*").eq("supplier_bill_id", billId).order("payment_date", { ascending: false });
  if (error) throw error;
  return data as SupplierPayment[];
}

export async function createSupplierBill(input: {
  companyId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  billDate: string;
  dueDate: string;
  currencyId: string;
  departmentId?: string | null;
  costCenterId?: string | null;
  budgetId?: string | null;
  budgetCategoryId?: string | null;
  notes?: string | null;
}): Promise<SupplierBill> {
  const { data, error } = await supabase
    .from("supplier_bills")
    .insert({
      company_id: input.companyId, supplier_id: input.supplierId, purchase_order_id: input.purchaseOrderId ?? null,
      bill_date: input.billDate, due_date: input.dueDate, currency_id: input.currencyId,
      department_id: input.departmentId ?? null, cost_center_id: input.costCenterId ?? null,
      budget_id: input.budgetId ?? null, budget_category_id: input.budgetCategoryId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupplierBill;
}

export async function updateSupplierBill(id: string, patch: Partial<{ dueDate: string; notes: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.dueDate !== undefined) fields.due_date = patch.dueDate;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { error } = await supabase.from("supplier_bills").update(fields).eq("id", id);
  if (error) throw error;
}

export async function addSupplierBillItem(input: {
  supplierBillId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax?: number;
  discount?: number;
  accountId?: string | null;
  purchaseOrderItemId?: string | null;
}): Promise<SupplierBillItem> {
  const { data, error } = await supabase
    .from("supplier_bill_items")
    .insert({
      supplier_bill_id: input.supplierBillId, description: input.description, quantity: input.quantity, unit_price: input.unitPrice,
      tax: input.tax ?? 0, discount: input.discount ?? 0, account_id: input.accountId ?? null, purchase_order_item_id: input.purchaseOrderItemId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupplierBillItem;
}

export async function deleteSupplierBillItem(id: string): Promise<void> {
  const { error } = await supabase.from("supplier_bill_items").delete().eq("id", id);
  if (error) throw error;
}

export async function submitSupplierBill(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_supplier_bill", { p_supplier_bill_id: id });
  if (error) throw error;
}

export async function decideSupplierBillApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_supplier_bill_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function voidSupplierBill(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("void_supplier_bill", { p_supplier_bill_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function recordSupplierPayment(input: {
  supplierBillId: string;
  cashAccountId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod?: string;
  reference?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_supplier_bill_id: input.supplierBillId, p_cash_account_id: input.cashAccountId, p_amount: input.amount,
    p_payment_date: input.paymentDate ?? new Date().toISOString().slice(0, 10),
    p_payment_method: input.paymentMethod ?? "BANK_TRANSFER", p_reference: input.reference ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function getApAging(companyId: string): Promise<AgingRow[]> {
  const { data, error } = await supabase.rpc("get_ap_aging", { p_company_id: companyId });
  if (error) throw error;
  return data as AgingRow[];
}
