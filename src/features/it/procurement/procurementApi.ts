import { supabase } from "@/lib/supabase/client";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestApproval,
  Quotation,
  QuotationItem,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderApproval,
  Delivery,
  DeliveryItem,
  ProcurementHistoryEntry,
  Supplier,
  Profile,
} from "@/types/database";

type MiniProfile = Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url">;

async function fetchProfilesMap(userIds: (string | null | undefined)[]): Promise<Map<string, MiniProfile>> {
  const unique = [...new Set(userIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", unique);
  if (error) throw error;
  return new Map((data as MiniProfile[]).map((p) => [p.id, p]));
}

// ---------------------------------------------------------------------
// Purchase Requests
// ---------------------------------------------------------------------
export interface EnrichedPurchaseRequest extends PurchaseRequest {
  requester: MiniProfile | null;
}

export interface PurchaseRequestFilters {
  search?: string;
  status?: string;
  priority?: string;
  mineOnly?: boolean;
}

export async function listPurchaseRequests(companyId: string, filters: PurchaseRequestFilters = {}, userId?: string): Promise<EnrichedPurchaseRequest[]> {
  let query = supabase.from("purchase_requests").select("*").eq("company_id", companyId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.mineOnly && userId) query = query.eq("requester_id", userId);
  if (filters.search) {
    const s = filters.search.replace(/[%,]/g, "");
    query = query.or(`request_number.ilike.%${s}%,reason.ilike.%${s}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  const requests = data as PurchaseRequest[];
  const profiles = await fetchProfilesMap(requests.map((r) => r.requester_id));
  return requests.map((r) => ({ ...r, requester: profiles.get(r.requester_id) ?? null }));
}

export interface PurchaseRequestDetail extends EnrichedPurchaseRequest {
  items: PurchaseRequestItem[];
  approvals: (PurchaseRequestApproval & { approver: MiniProfile | null })[];
  quotations: (Quotation & { supplier: Pick<Supplier, "id" | "name"> | null })[];
}

export async function getPurchaseRequest(id: string): Promise<PurchaseRequestDetail | null> {
  const { data: pr, error } = await supabase.from("purchase_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!pr) return null;

  const [itemsRes, approvalsRes, quotationsRes] = await Promise.all([
    supabase.from("purchase_request_items").select("*").eq("purchase_request_id", id).order("created_at"),
    supabase.from("purchase_request_approvals").select("*").eq("purchase_request_id", id).order("sequence"),
    supabase.from("quotations").select("*, supplier:suppliers(id, name)").eq("purchase_request_id", id).order("created_at"),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (quotationsRes.error) throw quotationsRes.error;

  const profiles = await fetchProfilesMap([pr.requester_id, ...(approvalsRes.data ?? []).map((a) => a.approver_id)]);

  return {
    ...(pr as PurchaseRequest),
    requester: profiles.get(pr.requester_id) ?? null,
    items: itemsRes.data as PurchaseRequestItem[],
    approvals: (approvalsRes.data as PurchaseRequestApproval[]).map((a) => ({ ...a, approver: a.approver_id ? (profiles.get(a.approver_id) ?? null) : null })),
    quotations: quotationsRes.data as (Quotation & { supplier: Pick<Supplier, "id" | "name"> | null })[],
  };
}

export interface CreatePurchaseRequestInput {
  companyId: string;
  budgetId?: string | null;
  budgetCategoryId?: string | null;
  departmentId?: string | null;
  ticketId?: string | null;
  requiredDate?: string | null;
  priority?: string;
  reason?: string | null;
  description?: string | null;
  currencyId: string;
  items: { description: string; category?: string | null; assetType?: string | null; softwareType?: string | null; quantity: number; estimatedUnitPrice: number; preferredSupplierId?: string | null; notes?: string | null }[];
}

export async function createPurchaseRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequest> {
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.estimatedUnitPrice, 0);

  const { data: pr, error } = await supabase
    .from("purchase_requests")
    .insert({
      company_id: input.companyId,
      budget_id: input.budgetId ?? null,
      budget_category_id: input.budgetCategoryId ?? null,
      department_id: input.departmentId ?? null,
      ticket_id: input.ticketId ?? null,
      required_date: input.requiredDate ?? null,
      priority: input.priority ?? "MEDIUM",
      reason: input.reason ?? null,
      description: input.description ?? null,
      currency_id: input.currencyId,
      estimated_subtotal: subtotal,
      estimated_total: subtotal,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("purchase_request_items").insert(
      input.items.map((i) => ({
        purchase_request_id: pr.id,
        description: i.description,
        category: i.category ?? null,
        asset_type: i.assetType ?? null,
        software_type: i.softwareType ?? null,
        quantity: i.quantity,
        estimated_unit_price: i.estimatedUnitPrice,
        preferred_supplier_id: i.preferredSupplierId ?? null,
        notes: i.notes ?? null,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return pr as PurchaseRequest;
}

export async function submitPurchaseRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_purchase_request", { p_purchase_request_id: id });
  if (error) throw error;
}

export async function decidePurchaseRequestApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_purchase_request_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_comments: comments ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------
export async function createQuotation(input: {
  purchaseRequestId: string;
  supplierId: string;
  currencyId: string;
  items: { purchaseRequestItemId?: string | null; description: string; quantity: number; unitPrice: number }[];
  quotationNumber?: string | null;
  validUntil?: string | null;
  deliveryTimeDays?: number | null;
  warrantyTerms?: string | null;
  paymentTerms?: string | null;
  tax?: number;
  shipping?: number;
  discount?: number;
  notes?: string | null;
}): Promise<Quotation> {
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const tax = input.tax ?? 0;
  const shipping = input.shipping ?? 0;
  const discount = input.discount ?? 0;
  const total = subtotal + tax + shipping - discount;

  const { data: q, error } = await supabase
    .from("quotations")
    .insert({
      purchase_request_id: input.purchaseRequestId,
      supplier_id: input.supplierId,
      currency_id: input.currencyId,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      quotation_number: input.quotationNumber ?? null,
      valid_until: input.validUntil ?? null,
      delivery_time_days: input.deliveryTimeDays ?? null,
      warranty_terms: input.warrantyTerms ?? null,
      payment_terms: input.paymentTerms ?? null,
      status: "RECEIVED",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from("quotation_items").insert(
      input.items.map((i) => ({
        quotation_id: q.id,
        purchase_request_item_id: i.purchaseRequestItemId ?? null,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unitPrice,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return q as Quotation;
}

export async function listQuotations(companyId: string): Promise<(Quotation & { supplier: Pick<Supplier, "id" | "name"> | null; purchase_request: Pick<PurchaseRequest, "id" | "request_number"> | null })[]> {
  const { data, error } = await supabase
    .from("quotations")
    .select("*, supplier:suppliers(id, name), purchase_request:purchase_requests(id, request_number)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Quotation & { supplier: Pick<Supplier, "id" | "name"> | null; purchase_request: Pick<PurchaseRequest, "id" | "request_number"> | null })[];
}

export async function getQuotationItems(quotationId: string): Promise<QuotationItem[]> {
  const { data, error } = await supabase.from("quotation_items").select("*").eq("quotation_id", quotationId).order("created_at");
  if (error) throw error;
  return data as QuotationItem[];
}

export async function selectQuotation(quotationId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase.rpc("select_quotation", { p_quotation_id: quotationId, p_reason: reason ?? null });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------
export interface EnrichedPurchaseOrder extends PurchaseOrder {
  supplier: Pick<Supplier, "id" | "name"> | null;
}

export interface PurchaseOrderFilters {
  search?: string;
  status?: string;
  supplierId?: string;
}

export async function listPurchaseOrders(companyId: string, filters: PurchaseOrderFilters = {}): Promise<EnrichedPurchaseOrder[]> {
  let query = supabase.from("purchase_orders").select("*, supplier:suppliers(id, name)").eq("company_id", companyId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.search) {
    const s = filters.search.replace(/[%,]/g, "");
    query = query.ilike("po_number", `%${s}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as EnrichedPurchaseOrder[];
}

export interface PurchaseOrderDetail extends EnrichedPurchaseOrder {
  items: PurchaseOrderItem[];
  approvals: (PurchaseOrderApproval & { approver: MiniProfile | null })[];
  deliveries: Delivery[];
  purchaseRequest: Pick<PurchaseRequest, "id" | "request_number"> | null;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDetail | null> {
  const { data: po, error } = await supabase.from("purchase_orders").select("*, supplier:suppliers(id, name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!po) return null;

  const [itemsRes, approvalsRes, deliveriesRes, prRes] = await Promise.all([
    supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("created_at"),
    supabase.from("purchase_order_approvals").select("*").eq("purchase_order_id", id).order("sequence"),
    supabase.from("deliveries").select("*").eq("purchase_order_id", id).order("delivery_date", { ascending: false }),
    po.purchase_request_id
      ? supabase.from("purchase_requests").select("id, request_number").eq("id", po.purchase_request_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;

  const profiles = await fetchProfilesMap((approvalsRes.data ?? []).map((a) => a.approver_id));

  return {
    ...(po as EnrichedPurchaseOrder),
    items: itemsRes.data as PurchaseOrderItem[],
    approvals: (approvalsRes.data as PurchaseOrderApproval[]).map((a) => ({ ...a, approver: a.approver_id ? (profiles.get(a.approver_id) ?? null) : null })),
    deliveries: deliveriesRes.data as Delivery[],
    purchaseRequest: (prRes.data as Pick<PurchaseRequest, "id" | "request_number"> | null) ?? null,
  };
}

export async function createPurchaseOrderFromPR(input: {
  purchaseRequestId: string;
  paymentTerms?: string | null;
  shippingTerms?: string | null;
  expectedDeliveryDate?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_purchase_order_from_pr", {
    p_purchase_request_id: input.purchaseRequestId,
    p_payment_terms: input.paymentTerms ?? null,
    p_shipping_terms: input.shippingTerms ?? null,
    p_expected_delivery_date: input.expectedDeliveryDate ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function decidePurchaseOrderApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_purchase_order_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_comments: comments ?? null,
  });
  if (error) throw error;
}

export async function updatePurchaseOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Deliveries / receiving
// ---------------------------------------------------------------------
export async function createDelivery(input: {
  purchaseOrderId: string;
  trackingNumber?: string | null;
  deliveryReference?: string | null;
  notes?: string | null;
  items: { purchaseOrderItemId: string; quantityReceived: number; notes?: string | null }[];
}): Promise<Delivery> {
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .insert({
      purchase_order_id: input.purchaseOrderId,
      tracking_number: input.trackingNumber ?? null,
      delivery_reference: input.deliveryReference ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  for (const item of input.items) {
    if (item.quantityReceived <= 0) continue;
    const { error: itemError } = await supabase.from("delivery_items").insert({
      delivery_id: delivery.id,
      purchase_order_item_id: item.purchaseOrderItemId,
      quantity_received: item.quantityReceived,
      notes: item.notes ?? null,
    });
    if (itemError) throw itemError;
  }

  return delivery as Delivery;
}

export async function listDeliveries(companyId: string): Promise<(Delivery & { purchase_order: Pick<PurchaseOrder, "po_number" | "supplier_id"> | null })[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, purchase_order:purchase_orders(po_number, supplier_id)")
    .eq("company_id", companyId)
    .order("delivery_date", { ascending: false });
  if (error) throw error;
  return data as (Delivery & { purchase_order: Pick<PurchaseOrder, "po_number" | "supplier_id"> | null })[];
}

export async function getDeliveryItems(deliveryId: string): Promise<DeliveryItem[]> {
  const { data, error } = await supabase.from("delivery_items").select("*").eq("delivery_id", deliveryId);
  if (error) throw error;
  return data as DeliveryItem[];
}

// ---------------------------------------------------------------------
// Procurement history (company-wide feed)
// ---------------------------------------------------------------------
export async function listProcurementHistory(companyId: string, limit = 100): Promise<ProcurementHistoryEntry[]> {
  const { data, error } = await supabase
    .from("procurement_history")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ProcurementHistoryEntry[];
}

// ---------------------------------------------------------------------
// Suppliers (extends the Phase 2 supplier table with detail/performance)
// ---------------------------------------------------------------------
export interface SupplierPerformance {
  numberOfOrders: number;
  totalSpending: number;
  outstandingOrders: number;
  outstandingValue: number;
  cancelledOrders: number;
  averagePurchaseValue: number | null;
}

export async function getSupplierDetail(supplierId: string): Promise<{
  supplier: Supplier;
  purchaseRequests: Pick<PurchaseRequest, "id" | "request_number" | "status" | "created_at">[];
  purchaseOrders: EnrichedPurchaseOrder[];
  performance: SupplierPerformance;
} | null> {
  const { data: supplier, error } = await supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle();
  if (error) throw error;
  if (!supplier) return null;

  const [prItemsRes, poRes] = await Promise.all([
    supabase.from("purchase_request_items").select("purchase_request_id").eq("preferred_supplier_id", supplierId),
    supabase.from("purchase_orders").select("*, supplier:suppliers(id, name)").eq("supplier_id", supplierId).order("created_at", { ascending: false }),
  ]);
  if (prItemsRes.error) throw prItemsRes.error;
  if (poRes.error) throw poRes.error;

  const prIds = [...new Set((prItemsRes.data ?? []).map((r) => r.purchase_request_id))];
  let purchaseRequests: Pick<PurchaseRequest, "id" | "request_number" | "status" | "created_at">[] = [];
  if (prIds.length > 0) {
    const { data, error: prError } = await supabase
      .from("purchase_requests")
      .select("id, request_number, status, created_at")
      .in("id", prIds)
      .order("created_at", { ascending: false });
    if (prError) throw prError;
    purchaseRequests = data ?? [];
  }

  const purchaseOrders = poRes.data as EnrichedPurchaseOrder[];
  const nonCancelled = purchaseOrders.filter((po) => po.status !== "CANCELLED");
  const totalSpending = nonCancelled.reduce((sum, po) => sum + (po.base_currency_total ?? po.total), 0);
  const outstanding = purchaseOrders.filter((po) => ["SENT_TO_SUPPLIER", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "APPROVED", "PENDING_APPROVAL"].includes(po.status));

  const performance: SupplierPerformance = {
    numberOfOrders: purchaseOrders.length,
    totalSpending,
    outstandingOrders: outstanding.length,
    outstandingValue: outstanding.reduce((sum, po) => sum + (po.base_currency_total ?? po.total), 0),
    cancelledOrders: purchaseOrders.filter((po) => po.status === "CANCELLED").length,
    averagePurchaseValue: nonCancelled.length > 0 ? totalSpending / nonCancelled.length : null,
  };

  return { supplier: supplier as Supplier, purchaseRequests, purchaseOrders, performance };
}

export async function updateSupplier(
  id: string,
  patch: Partial<{
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    taxNumber: string | null;
    paymentTerms: string | null;
    currencyId: string | null;
    status: string;
    notes: string | null;
  }>,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.contactPerson !== undefined) fields.contact_person = patch.contactPerson;
  if (patch.email !== undefined) fields.email = patch.email;
  if (patch.phone !== undefined) fields.phone = patch.phone;
  if (patch.address !== undefined) fields.address = patch.address;
  if (patch.website !== undefined) fields.website = patch.website;
  if (patch.taxNumber !== undefined) fields.tax_number = patch.taxNumber;
  if (patch.paymentTerms !== undefined) fields.payment_terms = patch.paymentTerms;
  if (patch.currencyId !== undefined) fields.currency_id = patch.currencyId;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { error } = await supabase.from("suppliers").update(fields).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Procurement dashboard
// ---------------------------------------------------------------------
export interface ProcurementDashboardStats {
  pendingRequests: number;
  approvedRequests: number;
  pendingPOs: number;
  openPOs: number;
  partiallyReceived: number;
  overdueDeliveries: number;
  totalProcurementThisYear: number;
}

export async function getProcurementDashboardStats(companyId: string): Promise<ProcurementDashboardStats> {
  const currentYear = new Date().getFullYear();
  const [prRes, poRes] = await Promise.all([
    supabase.from("purchase_requests").select("id, status").eq("company_id", companyId),
    supabase.from("purchase_orders").select("id, status, expected_delivery_date, base_currency_total, total, created_at").eq("company_id", companyId),
  ]);
  if (prRes.error) throw prRes.error;
  if (poRes.error) throw poRes.error;

  const prs = prRes.data ?? [];
  const pos = poRes.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return {
    pendingRequests: prs.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length,
    approvedRequests: prs.filter((r) => r.status === "APPROVED").length,
    pendingPOs: pos.filter((p) => p.status === "PENDING_APPROVAL").length,
    openPOs: pos.filter((p) => ["APPROVED", "SENT_TO_SUPPLIER", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(p.status)).length,
    partiallyReceived: pos.filter((p) => p.status === "PARTIALLY_RECEIVED").length,
    overdueDeliveries: pos.filter((p) => p.expected_delivery_date && p.expected_delivery_date < today && !["RECEIVED", "CANCELLED", "CLOSED"].includes(p.status)).length,
    totalProcurementThisYear: pos
      .filter((p) => new Date(p.created_at).getFullYear() === currentYear && p.status !== "CANCELLED")
      .reduce((sum, p) => sum + (p.base_currency_total ?? p.total ?? 0), 0),
  };
}

export async function generateProcurementNotifications(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc("generate_procurement_notifications", { p_company_id: companyId });
  if (error) throw error;
  return data as number;
}
