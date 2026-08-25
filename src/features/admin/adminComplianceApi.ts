import { supabase } from "@/lib/supabase/client";
import type { AdminCompliance } from "@/types/database";

export async function listAdminCompliance(companyId: string): Promise<AdminCompliance[]> {
  const { data, error } = await supabase.from("admin_compliance").select("*").eq("company_id", companyId).order("expiry_date");
  if (error) throw error;
  return data as AdminCompliance[];
}

export async function createAdminCompliance(input: {
  companyId: string; type: string; name: string; authority?: string | null; referenceNumber?: string | null;
  issueDate?: string | null; expiryDate?: string | null; responsiblePerson?: string | null; notes?: string | null;
}): Promise<AdminCompliance> {
  const { data, error } = await supabase
    .from("admin_compliance")
    .insert({
      company_id: input.companyId, type: input.type, name: input.name, authority: input.authority ?? null,
      reference_number: input.referenceNumber ?? null, issue_date: input.issueDate ?? null, expiry_date: input.expiryDate ?? null,
      responsible_person: input.responsiblePerson ?? null, notes: input.notes ?? null, status: input.expiryDate ? "ACTIVE" : "PENDING",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminCompliance;
}

export async function updateAdminCompliance(id: string, patch: Partial<{ name: string; authority: string; referenceNumber: string; issueDate: string; expiryDate: string; status: string; notes: string }>): Promise<void> {
  const { error } = await supabase
    .from("admin_compliance")
    .update({ name: patch.name, authority: patch.authority, reference_number: patch.referenceNumber, issue_date: patch.issueDate, expiry_date: patch.expiryDate, status: patch.status, notes: patch.notes })
    .eq("id", id);
  if (error) throw error;
}
