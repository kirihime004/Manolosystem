import { supabase } from "@/lib/supabase/client";
import type { TravelRequest, AdminDocument } from "@/types/database";

export async function listTravelRequests(companyId: string): Promise<TravelRequest[]> {
  const { data, error } = await supabase.from("travel_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as TravelRequest[];
}

export async function getTravelRequest(id: string): Promise<TravelRequest> {
  const { data, error } = await supabase.from("travel_requests").select("*").eq("id", id).single();
  if (error) throw error;
  return data as TravelRequest;
}

export async function createTravelRequest(input: {
  companyId: string; employeeId: string; departmentId?: string | null; purpose: string; destination: string; travelType: string;
  departureDate: string; returnDate: string; estimatedCost?: number | null; currencyId?: string | null;
  visaRequired?: boolean; insuranceRequired?: boolean; perDiem?: number | null; notes?: string | null;
}): Promise<TravelRequest> {
  const { data, error } = await supabase
    .from("travel_requests")
    .insert({
      company_id: input.companyId, employee_id: input.employeeId, department_id: input.departmentId ?? null, purpose: input.purpose,
      destination: input.destination, travel_type: input.travelType, departure_date: input.departureDate, return_date: input.returnDate,
      estimated_cost: input.estimatedCost ?? null, currency_id: input.currencyId ?? null, visa_required: input.visaRequired ?? false,
      insurance_required: input.insuranceRequired ?? false, per_diem: input.perDiem ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TravelRequest;
}

export async function submitTravelRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_travel_request", { p_travel_request_id: id });
  if (error) throw error;
}

export async function advanceTravelRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("advance_travel_request", { p_travel_request_id: id });
  if (error) throw error;
}

export async function rejectTravelRequest(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("reject_travel_request", { p_travel_request_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function bookTravelRequest(id: string, input: { flightDetails?: string; hotelDetails?: string; transportationDetails?: string }): Promise<void> {
  const { error } = await supabase.rpc("book_travel_request", {
    p_travel_request_id: id, p_flight_details: input.flightDetails ?? null, p_hotel_details: input.hotelDetails ?? null, p_transportation_details: input.transportationDetails ?? null,
  });
  if (error) throw error;
}

export async function startTravel(id: string): Promise<void> {
  const { error } = await supabase.rpc("start_travel", { p_travel_request_id: id });
  if (error) throw error;
}

export async function completeTravel(id: string): Promise<void> {
  const { error } = await supabase.rpc("complete_travel", { p_travel_request_id: id });
  if (error) throw error;
}

export async function cancelTravelRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_travel_request", { p_travel_request_id: id });
  if (error) throw error;
}

export async function listTravelDocuments(travelRequestId: string): Promise<AdminDocument[]> {
  const { data, error } = await supabase.from("admin_documents").select("*").eq("resource_type", "TRAVEL_REQUEST").eq("resource_id", travelRequestId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as AdminDocument[];
}
