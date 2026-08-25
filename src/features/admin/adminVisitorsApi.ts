import { supabase } from "@/lib/supabase/client";
import type { Visitor } from "@/types/database";

export async function listVisitors(companyId: string, date?: string): Promise<Visitor[]> {
  let query = supabase.from("visitors").select("*").eq("company_id", companyId).order("visit_date", { ascending: false });
  if (date) query = query.eq("visit_date", date);
  const { data, error } = await query;
  if (error) throw error;
  return data as Visitor[];
}

export async function createVisitor(input: {
  companyId: string; name: string; organization?: string | null; visitorType: string; email?: string | null; phone?: string | null;
  hostEmployeeId: string; purpose?: string | null; visitDate: string;
}): Promise<Visitor> {
  const { data, error } = await supabase
    .from("visitors")
    .insert({
      company_id: input.companyId, name: input.name, organization: input.organization ?? null, visitor_type: input.visitorType,
      email: input.email ?? null, phone: input.phone ?? null, host_employee_id: input.hostEmployeeId, purpose: input.purpose ?? null, visit_date: input.visitDate,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Visitor;
}

export async function checkInVisitor(id: string, badgeNumber?: string): Promise<void> {
  const { error } = await supabase.rpc("check_in_visitor", { p_visitor_id: id, p_badge_number: badgeNumber ?? null });
  if (error) throw error;
}

export async function checkOutVisitor(id: string, badgeStatus: "RETURNED" | "LOST" = "RETURNED"): Promise<void> {
  const { error } = await supabase.rpc("check_out_visitor", { p_visitor_id: id, p_badge_status: badgeStatus });
  if (error) throw error;
}

export async function cancelVisitor(id: string): Promise<void> {
  const { error } = await supabase.from("visitors").update({ status: "CANCELLED" }).eq("id", id);
  if (error) throw error;
}
