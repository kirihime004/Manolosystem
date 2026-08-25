import { supabase } from "@/lib/supabase/client";
import type { AdminEvent, EventTask } from "@/types/database";

export async function listEvents(companyId: string): Promise<AdminEvent[]> {
  const { data, error } = await supabase.from("events").select("*").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as AdminEvent[];
}

export async function getEvent(id: string): Promise<AdminEvent> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdminEvent;
}

export async function createEvent(input: {
  companyId: string; name: string; eventType: string; locationId?: string | null; startDate: string; endDate: string;
  organizerId?: string | null; budgetId?: string | null; budgetCategoryId?: string | null; description?: string | null;
}): Promise<AdminEvent> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      company_id: input.companyId, name: input.name, event_type: input.eventType, location_id: input.locationId ?? null,
      start_date: input.startDate, end_date: input.endDate, organizer_id: input.organizerId ?? null,
      budget_id: input.budgetId ?? null, budget_category_id: input.budgetCategoryId ?? null, description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminEvent;
}

export async function updateEventStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listEventTasks(eventId: string): Promise<EventTask[]> {
  const { data, error } = await supabase.from("event_tasks").select("*").eq("event_id", eventId).order("due_date");
  if (error) throw error;
  return data as EventTask[];
}

export async function createEventTask(input: { companyId: string; eventId: string; category: string; title: string; description?: string | null; assignedTo?: string | null; dueDate?: string | null }): Promise<EventTask> {
  const { data, error } = await supabase
    .from("event_tasks")
    .insert({
      company_id: input.companyId, event_id: input.eventId, category: input.category, title: input.title,
      description: input.description ?? null, assigned_to: input.assignedTo ?? null, due_date: input.dueDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as EventTask;
}

export async function updateEventTaskStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("event_tasks").update({ status }).eq("id", id);
  if (error) throw error;
}
