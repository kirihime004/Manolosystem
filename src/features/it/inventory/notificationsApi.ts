import { supabase } from "@/lib/supabase/client";
import type { InventoryNotification } from "@/types/database";

export async function listNotifications(companyId: string, limit = 30): Promise<InventoryNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as InventoryNotification[];
}

export async function getUnreadCount(companyId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(companyId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("company_id", companyId).eq("read", false);
  if (error) throw error;
}
