import { supabase } from "@/lib/supabase/client";
import type { Announcement } from "@/types/database";

export async function listAnnouncements(companyId: string): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("*").eq("company_id", companyId).order("publish_date", { ascending: false });
  if (error) throw error;
  return data as Announcement[];
}

export async function createAnnouncement(input: {
  companyId: string; title: string; content: string; audience: string; audienceDepartmentId?: string | null;
  audienceLocationId?: string | null; audienceRoleId?: string | null; priority: string; publishDate?: string; expiryDate?: string | null;
}): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      company_id: input.companyId, title: input.title, content: input.content, audience: input.audience,
      audience_department_id: input.audienceDepartmentId ?? null, audience_location_id: input.audienceLocationId ?? null,
      audience_role_id: input.audienceRoleId ?? null, priority: input.priority, publish_date: input.publishDate ?? new Date().toISOString().slice(0, 10),
      expiry_date: input.expiryDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Announcement;
}

export async function publishAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").update({ status: "PUBLISHED" }).eq("id", id);
  if (error) throw error;
}

export async function retractAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").update({ status: "RETRACTED" }).eq("id", id);
  if (error) throw error;
}
