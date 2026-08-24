import { supabase } from "@/lib/supabase/client";
import type { Customer, CustomerInvoice, CustomerInvoiceItem, CustomerPayment, AgingRow } from "@/types/database";

export async function listCustomers(companyId: string): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(input: {
  companyId: string;
  name: string;
  customerType?: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  currencyId?: string | null;
  paymentTerms?: string | null;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: input.companyId, name: input.name, customer_type: input.customerType ?? "CLIENT",
      contact_person: input.contactPerson ?? null, email: input.email ?? null, phone: input.phone ?? null,
      address: input.address ?? null, tax_number: input.taxNumber ?? null, currency_id: input.currencyId ?? null,
      payment_terms: input.paymentTerms ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, patch: Partial<{
  name: string; customerType: string; contactPerson: string | null; email: string | null; phone: string | null;
  address: string | null; taxNumber: string | null; paymentTerms: string | null; status: string;
}>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.customerType !== undefined) fields.customer_type = patch.customerType;
  if (patch.contactPerson !== undefined) fields.contact_person = patch.contactPerson;
  if (patch.email !== undefined) fields.email = patch.email;
  if (patch.phone !== undefined) fields.phone = patch.phone;
  if (patch.address !== undefined) fields.address = patch.address;
  if (patch.taxNumber !== undefined) fields.tax_number = patch.taxNumber;
  if (patch.paymentTerms !== undefined) fields.payment_terms = patch.paymentTerms;
  if (patch.status !== undefined) fields.status = patch.status;
  const { error } = await supabase.from("customers").update(fields).eq("id", id);
  if (error) throw error;
}

export interface CustomerInvoiceFilters {
  status?: string;
  customerId?: string;
}

export async function listCustomerInvoices(companyId: string, filters: CustomerInvoiceFilters = {}): Promise<CustomerInvoice[]> {
  let query = supabase.from("customer_invoices").select("*").eq("company_id", companyId).order("invoice_date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  const { data, error } = await query;
  if (error) throw error;
  return data as CustomerInvoice[];
}

export async function getCustomerInvoice(id: string): Promise<CustomerInvoice | null> {
  const { data, error } = await supabase.from("customer_invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CustomerInvoice | null;
}

export async function getCustomerInvoiceItems(invoiceId: string): Promise<CustomerInvoiceItem[]> {
  const { data, error } = await supabase.from("customer_invoice_items").select("*").eq("customer_invoice_id", invoiceId).order("created_at");
  if (error) throw error;
  return data as CustomerInvoiceItem[];
}

export async function listCustomerPayments(invoiceId: string): Promise<CustomerPayment[]> {
  const { data, error } = await supabase.from("customer_payments").select("*").eq("customer_invoice_id", invoiceId).order("payment_date", { ascending: false });
  if (error) throw error;
  return data as CustomerPayment[];
}

export async function createCustomerInvoice(input: {
  companyId: string;
  customerId: string;
  projectId?: string | null;
  invoiceDate: string;
  dueDate: string;
  currencyId: string;
  departmentId?: string | null;
  costCenterId?: string | null;
  profitCenterId?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
}): Promise<CustomerInvoice> {
  const { data, error } = await supabase
    .from("customer_invoices")
    .insert({
      company_id: input.companyId, customer_id: input.customerId, project_id: input.projectId ?? null,
      invoice_date: input.invoiceDate, due_date: input.dueDate, currency_id: input.currencyId,
      department_id: input.departmentId ?? null, cost_center_id: input.costCenterId ?? null,
      profit_center_id: input.profitCenterId ?? null, payment_terms: input.paymentTerms ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CustomerInvoice;
}

export async function addCustomerInvoiceItem(input: {
  customerInvoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax?: number;
  discount?: number;
  revenueAccountId?: string | null;
  projectId?: string | null;
}): Promise<CustomerInvoiceItem> {
  const { data, error } = await supabase
    .from("customer_invoice_items")
    .insert({
      customer_invoice_id: input.customerInvoiceId, description: input.description, quantity: input.quantity, unit_price: input.unitPrice,
      tax: input.tax ?? 0, discount: input.discount ?? 0, revenue_account_id: input.revenueAccountId ?? null, project_id: input.projectId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CustomerInvoiceItem;
}

export async function deleteCustomerInvoiceItem(id: string): Promise<void> {
  const { error } = await supabase.from("customer_invoice_items").delete().eq("id", id);
  if (error) throw error;
}

export async function sendCustomerInvoice(id: string): Promise<void> {
  const { error } = await supabase.rpc("send_customer_invoice", { p_customer_invoice_id: id });
  if (error) throw error;
}

export async function cancelCustomerInvoice(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_customer_invoice", { p_customer_invoice_id: id });
  if (error) throw error;
}

export async function voidCustomerInvoice(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("void_customer_invoice", { p_customer_invoice_id: id, p_reason: reason });
  if (error) throw error;
}

export async function recordCustomerPayment(input: {
  customerInvoiceId: string;
  cashAccountId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod?: string;
  reference?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_customer_payment", {
    p_customer_invoice_id: input.customerInvoiceId, p_cash_account_id: input.cashAccountId, p_amount: input.amount,
    p_payment_date: input.paymentDate ?? new Date().toISOString().slice(0, 10),
    p_payment_method: input.paymentMethod ?? "BANK_TRANSFER", p_reference: input.reference ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function getArAging(companyId: string): Promise<AgingRow[]> {
  const { data, error } = await supabase.rpc("get_ar_aging", { p_company_id: companyId });
  if (error) throw error;
  return data as AgingRow[];
}
