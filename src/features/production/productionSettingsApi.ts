import { supabase } from "@/lib/supabase/client";
import type {
  ProductionCustomField, ProductionCustomFieldValue, ProductionWorkflowTemplate, ProductionWorkflowStage,
  ProductionClientUser,
} from "@/types/database";

// ---------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------
export async function listCustomFields(companyId: string, entityType?: string): Promise<ProductionCustomField[]> {
  let query = supabase.from("production_custom_fields").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order");
  if (entityType) query = query.eq("entity_type", entityType);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionCustomField[];
}

export async function createCustomField(input: {
  companyId: string; entityType: string; fieldKey: string; label: string; fieldType: string;
  options?: { value: string; label: string }[]; isRequired?: boolean; sortOrder?: number;
}): Promise<ProductionCustomField> {
  const { data, error } = await supabase
    .from("production_custom_fields")
    .insert({
      company_id: input.companyId, entity_type: input.entityType, field_key: input.fieldKey, label: input.label,
      field_type: input.fieldType, options: input.options ?? [], is_required: input.isRequired ?? false, sort_order: input.sortOrder ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionCustomField;
}

export async function deactivateCustomField(id: string): Promise<void> {
  const { error } = await supabase.from("production_custom_fields").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function listCustomFieldValues(entityType: string, entityId: string): Promise<ProductionCustomFieldValue[]> {
  const { data, error } = await supabase.from("production_custom_field_values").select("*").eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw error;
  return data as ProductionCustomFieldValue[];
}

export async function setCustomFieldValue(input: {
  companyId: string; customFieldId: string; entityType: string; entityId: string; updatedBy: string;
  valueText?: string | null; valueNumber?: number | null; valueBoolean?: boolean | null; valueDate?: string | null;
  valueTimestamp?: string | null; valueUuid?: string | null; valueJson?: unknown;
}): Promise<void> {
  const { error } = await supabase
    .from("production_custom_field_values")
    .upsert(
      {
        company_id: input.companyId, custom_field_id: input.customFieldId, entity_type: input.entityType, entity_id: input.entityId,
        updated_by: input.updatedBy, value_text: input.valueText ?? null, value_number: input.valueNumber ?? null,
        value_boolean: input.valueBoolean ?? null, value_date: input.valueDate ?? null, value_timestamp: input.valueTimestamp ?? null,
        value_uuid: input.valueUuid ?? null, value_json: input.valueJson ?? null,
      },
      { onConflict: "custom_field_id,entity_id" },
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Workflow templates
// ---------------------------------------------------------------------
export async function listWorkflowTemplates(companyId: string): Promise<ProductionWorkflowTemplate[]> {
  const { data, error } = await supabase.from("production_workflow_templates").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as ProductionWorkflowTemplate[];
}

export async function createWorkflowTemplate(input: { companyId: string; name: string; entityType: string }): Promise<ProductionWorkflowTemplate> {
  const { data, error } = await supabase
    .from("production_workflow_templates")
    .insert({ company_id: input.companyId, name: input.name, entity_type: input.entityType })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionWorkflowTemplate;
}

export async function listWorkflowStages(templateId: string): Promise<ProductionWorkflowStage[]> {
  const { data, error } = await supabase.from("production_workflow_stages").select("*").eq("workflow_template_id", templateId).order("sort_order");
  if (error) throw error;
  return data as ProductionWorkflowStage[];
}

export async function addWorkflowStage(input: { companyId: string; workflowTemplateId: string; name: string; sortOrder: number; mapsToStatus: string }): Promise<ProductionWorkflowStage> {
  const { data, error } = await supabase
    .from("production_workflow_stages")
    .insert({ company_id: input.companyId, workflow_template_id: input.workflowTemplateId, name: input.name, sort_order: input.sortOrder, maps_to_status: input.mapsToStatus })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionWorkflowStage;
}

export async function deleteWorkflowStage(id: string): Promise<void> {
  const { error } = await supabase.from("production_workflow_stages").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Client portal access
// ---------------------------------------------------------------------
export async function listClientUsers(companyId: string, customerId?: string): Promise<ProductionClientUser[]> {
  let query = supabase.from("production_client_users").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionClientUser[];
}

export async function setClientUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("production_client_users").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}
