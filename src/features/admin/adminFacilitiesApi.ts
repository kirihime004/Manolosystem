import { supabase } from "@/lib/supabase/client";
import type { AdminLocation, Building, Floor, Room, RoomBooking, Workspace, WorkspaceAssignment } from "@/types/database";

// ---------------------------------------------------------------------
// Locations / Buildings / Floors
// ---------------------------------------------------------------------
export async function listLocations(companyId: string): Promise<AdminLocation[]> {
  const { data, error } = await supabase.from("locations").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as AdminLocation[];
}

export async function createLocation(input: {
  companyId: string; name: string; code?: string | null; type: string; address?: string | null;
  city?: string | null; province?: string | null; country?: string | null; managerId?: string | null; notes?: string | null;
}): Promise<AdminLocation> {
  const { data, error } = await supabase
    .from("locations")
    .insert({
      company_id: input.companyId, name: input.name, code: input.code ?? null, type: input.type,
      address: input.address ?? null, city: input.city ?? null, province: input.province ?? null,
      country: input.country ?? null, manager_id: input.managerId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminLocation;
}

export async function getLocation(id: string): Promise<AdminLocation> {
  const { data, error } = await supabase.from("locations").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdminLocation;
}

export async function updateLocation(id: string, patch: Partial<{ name: string; type: string; address: string; city: string; province: string; country: string; status: string; managerId: string | null; notes: string }>): Promise<void> {
  const { error } = await supabase
    .from("locations")
    .update({
      name: patch.name, type: patch.type, address: patch.address, city: patch.city, province: patch.province,
      country: patch.country, status: patch.status, manager_id: patch.managerId, notes: patch.notes,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function listBuildings(locationId: string): Promise<Building[]> {
  const { data, error } = await supabase.from("buildings").select("*").eq("location_id", locationId).order("name");
  if (error) throw error;
  return data as Building[];
}

export async function createBuilding(input: { locationId: string; name: string; code?: string | null; address?: string | null; floors?: number | null }): Promise<Building> {
  const { data, error } = await supabase
    .from("buildings")
    .insert({ location_id: input.locationId, name: input.name, code: input.code ?? null, address: input.address ?? null, floors: input.floors ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Building;
}

export async function listFloors(buildingId: string): Promise<Floor[]> {
  const { data, error } = await supabase.from("floors").select("*").eq("building_id", buildingId).order("floor_number");
  if (error) throw error;
  return data as Floor[];
}

export async function createFloor(input: { buildingId: string; floorNumber: string; floorName?: string | null; description?: string | null }): Promise<Floor> {
  const { data, error } = await supabase
    .from("floors")
    .insert({ building_id: input.buildingId, floor_number: input.floorNumber, floor_name: input.floorName ?? null, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Floor;
}

// ---------------------------------------------------------------------
// Rooms & bookings
// ---------------------------------------------------------------------
export async function listRooms(companyId: string): Promise<Room[]> {
  const { data, error } = await supabase.from("rooms").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as Room[];
}

export async function createRoom(input: {
  companyId: string; name: string; type: string; capacity?: number | null; description?: string | null;
  locationId?: string | null; buildingId?: string | null; floorId?: string | null;
}): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      company_id: input.companyId, name: input.name, type: input.type, capacity: input.capacity ?? null,
      description: input.description ?? null, location_id: input.locationId ?? null, building_id: input.buildingId ?? null, floor_id: input.floorId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Room;
}

export async function updateRoom(id: string, patch: Partial<{ name: string; type: string; capacity: number | null; status: string; description: string }>): Promise<void> {
  const { error } = await supabase.from("rooms").update({ name: patch.name, type: patch.type, capacity: patch.capacity, status: patch.status, description: patch.description }).eq("id", id);
  if (error) throw error;
}

export async function listRoomBookings(companyId: string, roomId?: string): Promise<RoomBooking[]> {
  let query = supabase.from("room_bookings").select("*").eq("company_id", companyId).order("booking_date", { ascending: false });
  if (roomId) query = query.eq("room_id", roomId);
  const { data, error } = await query;
  if (error) throw error;
  return data as RoomBooking[];
}

export async function createRoomBooking(input: {
  companyId: string; roomId: string; requesterId: string; departmentId?: string | null;
  bookingDate: string; startTime: string; endTime: string; purpose?: string | null; attendees?: number | null;
}): Promise<RoomBooking> {
  const { data, error } = await supabase
    .from("room_bookings")
    .insert({
      company_id: input.companyId, room_id: input.roomId, requester_id: input.requesterId, department_id: input.departmentId ?? null,
      booking_date: input.bookingDate, start_time: input.startTime, end_time: input.endTime, purpose: input.purpose ?? null, attendees: input.attendees ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RoomBooking;
}

export async function updateRoomBookingStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("room_bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------
export async function listWorkspaces(companyId: string): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").eq("company_id", companyId).order("area");
  if (error) throw error;
  return data as Workspace[];
}

export async function createWorkspace(input: {
  companyId: string; area?: string | null; deskNumber?: string | null; notes?: string | null;
  locationId?: string | null; buildingId?: string | null; floorId?: string | null;
}): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      company_id: input.companyId, area: input.area ?? null, desk_number: input.deskNumber ?? null, notes: input.notes ?? null,
      location_id: input.locationId ?? null, building_id: input.buildingId ?? null, floor_id: input.floorId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function listWorkspaceAssignments(workspaceId: string): Promise<WorkspaceAssignment[]> {
  const { data, error } = await supabase.from("workspace_assignments").select("*").eq("workspace_id", workspaceId).order("assigned_date", { ascending: false });
  if (error) throw error;
  return data as WorkspaceAssignment[];
}

export async function assignWorkspace(workspaceId: string, employeeId: string, departmentId?: string | null, notes?: string): Promise<string> {
  const { data, error } = await supabase.rpc("assign_workspace", { p_workspace_id: workspaceId, p_employee_id: employeeId, p_department_id: departmentId ?? null, p_notes: notes ?? null });
  if (error) throw error;
  return data as string;
}

export async function releaseWorkspace(workspaceId: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc("release_workspace", { p_workspace_id: workspaceId, p_notes: notes ?? null });
  if (error) throw error;
}
