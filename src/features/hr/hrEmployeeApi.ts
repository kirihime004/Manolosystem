import { supabase } from "@/lib/supabase/client";
import type {
  Employee, EmployeeEmergencyContact, EmployeeHistoryEntry, EmployeeDocument, EmployeeDocumentType,
  EmploymentContract, ContractType, EmployeeCompensation, PayType,
  EmployeeOnboardingTask, EmployeeOffboardingTask,
} from "@/types/database";

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  positionId?: string;
  employmentTypeId?: string;
  employmentStatusId?: string;
}

export async function listEmployees(companyId: string, filters: EmployeeFilters = {}): Promise<Employee[]> {
  let query = supabase.from("employees").select("*").eq("company_id", companyId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.positionId) query = query.eq("position_id", filters.positionId);
  if (filters.employmentTypeId) query = query.eq("employment_type_id", filters.employmentTypeId);
  if (filters.employmentStatusId) query = query.eq("employment_status_id", filters.employmentStatusId);
  if (filters.search) {
    const s = filters.search.replace(/[%_]/g, "");
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,employee_number.ilike.%${s}%,company_email.ilike.%${s}%`);
  }
  const { data, error } = await query.order("last_name");
  if (error) throw error;
  return data as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Employee | null;
}

export async function getMyEmployeeRecord(companyId: string, userId: string): Promise<Employee | null> {
  const { data, error } = await supabase.from("employees").select("*").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as Employee | null;
}

export interface CreateEmployeeInput {
  companyId: string;
  firstName: string; middleName?: string | null; lastName: string; preferredName?: string | null;
  dateOfBirth?: string | null; gender?: string | null; nationality?: string | null; maritalStatus?: string | null;
  personalEmail?: string | null; companyEmail?: string | null; phone?: string | null; alternativePhone?: string | null;
  address?: string | null; city?: string | null; province?: string | null; country?: string | null;
  departmentId?: string | null; positionId?: string | null; managerId?: string | null; supervisorId?: string | null;
  employmentTypeId?: string | null; employmentStatusId?: string | null; employeeCategory?: string | null;
  hireDate?: string | null; probationStartDate?: string | null; probationEndDate?: string | null; workLocation?: string | null;
  userId?: string | null;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const { data, error } = await supabase.from("employees").insert({
    company_id: input.companyId,
    first_name: input.firstName, middle_name: input.middleName ?? null, last_name: input.lastName,
    preferred_name: input.preferredName ?? null, date_of_birth: input.dateOfBirth ?? null,
    gender: input.gender ?? null, nationality: input.nationality ?? null, marital_status: input.maritalStatus ?? null,
    personal_email: input.personalEmail ?? null, company_email: input.companyEmail ?? null,
    phone: input.phone ?? null, alternative_phone: input.alternativePhone ?? null,
    address: input.address ?? null, city: input.city ?? null, province: input.province ?? null, country: input.country ?? null,
    department_id: input.departmentId ?? null, position_id: input.positionId ?? null,
    manager_id: input.managerId ?? null, supervisor_id: input.supervisorId ?? null,
    employment_type_id: input.employmentTypeId ?? null, employment_status_id: input.employmentStatusId ?? null,
    employee_category: input.employeeCategory ?? null,
    hire_date: input.hireDate ?? null, probation_start_date: input.probationStartDate ?? null,
    probation_end_date: input.probationEndDate ?? null, work_location: input.workLocation ?? null,
    user_id: input.userId ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as Employee;
}

// updateEmployee logs the field-level change to employee_history explicitly
// (rather than a generic trigger diff) so the reason/notes the user typed
// travel with the record, matching the spec's history field list.
export async function updateEmployee(
  id: string, companyId: string, patch: Partial<Employee>,
  history?: { eventType: string; fieldName?: string; previousValue?: string; newValue?: string; reason?: string; notes?: string },
): Promise<void> {
  const { error } = await supabase.from("employees").update(patch).eq("id", id);
  if (error) throw error;
  if (history) {
    await supabase.rpc("log_employee_event", {
      p_company_id: companyId, p_employee_id: id, p_event_type: history.eventType,
      p_field_name: history.fieldName ?? null, p_previous_value: history.previousValue ?? null,
      p_new_value: history.newValue ?? null, p_reason: history.reason ?? null, p_notes: history.notes ?? null,
    });
  }
}

export async function listEmployeeHistory(employeeId: string): Promise<EmployeeHistoryEntry[]> {
  const { data, error } = await supabase.from("employee_history").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as EmployeeHistoryEntry[];
}

// ---------------------------------------------------------------------
// Emergency contacts
// ---------------------------------------------------------------------
export async function listEmergencyContacts(employeeId: string): Promise<EmployeeEmergencyContact[]> {
  const { data, error } = await supabase.from("employee_emergency_contacts").select("*").eq("employee_id", employeeId).order("is_primary", { ascending: false });
  if (error) throw error;
  return data as EmployeeEmergencyContact[];
}

export async function upsertEmergencyContact(input: {
  id?: string; employeeId: string; name: string; relationship?: string | null; phone?: string | null;
  email?: string | null; address?: string | null; isPrimary: boolean;
}): Promise<void> {
  const row = {
    employee_id: input.employeeId, name: input.name, relationship: input.relationship ?? null,
    phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null, is_primary: input.isPrimary,
  };
  if (input.id) {
    const { error } = await supabase.from("employee_emergency_contacts").update(row).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("employee_emergency_contacts").insert(row);
    if (error) throw error;
  }
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const { error } = await supabase.from("employee_emergency_contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Documents (private storage: employee-documents/{company_id}/{employee_id}/{filename})
// ---------------------------------------------------------------------
export async function listAllEmployeeDocuments(companyId: string): Promise<(EmployeeDocument & { employees: { first_name: string; last_name: string; employee_number: string } })[]> {
  const { data, error } = await supabase.from("employee_documents").select("*, employees!inner(first_name, last_name, employee_number)").eq("company_id", companyId).order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as unknown as (EmployeeDocument & { employees: { first_name: string; last_name: string; employee_number: string } })[];
}

export async function listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const { data, error } = await supabase.from("employee_documents").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as EmployeeDocument[];
}

export async function uploadEmployeeDocument(input: {
  companyId: string; employeeId: string; documentType: EmployeeDocumentType; title: string;
  documentNumber?: string | null; issueDate?: string | null; expiryDate?: string | null; notes?: string | null;
  file: File; uploadedBy: string;
}): Promise<void> {
  const path = `${input.companyId}/${input.employeeId}/${Date.now()}_${input.file.name}`;
  const { error: uploadError } = await supabase.storage.from("employee-documents").upload(path, input.file);
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("employee_documents").insert({
    company_id: input.companyId, employee_id: input.employeeId, document_type: input.documentType,
    title: input.title, document_number: input.documentNumber ?? null, issue_date: input.issueDate ?? null,
    expiry_date: input.expiryDate ?? null, notes: input.notes ?? null, storage_path: path, uploaded_by: input.uploadedBy,
  });
  if (error) throw error;
}

export async function getEmployeeDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteEmployeeDocument(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from("employee-documents").remove([storagePath]);
  const { error } = await supabase.from("employee_documents").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Profile photo (employee-photos/{company_id}/{employee_id}/{filename})
// ---------------------------------------------------------------------
export async function uploadProfilePhoto(companyId: string, employeeId: string, file: File): Promise<string> {
  const path = `${companyId}/${employeeId}/photo_${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("employee-photos").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("employees").update({ profile_photo_path: path }).eq("id", employeeId);
  if (error) throw error;
  return path;
}

export async function getProfilePhotoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("employee-photos").createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// Employment contracts
// ---------------------------------------------------------------------
export async function listContracts(employeeId: string): Promise<EmploymentContract[]> {
  const { data, error } = await supabase.from("employment_contracts").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as EmploymentContract[];
}

export async function listAllContracts(companyId: string): Promise<EmploymentContract[]> {
  const { data, error } = await supabase.from("employment_contracts").select("*").eq("company_id", companyId).order("end_date");
  if (error) throw error;
  return data as EmploymentContract[];
}

export async function createContract(input: {
  companyId: string; employeeId: string; contractType: ContractType; startDate: string; endDate?: string | null;
  positionId?: string | null; departmentId?: string | null; employmentTypeId?: string | null;
  salaryReference?: number | null; currencyId?: string | null; workingHours?: string | null;
  workLocation?: string | null; notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("employment_contracts").insert({
    company_id: input.companyId, employee_id: input.employeeId, contract_type: input.contractType,
    start_date: input.startDate, end_date: input.endDate ?? null, position_id: input.positionId ?? null,
    department_id: input.departmentId ?? null, employment_type_id: input.employmentTypeId ?? null,
    salary_reference: input.salaryReference ?? null, currency_id: input.currencyId ?? null,
    working_hours: input.workingHours ?? null, work_location: input.workLocation ?? null, notes: input.notes ?? null,
    status: "ACTIVE",
  });
  if (error) throw error;
}

export async function renewContract(id: string, newEndDate: string | null, notes?: string | null): Promise<void> {
  const { error } = await supabase.from("employment_contracts").update({ status: "RENEWED", end_date: newEndDate, notes }).eq("id", id);
  if (error) throw error;
}

export async function updateContractStatus(id: string, status: EmploymentContract["status"]): Promise<void> {
  const { error } = await supabase.from("employment_contracts").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Compensation (append-only)
// ---------------------------------------------------------------------
export async function listCompensationHistory(employeeId: string): Promise<EmployeeCompensation[]> {
  const { data, error } = await supabase.from("employee_compensation").select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false });
  if (error) throw error;
  return data as EmployeeCompensation[];
}

export async function recordCompensation(input: {
  companyId: string; employeeId: string; effectiveDate: string; payType: PayType;
  basicSalary: number; currencyId: string; payFrequency?: string | null; allowance?: number | null; notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("employee_compensation").insert({
    company_id: input.companyId, employee_id: input.employeeId, effective_date: input.effectiveDate,
    pay_type: input.payType, basic_salary: input.basicSalary, currency_id: input.currencyId,
    pay_frequency: input.payFrequency ?? null, allowance: input.allowance ?? 0, notes: input.notes ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Onboarding / offboarding
// ---------------------------------------------------------------------
export async function listOnboardingTasks(employeeId: string): Promise<EmployeeOnboardingTask[]> {
  const { data, error } = await supabase.from("employee_onboarding_tasks").select("*").eq("employee_id", employeeId).order("created_at");
  if (error) throw error;
  return data as EmployeeOnboardingTask[];
}

export async function startOnboarding(employeeId: string): Promise<void> {
  const { error } = await supabase.rpc("start_onboarding", { p_employee_id: employeeId });
  if (error) throw error;
}

export async function updateOnboardingTask(id: string, patch: Partial<EmployeeOnboardingTask>): Promise<void> {
  const { error } = await supabase.from("employee_onboarding_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listOffboardingTasks(employeeId: string): Promise<EmployeeOffboardingTask[]> {
  const { data, error } = await supabase.from("employee_offboarding_tasks").select("*").eq("employee_id", employeeId).order("created_at");
  if (error) throw error;
  return data as EmployeeOffboardingTask[];
}

export async function startOffboarding(employeeId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase.rpc("start_offboarding", { p_employee_id: employeeId, p_reason: reason ?? null });
  if (error) throw error;
}

export async function updateOffboardingTask(id: string, patch: Partial<EmployeeOffboardingTask>): Promise<void> {
  const { error } = await supabase.from("employee_offboarding_tasks").update(patch).eq("id", id);
  if (error) throw error;
}
