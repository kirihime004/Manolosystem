import { supabase } from "@/lib/supabase/client";
import type { ProductionRateCard, ProductionUnit, ProductionWorkAdjustment, ProductionWorkApproval, ProductionWorkEarning } from "@/types/database";

// ---------------------------------------------------------------------
// Production Units (company-scoped, configurable — mirrors production_task_types)
// ---------------------------------------------------------------------
export async function listProductionUnits(companyId: string): Promise<ProductionUnit[]> {
  const { data, error } = await supabase.from("production_units").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as ProductionUnit[];
}

export async function createProductionUnit(input: { companyId: string; code: string; label: string; sortOrder?: number }): Promise<ProductionUnit> {
  const { data, error } = await supabase
    .from("production_units")
    .insert({ company_id: input.companyId, code: input.code.toUpperCase().replace(/[^A-Z0-9_]+/g, "_"), label: input.label, sort_order: input.sortOrder ?? 0, is_system: false })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionUnit;
}

export async function updateProductionUnit(id: string, patch: Partial<{ label: string; sortOrder: number; isActive: boolean }>): Promise<void> {
  const { error } = await supabase.from("production_units").update({ label: patch.label, sort_order: patch.sortOrder, is_active: patch.isActive }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Rate cards — never overwritten. Editing creates a new version; the old
// row's effective_to is closed out instead (see duplicateRateCard).
// ---------------------------------------------------------------------
export async function listRateCards(companyId: string): Promise<ProductionRateCard[]> {
  const { data, error } = await supabase.from("production_rate_cards").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionRateCard[];
}

export async function createRateCard(input: {
  companyId: string; name: string; description?: string | null;
  departmentId?: string | null; projectId?: string | null; taskTypeId: string; productionUnitId: string;
  positionId?: string | null; employeeId?: string | null; currencyId: string; rate: number;
  effectiveFrom: string; effectiveTo?: string | null;
}): Promise<ProductionRateCard> {
  const { data, error } = await supabase
    .from("production_rate_cards")
    .insert({
      company_id: input.companyId, name: input.name, description: input.description ?? null,
      department_id: input.departmentId ?? null, project_id: input.projectId ?? null,
      task_type_id: input.taskTypeId, production_unit_id: input.productionUnitId,
      position_id: input.positionId ?? null, employee_id: input.employeeId ?? null,
      currency_id: input.currencyId, rate: input.rate, calculation_method: "PER_UNIT",
      effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, status: "ACTIVE",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionRateCard;
}

export async function updateRateCardStatus(id: string, status: "DRAFT" | "ACTIVE" | "INACTIVE"): Promise<void> {
  const { error } = await supabase.from("production_rate_cards").update({ status }).eq("id", id);
  if (error) throw error;
}

// Duplicate-as-new-version: closes the old row's effective_to at the day
// before the new row's effective_from, then inserts the new row. Never
// mutates the rate/effective_from of the existing row -- rate history is
// preserved exactly as the spec requires.
export async function duplicateRateCardAsNewVersion(input: {
  sourceId: string; rate: number; effectiveFrom: string; effectiveTo?: string | null;
}): Promise<ProductionRateCard> {
  const { data: source, error: sourceError } = await supabase.from("production_rate_cards").select("*").eq("id", input.sourceId).single();
  if (sourceError) throw sourceError;
  const src = source as ProductionRateCard;

  const closeDate = new Date(input.effectiveFrom);
  closeDate.setDate(closeDate.getDate() - 1);
  const { error: closeError } = await supabase.from("production_rate_cards").update({ effective_to: closeDate.toISOString().slice(0, 10) }).eq("id", src.id);
  if (closeError) throw closeError;

  const { data, error } = await supabase
    .from("production_rate_cards")
    .insert({
      company_id: src.company_id, name: src.name, description: src.description,
      department_id: src.department_id, project_id: src.project_id, task_type_id: src.task_type_id, production_unit_id: src.production_unit_id,
      position_id: src.position_id, employee_id: src.employee_id, currency_id: src.currency_id,
      rate: input.rate, calculation_method: "PER_UNIT",
      effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, status: "ACTIVE",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionRateCard;
}

// Note: there is deliberately no direct "resolve a rate" RPC call exposed
// here. resolve_production_rate() has no permission check of its own --
// it's meant to run only inside recalculate_task_pricing() and
// submit_production_work(), both SECURITY DEFINER and both permission-
// gated (see migration 193). A preview needs one of those two real
// entry points, not a raw lookup an artist could point at another
// employee's rate.

// ---------------------------------------------------------------------
// Task pricing
// ---------------------------------------------------------------------
export async function setTaskPricingConfig(taskId: string, input: { productionUnitId: string | null }): Promise<void> {
  const { error } = await supabase.from("production_tasks").update({ production_unit_id: input.productionUnitId }).eq("id", taskId);
  if (error) throw error;
}

export async function recalculateTaskPricing(taskId: string, manualQuantity?: number | null, overrideReason?: string | null): Promise<void> {
  const { error } = await supabase.rpc("recalculate_task_pricing", {
    p_task_id: taskId, p_manual_quantity: manualQuantity ?? null, p_override_reason: overrideReason ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Approved Production Work — the payable-work snapshot
// ---------------------------------------------------------------------
export async function submitProductionWork(taskId: string, quantityOverride?: number | null, overrideReason?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("submit_production_work", {
    p_task_id: taskId, p_quantity_override: quantityOverride ?? null, p_override_reason: overrideReason ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listMyWorkEarnings(companyId: string, employeeId: string): Promise<ProductionWorkEarning[]> {
  const { data, error } = await supabase
    .from("production_work_earnings")
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionWorkEarning[];
}

export async function listAllWorkEarnings(companyId: string, status?: WorkEarningStatusFilter): Promise<ProductionWorkEarning[]> {
  let query = supabase.from("production_work_earnings").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (status) query = Array.isArray(status) ? query.in("status", status) : query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionWorkEarning[];
}

type WorkEarningStatusFilter = string | string[];

export async function getWorkEarning(id: string): Promise<ProductionWorkEarning> {
  const { data, error } = await supabase.from("production_work_earnings").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProductionWorkEarning;
}

// Every still-PENDING approval row, company-wide. approver_id is null
// until a decision is actually recorded (decide_production_work() sets it
// then) -- there's no pre-assigned approver to filter on. RLS already
// scopes what comes back (broadly to PRODUCTION.WORK.APPROVE holders, or
// narrowly to the submitter's own rows); the caller filters further to
// "permission I actually hold, and no earlier sequence still pending" to
// get the effective "decidable by me right now" queue -- mirrors exactly
// how decide_production_work() itself gates a decision server-side.
export async function listPendingWorkApprovals(companyId: string): Promise<(ProductionWorkApproval & { work_earning: ProductionWorkEarning | null })[]> {
  const { data, error } = await supabase
    .from("production_work_approvals")
    .select("*, work_earning:production_work_earnings(*)")
    .eq("company_id", companyId)
    .eq("decision", "PENDING")
    .order("sequence");
  if (error) throw error;
  return data as (ProductionWorkApproval & { work_earning: ProductionWorkEarning | null })[];
}

export async function listWorkApprovals(workEarningId: string): Promise<ProductionWorkApproval[]> {
  const { data, error } = await supabase.from("production_work_approvals").select("*").eq("work_earning_id", workEarningId).order("sequence");
  if (error) throw error;
  return data as ProductionWorkApproval[];
}

export async function decideProductionWork(input: {
  approvalId: string; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUIRED"; approvedQuantity?: number | null; comments?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("decide_production_work", {
    p_approval_id: input.approvalId, p_decision: input.decision,
    p_approved_quantity: input.approvedQuantity ?? null, p_comments: input.comments ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Finance / Payroll integration
// ---------------------------------------------------------------------
export async function sendProductionWorkToFinance(workEarningIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("send_production_work_to_finance", { p_work_earning_ids: workEarningIds });
  if (error) throw error;
}

export async function addProductionEarningsToPayrollItem(payrollItemId: string, workEarningIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("add_production_earnings_to_payroll_item", { p_payroll_item_id: payrollItemId, p_work_earning_ids: workEarningIds });
  if (error) throw error;
}

export async function createProductionWorkAdjustment(input: { workEarningId: string; adjustmentAmount: number; reason: string }): Promise<string> {
  const { data, error } = await supabase.rpc("create_production_work_adjustment", {
    p_work_earning_id: input.workEarningId, p_adjustment_amount: input.adjustmentAmount, p_reason: input.reason,
  });
  if (error) throw error;
  return data as string;
}

export async function listWorkAdjustments(workEarningId: string): Promise<ProductionWorkAdjustment[]> {
  const { data, error } = await supabase.from("production_work_adjustments").select("*").eq("work_earning_id", workEarningId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionWorkAdjustment[];
}
