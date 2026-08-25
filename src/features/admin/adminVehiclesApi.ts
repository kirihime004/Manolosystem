import { supabase } from "@/lib/supabase/client";
import type { Vehicle, VehicleAssignment, VehicleMaintenance } from "@/types/database";

export async function listVehicles(companyId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("company_id", companyId).order("plate_number");
  if (error) throw error;
  return data as Vehicle[];
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Vehicle;
}

export async function createVehicle(input: {
  companyId: string; plateNumber: string; make?: string | null; model?: string | null; year?: number | null; vehicleType: string;
  color?: string | null; vin?: string | null; registrationNumber?: string | null; registrationExpiry?: string | null; insuranceExpiry?: string | null;
  locationId?: string | null; purchaseDate?: string | null; purchasePrice?: number | null; currencyId?: string | null; notes?: string | null;
}): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: input.companyId, plate_number: input.plateNumber, make: input.make ?? null, model: input.model ?? null, year: input.year ?? null,
      vehicle_type: input.vehicleType, color: input.color ?? null, vin: input.vin ?? null, registration_number: input.registrationNumber ?? null,
      registration_expiry: input.registrationExpiry ?? null, insurance_expiry: input.insuranceExpiry ?? null, location_id: input.locationId ?? null,
      purchase_date: input.purchaseDate ?? null, purchase_price: input.purchasePrice ?? null, currency_id: input.currencyId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(id: string, patch: Partial<{ registrationExpiry: string; insuranceExpiry: string; status: string; notes: string }>): Promise<void> {
  const { error } = await supabase.from("vehicles").update({ registration_expiry: patch.registrationExpiry, insurance_expiry: patch.insuranceExpiry, status: patch.status, notes: patch.notes }).eq("id", id);
  if (error) throw error;
}

export async function assignVehicle(vehicleId: string, employeeId: string, departmentId?: string | null, notes?: string): Promise<string> {
  const { data, error } = await supabase.rpc("assign_vehicle", { p_vehicle_id: vehicleId, p_employee_id: employeeId, p_department_id: departmentId ?? null, p_notes: notes ?? null });
  if (error) throw error;
  return data as string;
}

export async function returnVehicle(vehicleId: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc("return_vehicle", { p_vehicle_id: vehicleId, p_notes: notes ?? null });
  if (error) throw error;
}

export async function listVehicleAssignments(vehicleId: string): Promise<VehicleAssignment[]> {
  const { data, error } = await supabase.from("vehicle_assignments").select("*").eq("vehicle_id", vehicleId).order("assigned_date", { ascending: false });
  if (error) throw error;
  return data as VehicleAssignment[];
}

export async function listVehicleMaintenance(vehicleId: string): Promise<VehicleMaintenance[]> {
  const { data, error } = await supabase.from("vehicle_maintenance").select("*").eq("vehicle_id", vehicleId).order("service_date", { ascending: false });
  if (error) throw error;
  return data as VehicleMaintenance[];
}

export async function addVehicleMaintenance(input: {
  vehicleId: string; maintenanceType: string; serviceDate?: string; mileage?: number | null; cost?: number | null; currencyId?: string | null; supplierId?: string | null; notes?: string | null;
}): Promise<VehicleMaintenance> {
  const { data, error } = await supabase
    .from("vehicle_maintenance")
    .insert({
      vehicle_id: input.vehicleId, maintenance_type: input.maintenanceType, service_date: input.serviceDate ?? new Date().toISOString().slice(0, 10),
      mileage: input.mileage ?? null, cost: input.cost ?? null, currency_id: input.currencyId ?? null, supplier_id: input.supplierId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as VehicleMaintenance;
}
