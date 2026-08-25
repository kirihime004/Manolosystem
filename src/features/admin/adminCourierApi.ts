import { supabase } from "@/lib/supabase/client";
import type { CourierMail } from "@/types/database";

export async function listCourierMail(companyId: string): Promise<CourierMail[]> {
  const { data, error } = await supabase.from("courier_mail").select("*").eq("company_id", companyId).order("log_date", { ascending: false });
  if (error) throw error;
  return data as CourierMail[];
}

export async function createCourierMail(input: {
  companyId: string; direction: string; trackingNumber?: string | null; sender?: string | null; recipient?: string | null;
  departmentId?: string | null; courierProvider?: string | null; logDate?: string; notes?: string | null;
}): Promise<CourierMail> {
  const { data, error } = await supabase
    .from("courier_mail")
    .insert({
      company_id: input.companyId, direction: input.direction, tracking_number: input.trackingNumber ?? null, sender: input.sender ?? null,
      recipient: input.recipient ?? null, department_id: input.departmentId ?? null, courier_provider: input.courierProvider ?? null,
      log_date: input.logDate ?? new Date().toISOString().slice(0, 10), notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CourierMail;
}

export async function updateCourierMailStatus(id: string, status: string): Promise<void> {
  const patch: { status: string; delivered_at?: string } = { status };
  if (status === "DELIVERED") patch.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("courier_mail").update(patch).eq("id", id);
  if (error) throw error;
}
