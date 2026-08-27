import { supabase } from "@/lib/supabase/client";
import type {
  Asset,
  AssetHistoryEntry,
  Disposal,
  HardwareAsset,
  Profile,
  Repair,
  SoftwareAsset,
  Supplier,
} from "@/types/database";

type MiniProfile = Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url">;

async function fetchProfilesMap(userIds: (string | null | undefined)[]): Promise<Map<string, MiniProfile>> {
  const unique = [...new Set(userIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", unique);
  if (error) throw error;
  return new Map((data as MiniProfile[]).map((p) => [p.id, p]));
}

export interface InventoryDashboardStats {
  totalAssets: number;
  hardware: number;
  software: number;
  subscriptions: number;
  credentials: number;
  activeAssets: number;
  unassignedAssets: number;
  underRepair: number;
  defective: number;
  endOfLife: number;
  expiredSoftware: number;
  upcomingRenewals: number;
  warrantyExpiring: number;
  ipConflicts: number;
}

export async function getInventoryDashboardStats(companyId: string): Promise<InventoryDashboardStats> {
  const [assetsRes, hwRes, credRes, ipRes] = await Promise.all([
    supabase.from("assets").select("id, asset_type, status").eq("company_id", companyId),
    supabase
      .from("v_hardware_assets")
      .select("id, status, lifecycle_stage")
      .eq("company_id", companyId),
    supabase.from("credentials").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("ip_addresses").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "CONFLICT"),
  ]);
  if (assetsRes.error) throw assetsRes.error;
  if (hwRes.error) throw hwRes.error;
  if (credRes.error) throw credRes.error;
  if (ipRes.error) throw ipRes.error;

  const assets = assetsRes.data ?? [];
  const hardware = hwRes.data ?? [];

  const { data: softwareRows, error: swError } = await supabase
    .from("v_software_assets")
    .select("id, status, software_type, renewal_date, days_until_renewal")
    .eq("company_id", companyId);
  if (swError) throw swError;

  const { data: warrantyRows, error: warrantyError } = await supabase
    .from("hardware_details")
    .select("asset_id, warranty_end")
    .eq("company_id", companyId)
    .not("warranty_end", "is", null);
  if (warrantyError) throw warrantyError;

  const now = Date.now();
  const warrantyExpiring = (warrantyRows ?? []).filter((w) => {
    if (!w.warranty_end) return false;
    const days = (new Date(w.warranty_end).getTime() - now) / 86400000;
    return days <= 30;
  }).length;

  return {
    totalAssets: assets.length,
    hardware: assets.filter((a) => a.asset_type === "HARDWARE").length,
    software: assets.filter((a) => a.asset_type === "SOFTWARE").length,
    subscriptions: (softwareRows ?? []).filter((s) => s.software_type === "SUBSCRIPTION").length,
    credentials: credRes.count ?? 0,
    activeAssets: assets.filter((a) => a.status === "ACTIVE").length,
    unassignedAssets: assets.filter((a) => a.status === "UNASSIGNED").length,
    underRepair: assets.filter((a) => a.status === "REPAIR").length,
    defective: assets.filter((a) => a.status === "DEFECTIVE").length,
    endOfLife: hardware.filter((h) => h.lifecycle_stage === "END_OF_LIFE").length,
    expiredSoftware: (softwareRows ?? []).filter((s) => s.status === "EXPIRED").length,
    upcomingRenewals: (softwareRows ?? []).filter(
      (s) => s.software_type === "SUBSCRIPTION" && s.days_until_renewal !== null && s.days_until_renewal <= 90 && s.days_until_renewal >= 0,
    ).length,
    warrantyExpiring,
    ipConflicts: ipRes.count ?? 0,
  };
}

export interface AssetFilters {
  search?: string;
  assetType?: "HARDWARE" | "SOFTWARE";
  status?: string;
  condition?: string;
  category?: string;
  departmentId?: string;
  assignedTo?: string;
  softwareType?: "SUBSCRIPTION" | "ONE_TIME_PURCHASE";
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface EnrichedAsset extends Asset {
  assignee: MiniProfile | null;
  departmentName: string | null;
  supplierName: string | null;
  hardware?: HardwareAsset;
  software?: SoftwareAsset;
}

async function fetchDepartmentsMap(companyId: string) {
  const { data, error } = await supabase.from("departments").select("id, name").eq("company_id", companyId);
  if (error) throw error;
  return new Map((data ?? []).map((d) => [d.id, d.name as string]));
}

async function fetchSuppliersMap(companyId: string) {
  const { data, error } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId);
  if (error) throw error;
  return new Map((data ?? []).map((s) => [s.id, s.name as string]));
}

export async function listAssets(companyId: string, filters: AssetFilters = {}): Promise<EnrichedAsset[]> {
  let query = supabase.from("assets").select("*").eq("company_id", companyId);

  if (filters.assetType) query = query.eq("asset_type", filters.assetType);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.search) {
    const s = filters.search.replace(/[%,]/g, "");
    query = query.or(
      `asset_code.ilike.%${s}%,serial_number.ilike.%${s}%,asset_tag.ilike.%${s}%,name.ilike.%${s}%`,
    );
  }

  const sortBy = filters.sortBy ?? "created_at";
  query = query.order(sortBy, { ascending: filters.sortDir === "asc" });

  const { data, error } = await query;
  if (error) throw error;

  let assets = data as Asset[];

  if (filters.softwareType) {
    const { data: swRows, error: swError } = await supabase
      .from("software_details")
      .select("asset_id")
      .eq("company_id", companyId)
      .eq("software_type", filters.softwareType);
    if (swError) throw swError;
    const allowed = new Set((swRows ?? []).map((r) => r.asset_id));
    assets = assets.filter((a) => allowed.has(a.id));
  }

  const [profiles, departments, suppliers] = await Promise.all([
    fetchProfilesMap(assets.map((a) => a.assigned_to)),
    fetchDepartmentsMap(companyId),
    fetchSuppliersMap(companyId),
  ]);

  return assets.map((a) => ({
    ...a,
    assignee: a.assigned_to ? (profiles.get(a.assigned_to) ?? null) : null,
    departmentName: a.department_id ? (departments.get(a.department_id) ?? null) : null,
    supplierName: a.supplier_id ? (suppliers.get(a.supplier_id) ?? null) : null,
  }));
}

export interface AssetDetail extends EnrichedAsset {
  history: AssetHistoryEntry[];
  repairs: Repair[];
  disposals: Disposal[];
  relatedTickets: { id: string; ticket_number: string; subject: string; status: string }[];
}

export async function getAssetByCode(companyId: string, assetCode: string): Promise<AssetDetail | null> {
  const { data: asset, error } = await supabase
    .from("assets")
    .select("*")
    .eq("company_id", companyId)
    .eq("asset_code", assetCode)
    .maybeSingle();
  if (error) throw error;
  if (!asset) return null;

  const [hwRes, swRes, historyRes, repairsRes, disposalsRes, ticketsRes, departments, suppliers] = await Promise.all([
    asset.asset_type === "HARDWARE"
      ? supabase.from("v_hardware_assets").select("*").eq("id", asset.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    asset.asset_type === "SOFTWARE"
      ? supabase.from("v_software_assets").select("*").eq("id", asset.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("asset_history").select("*").eq("asset_id", asset.id).order("created_at", { ascending: false }),
    supabase.from("repairs").select("*").eq("asset_id", asset.id).order("created_at", { ascending: false }),
    supabase.from("disposals").select("*").eq("asset_id", asset.id).order("created_at", { ascending: false }),
    supabase.from("tickets").select("id, ticket_number, subject, status").eq("asset_id", asset.id).order("created_at", { ascending: false }),
    fetchDepartmentsMap(companyId),
    fetchSuppliersMap(companyId),
  ]);

  if (historyRes.error) throw historyRes.error;
  if (repairsRes.error) throw repairsRes.error;
  if (disposalsRes.error) throw disposalsRes.error;
  if (ticketsRes.error) throw ticketsRes.error;

  const profiles = await fetchProfilesMap([
    asset.assigned_to,
    ...(historyRes.data ?? []).map((h) => h.performed_by),
    ...(repairsRes.data ?? []).map((r) => r.reported_by),
  ]);

  return {
    ...(asset as Asset),
    assignee: asset.assigned_to ? (profiles.get(asset.assigned_to) ?? null) : null,
    departmentName: asset.department_id ? (departments.get(asset.department_id) ?? null) : null,
    supplierName: asset.supplier_id ? (suppliers.get(asset.supplier_id) ?? null) : null,
    hardware: (hwRes.data as HardwareAsset | null) ?? undefined,
    software: (swRes.data as SoftwareAsset | null) ?? undefined,
    history: historyRes.data as AssetHistoryEntry[],
    repairs: repairsRes.data as Repair[],
    disposals: disposalsRes.data as Disposal[],
    relatedTickets: ticketsRes.data ?? [],
  };
}

export interface CreateAssetInput {
  companyId: string;
  assetType: "HARDWARE" | "SOFTWARE";
  name: string;
  category?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  currency?: string;
  supplierId?: string | null;
  invoiceNumber?: string | null;
  purchaseOrder?: string | null;
  assignedTo?: string | null;
  departmentId?: string | null;
  location?: string | null;
  notes?: string | null;
  condition?: string | null;
  // hardware
  brand?: string | null;
  model?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  warrantyProvider?: string | null;
  lifecycleYears?: number;
  // software
  softwareType?: "SUBSCRIPTION" | "ONE_TIME_PURCHASE";
  vendor?: string | null;
  version?: string | null;
  licenseType?: string | null;
  licenseKey?: string | null;
  numberOfLicenses?: number | null;
  subscriptionStart?: string | null;
  subscriptionEnd?: string | null;
  renewalDate?: string | null;
  billingCycle?: string;
  subscriptionCost?: number | null;
  seatsTotal?: number;
  seatsUsed?: number;
  autoRenewal?: boolean;
  accountOwner?: string | null;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      company_id: input.companyId,
      asset_type: input.assetType,
      name: input.name,
      category: input.category ?? null,
      serial_number: input.serialNumber ?? null,
      asset_tag: input.assetTag ?? null,
      purchase_date: input.purchaseDate ?? null,
      purchase_price: input.purchasePrice ?? null,
      currency: input.currency ?? "USD",
      supplier_id: input.supplierId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      purchase_order: input.purchaseOrder ?? null,
      assigned_to: input.assignedTo ?? null,
      department_id: input.departmentId ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      condition: input.condition ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.assetType === "HARDWARE") {
    const { error: hwError } = await supabase.from("hardware_details").insert({
      asset_id: asset.id,
      brand: input.brand ?? null,
      model: input.model ?? null,
      hostname: input.hostname ?? null,
      ip_address: input.ipAddress ?? null,
      mac_address: input.macAddress ?? null,
      warranty_start: input.warrantyStart ?? null,
      warranty_end: input.warrantyEnd ?? null,
      warranty_provider: input.warrantyProvider ?? null,
      lifecycle_years: input.lifecycleYears ?? 5,
    });
    if (hwError) throw hwError;
  } else {
    const { error: swError } = await supabase.from("software_details").insert({
      asset_id: asset.id,
      software_type: input.softwareType ?? "ONE_TIME_PURCHASE",
      vendor: input.vendor ?? null,
      version: input.version ?? null,
      license_type: input.licenseType ?? null,
      license_key: input.licenseKey ?? null,
      number_of_licenses: input.numberOfLicenses ?? null,
    });
    if (swError) throw swError;

    if (input.softwareType === "SUBSCRIPTION") {
      const { error: subError } = await supabase.from("software_subscriptions").insert({
        asset_id: asset.id,
        subscription_start: input.subscriptionStart ?? null,
        subscription_end: input.subscriptionEnd ?? null,
        renewal_date: input.renewalDate ?? null,
        billing_cycle: input.billingCycle ?? "ANNUAL",
        cost: input.subscriptionCost ?? null,
        currency: input.currency ?? "USD",
        seats_total: input.seatsTotal ?? 1,
        seats_used: input.seatsUsed ?? 0,
        auto_renewal: input.autoRenewal ?? false,
        account_owner: input.accountOwner ?? null,
      });
      if (subError) throw subError;
    }
  }

  return asset as Asset;
}

export async function updateAsset(assetId: string, patch: Partial<CreateAssetInput>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.category !== undefined) fields.category = patch.category;
  if (patch.serialNumber !== undefined) fields.serial_number = patch.serialNumber;
  if (patch.assetTag !== undefined) fields.asset_tag = patch.assetTag;
  if (patch.purchaseDate !== undefined) fields.purchase_date = patch.purchaseDate;
  if (patch.purchasePrice !== undefined) fields.purchase_price = patch.purchasePrice;
  if (patch.currency !== undefined) fields.currency = patch.currency;
  if (patch.supplierId !== undefined) fields.supplier_id = patch.supplierId;
  if (patch.invoiceNumber !== undefined) fields.invoice_number = patch.invoiceNumber;
  if (patch.purchaseOrder !== undefined) fields.purchase_order = patch.purchaseOrder;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.condition !== undefined) fields.condition = patch.condition;

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from("assets").update(fields).eq("id", assetId);
    if (error) throw error;
  }

  const hwFields: Record<string, unknown> = {};
  if (patch.brand !== undefined) hwFields.brand = patch.brand;
  if (patch.model !== undefined) hwFields.model = patch.model;
  if (patch.hostname !== undefined) hwFields.hostname = patch.hostname;
  if (patch.ipAddress !== undefined) hwFields.ip_address = patch.ipAddress;
  if (patch.macAddress !== undefined) hwFields.mac_address = patch.macAddress;
  if (patch.warrantyStart !== undefined) hwFields.warranty_start = patch.warrantyStart;
  if (patch.warrantyEnd !== undefined) hwFields.warranty_end = patch.warrantyEnd;
  if (patch.warrantyProvider !== undefined) hwFields.warranty_provider = patch.warrantyProvider;
  if (patch.lifecycleYears !== undefined) hwFields.lifecycle_years = patch.lifecycleYears;
  if (Object.keys(hwFields).length > 0) {
    const { error } = await supabase.from("hardware_details").update(hwFields).eq("asset_id", assetId);
    if (error) throw error;
  }

  const swFields: Record<string, unknown> = {};
  if (patch.vendor !== undefined) swFields.vendor = patch.vendor;
  if (patch.version !== undefined) swFields.version = patch.version;
  if (patch.licenseType !== undefined) swFields.license_type = patch.licenseType;
  if (patch.licenseKey !== undefined) swFields.license_key = patch.licenseKey;
  if (patch.numberOfLicenses !== undefined) swFields.number_of_licenses = patch.numberOfLicenses;
  if (Object.keys(swFields).length > 0) {
    const { error } = await supabase.from("software_details").update(swFields).eq("asset_id", assetId);
    if (error) throw error;
  }

  const subFields: Record<string, unknown> = {};
  if (patch.subscriptionStart !== undefined) subFields.subscription_start = patch.subscriptionStart;
  if (patch.subscriptionEnd !== undefined) subFields.subscription_end = patch.subscriptionEnd;
  if (patch.renewalDate !== undefined) subFields.renewal_date = patch.renewalDate;
  if (patch.billingCycle !== undefined) subFields.billing_cycle = patch.billingCycle;
  if (patch.subscriptionCost !== undefined) subFields.cost = patch.subscriptionCost;
  if (patch.seatsTotal !== undefined) subFields.seats_total = patch.seatsTotal;
  if (patch.seatsUsed !== undefined) subFields.seats_used = patch.seatsUsed;
  if (patch.autoRenewal !== undefined) subFields.auto_renewal = patch.autoRenewal;
  if (patch.accountOwner !== undefined) subFields.account_owner = patch.accountOwner;
  if (Object.keys(subFields).length > 0) {
    const { error } = await supabase.from("software_subscriptions").update(subFields).eq("asset_id", assetId);
    if (error) throw error;
  }
}

export async function reassignAsset(input: {
  assetId: string;
  assignedTo: string | null;
  departmentId: string | null;
  location: string | null;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("reassign_asset", {
    p_asset_id: input.assetId,
    p_assigned_to: input.assignedTo,
    p_department_id: input.departmentId,
    p_location: input.location,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function updateAssetStatus(assetId: string, status: string): Promise<void> {
  const { error } = await supabase.from("assets").update({ status }).eq("id", assetId);
  if (error) throw error;
}

export async function markAssetDefective(input: {
  assetId: string;
  reason: string;
  description: string;
  recommendedAction: string;
}): Promise<void> {
  const { error } = await supabase.rpc("mark_asset_defective", {
    p_asset_id: input.assetId,
    p_reason: input.reason,
    p_description: input.description,
    p_recommended_action: input.recommendedAction,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------
export async function createRepair(input: {
  companyId: string;
  assetId: string;
  problemDescription: string;
  repairVendor?: string | null;
  repairStartDate?: string | null;
  expectedCompletionDate?: string | null;
}): Promise<Repair> {
  const { data, error } = await supabase
    .from("repairs")
    .insert({
      asset_id: input.assetId,
      problem_description: input.problemDescription,
      repair_vendor: input.repairVendor ?? null,
      repair_start_date: input.repairStartDate ?? null,
      expected_completion_date: input.expectedCompletionDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Repair;
}

export async function updateRepair(
  repairId: string,
  patch: Partial<{
    repairStatus: string;
    repairVendor: string | null;
    repairCost: number | null;
    actualCompletionDate: string | null;
    notes: string | null;
  }>,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.repairStatus !== undefined) fields.repair_status = patch.repairStatus;
  if (patch.repairVendor !== undefined) fields.repair_vendor = patch.repairVendor;
  if (patch.repairCost !== undefined) fields.repair_cost = patch.repairCost;
  if (patch.actualCompletionDate !== undefined) fields.actual_completion_date = patch.actualCompletionDate;
  if (patch.notes !== undefined) fields.notes = patch.notes;

  const { error } = await supabase.from("repairs").update(fields).eq("id", repairId);
  if (error) throw error;
}

export async function listRepairs(companyId: string): Promise<(Repair & { asset: Pick<Asset, "asset_code" | "name"> | null })[]> {
  const { data, error } = await supabase
    .from("repairs")
    .select("*, asset:assets(asset_code, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Repair & { asset: Pick<Asset, "asset_code" | "name"> | null })[];
}

// ---------------------------------------------------------------------
// Disposals
// ---------------------------------------------------------------------
export async function createDisposal(input: {
  assetId: string;
  disposalReason: string;
  disposalMethod: string;
  approvedBy?: string | null;
  finalValue?: number | null;
  notes?: string | null;
}): Promise<Disposal> {
  const { data, error } = await supabase
    .from("disposals")
    .insert({
      asset_id: input.assetId,
      disposal_reason: input.disposalReason,
      disposal_method: input.disposalMethod,
      approved_by: input.approvedBy ?? null,
      final_value: input.finalValue ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Disposal;
}

export async function listDisposals(companyId: string): Promise<(Disposal & { asset: Pick<Asset, "asset_code" | "name"> | null })[]> {
  const { data, error } = await supabase
    .from("disposals")
    .select("*, asset:assets(asset_code, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Disposal & { asset: Pick<Asset, "asset_code" | "name"> | null })[];
}

// Posts the double-entry write-off for a disposal (debit Loss/Gain on
// Disposal + Cash if there were proceeds, credit Fixed Assets for the
// original cost) -- a separate, Finance-permission-gated step from the
// disposal action itself, never bundled into it.
export async function postDisposalAccountingEntry(companyId: string, disposalId: string): Promise<string> {
  const { data, error } = await supabase.rpc("post_it_asset_disposal_entry", { p_company_id: companyId, p_disposal_id: disposalId });
  if (error) throw error;
  return data as string;
}

// ---------------------------------------------------------------------
// Asset history (company-wide feed)
// ---------------------------------------------------------------------
export async function listAssetHistory(companyId: string, limit = 100): Promise<(AssetHistoryEntry & { asset: Pick<Asset, "asset_code" | "name"> | null })[]> {
  const { data, error } = await supabase
    .from("asset_history")
    .select("*, asset:assets(asset_code, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as (AssetHistoryEntry & { asset: Pick<Asset, "asset_code" | "name"> | null })[];
}

// ---------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------
export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(input: { companyId: string; name: string; contactPerson?: string | null; email?: string | null; phone?: string | null }): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      company_id: input.companyId,
      name: input.name,
      contact_person: input.contactPerson ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function generateNotifications(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc("generate_inventory_notifications", { p_company_id: companyId });
  if (error) throw error;
  return data as number;
}
