import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as orgApi from "@/features/hr/hrOrgApi";
import * as employeeApi from "@/features/hr/hrEmployeeApi";
import type { EmployeeFilters, CreateEmployeeInput } from "@/features/hr/hrEmployeeApi";
import * as attendanceApi from "@/features/hr/hrAttendanceApi";
import * as leaveApi from "@/features/hr/hrLeaveApi";
import * as overtimeApi from "@/features/hr/hrOvertimeApi";
import * as requestsApi from "@/features/hr/hrRequestsApi";
import * as benefitsApi from "@/features/hr/hrBenefitsApi";
import * as payrollApi from "@/features/hr/hrPayrollApi";
import { getHrDashboardStats } from "@/features/hr/hrDashboardApi";
import type { Employee } from "@/types/database";

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export function useHrDashboardStats(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-dashboard", companyId], queryFn: () => getHrDashboardStats(companyId!), enabled: !!companyId });
}

// ---------------------------------------------------------------------
// Org: positions, employment types/statuses, leave types, schedules, holidays
// ---------------------------------------------------------------------
export function usePositions(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-positions", companyId], queryFn: () => orgApi.listPositions(companyId!), enabled: !!companyId });
}

export function usePositionMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-positions", companyId] });
  return {
    create: useMutation({ mutationFn: orgApi.createPosition, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updatePosition>[1] }) => orgApi.updatePosition(input.id, input.patch), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: orgApi.deletePosition, onSuccess: invalidate }),
  };
}

export function useEmploymentTypes(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-employment-types", companyId], queryFn: () => orgApi.listEmploymentTypes(companyId!), enabled: !!companyId });
}

export function useEmploymentStatuses(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-employment-statuses", companyId], queryFn: () => orgApi.listEmploymentStatuses(companyId!), enabled: !!companyId });
}

export function useEmploymentConfigMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidateTypes = () => qc.invalidateQueries({ queryKey: ["hr-employment-types", companyId] });
  const invalidateStatuses = () => qc.invalidateQueries({ queryKey: ["hr-employment-statuses", companyId] });
  return {
    createType: useMutation({
      mutationFn: (input: { code: string; label: string }) => orgApi.createEmploymentType(companyId!, input.code, input.label),
      onSuccess: invalidateTypes,
    }),
    updateType: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateEmploymentType>[1] }) => orgApi.updateEmploymentType(input.id, input.patch),
      onSuccess: invalidateTypes,
    }),
    setTypeStatus: useMutation({
      mutationFn: (input: { id: string; status: "ACTIVE" | "INACTIVE" }) => orgApi.setEmploymentTypeStatus(input.id, input.status),
      onSuccess: invalidateTypes,
    }),
    deleteType: useMutation({ mutationFn: orgApi.deleteEmploymentType, onSuccess: invalidateTypes }),
    createStatus: useMutation({
      mutationFn: (input: { code: string; label: string; isActiveEmployment: boolean }) => orgApi.createEmploymentStatus(companyId!, input.code, input.label, input.isActiveEmployment),
      onSuccess: invalidateStatuses,
    }),
    updateStatus: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateEmploymentStatus>[1] }) => orgApi.updateEmploymentStatus(input.id, input.patch),
      onSuccess: invalidateStatuses,
    }),
    setStatusStatus: useMutation({
      mutationFn: (input: { id: string; status: "ACTIVE" | "INACTIVE" }) => orgApi.setEmploymentStatusStatus(input.id, input.status),
      onSuccess: invalidateStatuses,
    }),
    deleteStatus: useMutation({ mutationFn: orgApi.deleteEmploymentStatus, onSuccess: invalidateStatuses }),
  };
}

export function useLeaveTypes(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-leave-types", companyId], queryFn: () => orgApi.listLeaveTypes(companyId!), enabled: !!companyId });
}

export function useLeaveTypeMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-leave-types", companyId] });
  return {
    create: useMutation({ mutationFn: orgApi.createLeaveType, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateLeaveType>[1] }) => orgApi.updateLeaveType(input.id, input.patch), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: orgApi.deleteLeaveType, onSuccess: invalidate }),
  };
}

export function useWorkSchedules(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-work-schedules", companyId], queryFn: () => orgApi.listWorkSchedules(companyId!), enabled: !!companyId });
}

export function useHolidays(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-holidays", companyId], queryFn: () => orgApi.listHolidays(companyId!), enabled: !!companyId });
}

export function useScheduleHolidayMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidateSchedules = () => qc.invalidateQueries({ queryKey: ["hr-work-schedules", companyId] });
  const invalidateHolidays = () => qc.invalidateQueries({ queryKey: ["hr-holidays", companyId] });
  return {
    createSchedule: useMutation({ mutationFn: orgApi.createWorkSchedule, onSuccess: invalidateSchedules }),
    updateSchedule: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateWorkSchedule>[1] }) => orgApi.updateWorkSchedule(input.id, input.patch),
      onSuccess: invalidateSchedules,
    }),
    deleteSchedule: useMutation({ mutationFn: orgApi.deleteWorkSchedule, onSuccess: invalidateSchedules }),
    createHoliday: useMutation({ mutationFn: orgApi.createHoliday, onSuccess: invalidateHolidays }),
    updateHoliday: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateHoliday>[1] }) => orgApi.updateHoliday(input.id, input.patch),
      onSuccess: invalidateHolidays,
    }),
    setHolidayStatus: useMutation({
      mutationFn: (input: { id: string; status: "ACTIVE" | "CANCELLED" }) => orgApi.setHolidayStatus(input.id, input.status),
      onSuccess: invalidateHolidays,
    }),
    deleteHoliday: useMutation({ mutationFn: orgApi.deleteHoliday, onSuccess: invalidateHolidays }),
  };
}

// ---------------------------------------------------------------------
// Onboarding / offboarding checklist templates
// ---------------------------------------------------------------------
export function useOnboardingTemplates(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-onboarding-templates", companyId], queryFn: () => orgApi.listOnboardingTemplates(companyId!), enabled: !!companyId });
}

export function useOffboardingTemplates(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-offboarding-templates", companyId], queryFn: () => orgApi.listOffboardingTemplates(companyId!), enabled: !!companyId });
}

export function useTaskTemplateMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidateOnboarding = () => qc.invalidateQueries({ queryKey: ["hr-onboarding-templates", companyId] });
  const invalidateOffboarding = () => qc.invalidateQueries({ queryKey: ["hr-offboarding-templates", companyId] });
  return {
    createOnboarding: useMutation({ mutationFn: orgApi.createOnboardingTemplate, onSuccess: invalidateOnboarding }),
    updateOnboarding: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateOnboardingTemplate>[1] }) => orgApi.updateOnboardingTemplate(input.id, input.patch),
      onSuccess: invalidateOnboarding,
    }),
    deleteOnboarding: useMutation({ mutationFn: orgApi.deleteOnboardingTemplate, onSuccess: invalidateOnboarding }),
    createOffboarding: useMutation({ mutationFn: orgApi.createOffboardingTemplate, onSuccess: invalidateOffboarding }),
    updateOffboarding: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof orgApi.updateOffboardingTemplate>[1] }) => orgApi.updateOffboardingTemplate(input.id, input.patch),
      onSuccess: invalidateOffboarding,
    }),
    deleteOffboarding: useMutation({ mutationFn: orgApi.deleteOffboardingTemplate, onSuccess: invalidateOffboarding }),
  };
}

// ---------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------
export function useEmployees(companyId: string | undefined, filters: EmployeeFilters = {}) {
  return useQuery({
    queryKey: ["hr-employees", companyId, filters],
    queryFn: () => employeeApi.listEmployees(companyId!, filters),
    enabled: !!companyId,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({ queryKey: ["hr-employee", id], queryFn: () => employeeApi.getEmployee(id!), enabled: !!id });
}

export function useMyEmployeeRecord(companyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["hr-my-employee", companyId, userId],
    queryFn: () => employeeApi.getMyEmployeeRecord(companyId!, userId!),
    enabled: !!companyId && !!userId,
  });
}

export function useEmployeeMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidateList = () => qc.invalidateQueries({ queryKey: ["hr-employees", companyId] });
  const create = useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeeApi.createEmployee(input),
    onSuccess: invalidateList,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Partial<Employee>; history?: Parameters<typeof employeeApi.updateEmployee>[3] }) =>
      employeeApi.updateEmployee(input.id, companyId!, input.patch, input.history),
    onSuccess: (_v, vars) => {
      invalidateList();
      qc.invalidateQueries({ queryKey: ["hr-employee", vars.id] });
      qc.invalidateQueries({ queryKey: ["hr-employee-history", vars.id] });
    },
  });
  return { create, update };
}

export function useEmployeeHistory(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-employee-history", employeeId], queryFn: () => employeeApi.listEmployeeHistory(employeeId!), enabled: !!employeeId });
}

export function useEmergencyContacts(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-emergency-contacts", employeeId], queryFn: () => employeeApi.listEmergencyContacts(employeeId!), enabled: !!employeeId });
}

export function useEmergencyContactMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-emergency-contacts", employeeId] });
  return {
    upsert: useMutation({ mutationFn: employeeApi.upsertEmergencyContact, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: employeeApi.deleteEmergencyContact, onSuccess: invalidate }),
  };
}

export function useAllEmployeeDocuments(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-all-documents", companyId], queryFn: () => employeeApi.listAllEmployeeDocuments(companyId!), enabled: !!companyId });
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-employee-documents", employeeId], queryFn: () => employeeApi.listEmployeeDocuments(employeeId!), enabled: !!employeeId });
}

export function useEmployeeDocumentMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-employee-documents", employeeId] });
  return {
    upload: useMutation({ mutationFn: employeeApi.uploadEmployeeDocument, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof employeeApi.updateEmployeeDocument>[1] }) => employeeApi.updateEmployeeDocument(input.id, input.patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (input: { id: string; storagePath: string }) => employeeApi.deleteEmployeeDocument(input.id, input.storagePath),
      onSuccess: invalidate,
    }),
  };
}

export function useContracts(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-contracts", employeeId], queryFn: () => employeeApi.listContracts(employeeId!), enabled: !!employeeId });
}

export function useAllContracts(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-all-contracts", companyId], queryFn: () => employeeApi.listAllContracts(companyId!), enabled: !!companyId });
}

export function useContractMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-contracts", employeeId] });
    qc.invalidateQueries({ queryKey: ["hr-all-contracts"] });
  };
  return {
    create: useMutation({ mutationFn: employeeApi.createContract, onSuccess: invalidate }),
    renew: useMutation({
      mutationFn: (input: { id: string; newEndDate: string | null; notes?: string | null }) => employeeApi.renewContract(input.id, input.newEndDate, input.notes),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: (input: { id: string; status: Parameters<typeof employeeApi.updateContractStatus>[1] }) => employeeApi.updateContractStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
  };
}

export function useCompensationHistory(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-compensation", employeeId], queryFn: () => employeeApi.listCompensationHistory(employeeId!), enabled: !!employeeId });
}

export function useCompensationMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  return {
    record: useMutation({ mutationFn: employeeApi.recordCompensation, onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-compensation", employeeId] }) }),
  };
}

export function useOnboardingTasks(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-onboarding", employeeId], queryFn: () => employeeApi.listOnboardingTasks(employeeId!), enabled: !!employeeId });
}

export function useOffboardingTasks(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-offboarding", employeeId], queryFn: () => employeeApi.listOffboardingTasks(employeeId!), enabled: !!employeeId });
}

export function useLifecycleMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidateOnboarding = () => qc.invalidateQueries({ queryKey: ["hr-onboarding", employeeId] });
  const invalidateOffboarding = () => qc.invalidateQueries({ queryKey: ["hr-offboarding", employeeId] });
  return {
    startOnboarding: useMutation({ mutationFn: () => employeeApi.startOnboarding(employeeId!), onSuccess: invalidateOnboarding }),
    addOnboardingTask: useMutation({ mutationFn: employeeApi.addOnboardingTask, onSuccess: invalidateOnboarding }),
    updateOnboardingTask: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof employeeApi.updateOnboardingTask>[1] }) => employeeApi.updateOnboardingTask(input.id, input.patch),
      onSuccess: invalidateOnboarding,
    }),
    deleteOnboardingTask: useMutation({ mutationFn: employeeApi.deleteOnboardingTask, onSuccess: invalidateOnboarding }),
    startOffboarding: useMutation({
      mutationFn: (reason?: string | null) => employeeApi.startOffboarding(employeeId!, reason),
      onSuccess: invalidateOffboarding,
    }),
    addOffboardingTask: useMutation({ mutationFn: employeeApi.addOffboardingTask, onSuccess: invalidateOffboarding }),
    updateOffboardingTask: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof employeeApi.updateOffboardingTask>[1] }) => employeeApi.updateOffboardingTask(input.id, input.patch),
      onSuccess: invalidateOffboarding,
    }),
    deleteOffboardingTask: useMutation({ mutationFn: employeeApi.deleteOffboardingTask, onSuccess: invalidateOffboarding }),
  };
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------
export function useAttendance(companyId: string | undefined, opts: { employeeId?: string; from?: string; to?: string } = {}) {
  return useQuery({ queryKey: ["hr-attendance", companyId, opts], queryFn: () => attendanceApi.listAttendance(companyId!, opts), enabled: !!companyId });
}

export function useAttendanceMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-attendance", companyId] });
  return {
    record: useMutation({ mutationFn: attendanceApi.recordAttendance, onSuccess: invalidate }),
  };
}

export function useAttendanceCorrections(companyId: string | undefined, employeeId?: string) {
  return useQuery({
    queryKey: ["hr-attendance-corrections", companyId, employeeId],
    queryFn: () => attendanceApi.listAttendanceCorrections(companyId!, employeeId),
    enabled: !!companyId,
  });
}

export function useAttendanceCorrectionMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-attendance-corrections", companyId] });
    qc.invalidateQueries({ queryKey: ["hr-attendance", companyId] });
  };
  return {
    request: useMutation({ mutationFn: attendanceApi.requestAttendanceCorrection, onSuccess: invalidate }),
    decide: useMutation({
      mutationFn: (input: { id: string; decision: "APPROVED" | "REJECTED"; notes?: string | null }) => attendanceApi.decideAttendanceCorrection(input.id, input.decision, input.notes),
      onSuccess: invalidate,
    }),
  };
}

// ---------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------
export function useLeaveRequests(companyId: string | undefined, employeeId?: string) {
  return useQuery({ queryKey: ["hr-leave-requests", companyId, employeeId], queryFn: () => leaveApi.listLeaveRequests(companyId!, employeeId), enabled: !!companyId });
}

export function useLeaveRequest(id: string | undefined) {
  return useQuery({ queryKey: ["hr-leave-request", id], queryFn: () => leaveApi.getLeaveRequest(id!), enabled: !!id });
}

export function useLeaveApprovals(leaveRequestId: string | undefined) {
  return useQuery({ queryKey: ["hr-leave-approvals", leaveRequestId], queryFn: () => leaveApi.listLeaveApprovals(leaveRequestId!), enabled: !!leaveRequestId });
}

export function useLeaveBalances(companyId: string | undefined, employeeId: string | undefined, year: number) {
  return useQuery({
    queryKey: ["hr-leave-balances", companyId, employeeId, year],
    queryFn: () => leaveApi.listLeaveBalances(companyId!, employeeId!, year),
    enabled: !!companyId && !!employeeId,
  });
}

export function useLeaveMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-leave-requests", companyId] });
    qc.invalidateQueries({ queryKey: ["hr-leave-balances"] });
  };
  return {
    create: useMutation({ mutationFn: leaveApi.createLeaveRequest, onSuccess: invalidate }),
    submit: useMutation({ mutationFn: leaveApi.submitLeaveRequest, onSuccess: invalidate }),
    decide: useMutation({
      mutationFn: (input: { approvalId: string; decision: "APPROVED" | "REJECTED"; comments?: string | null }) => leaveApi.decideLeaveRequestApproval(input.approvalId, input.decision, input.comments),
      onSuccess: invalidate,
    }),
    cancel: useMutation({ mutationFn: leaveApi.cancelLeaveRequest, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Overtime / timesheets
// ---------------------------------------------------------------------
export function useOvertimeRequests(companyId: string | undefined, employeeId?: string) {
  return useQuery({ queryKey: ["hr-overtime-requests", companyId, employeeId], queryFn: () => overtimeApi.listOvertimeRequests(companyId!, employeeId), enabled: !!companyId });
}

export function useOvertimeApprovals(overtimeRequestId: string | undefined) {
  return useQuery({ queryKey: ["hr-overtime-approvals", overtimeRequestId], queryFn: () => overtimeApi.listOvertimeApprovals(overtimeRequestId!), enabled: !!overtimeRequestId });
}

export function useOvertimeMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-overtime-requests", companyId] });
  return {
    create: useMutation({ mutationFn: overtimeApi.createOvertimeRequest, onSuccess: invalidate }),
    submit: useMutation({ mutationFn: overtimeApi.submitOvertimeRequest, onSuccess: invalidate }),
    decide: useMutation({
      mutationFn: (input: { approvalId: string; decision: "APPROVED" | "REJECTED"; comments?: string | null }) => overtimeApi.decideOvertimeRequestApproval(input.approvalId, input.decision, input.comments),
      onSuccess: invalidate,
    }),
    cancel: useMutation({ mutationFn: overtimeApi.cancelOvertimeRequest, onSuccess: invalidate }),
  };
}

export function useTimesheets(companyId: string | undefined, employeeId?: string) {
  return useQuery({ queryKey: ["hr-timesheets", companyId, employeeId], queryFn: () => overtimeApi.listTimesheets(companyId!, employeeId), enabled: !!companyId });
}

export function useTimesheetMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-timesheets", companyId] });
  return {
    create: useMutation({ mutationFn: overtimeApi.createTimesheet, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (input: { id: string; patch: Parameters<typeof overtimeApi.updateTimesheet>[1] }) => overtimeApi.updateTimesheet(input.id, input.patch),
      onSuccess: invalidate,
    }),
    submit: useMutation({ mutationFn: overtimeApi.submitTimesheet, onSuccess: invalidate }),
    decide: useMutation({
      mutationFn: (input: { id: string; decision: "APPROVED" | "REJECTED" }) => overtimeApi.decideTimesheet(input.id, input.decision),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: overtimeApi.deleteTimesheet, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// HR Requests
// ---------------------------------------------------------------------
export function useHrRequests(companyId: string | undefined, employeeId?: string) {
  return useQuery({ queryKey: ["hr-requests", companyId, employeeId], queryFn: () => requestsApi.listHrRequests(companyId!, employeeId), enabled: !!companyId });
}

export function useHrRequest(id: string | undefined) {
  return useQuery({ queryKey: ["hr-request", id], queryFn: () => requestsApi.getHrRequest(id!), enabled: !!id });
}

export function useHrRequestComments(hrRequestId: string | undefined) {
  return useQuery({ queryKey: ["hr-request-comments", hrRequestId], queryFn: () => requestsApi.listHrRequestComments(hrRequestId!), enabled: !!hrRequestId });
}

export function useHrRequestMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["hr-requests", companyId] });
    if (id) {
      qc.invalidateQueries({ queryKey: ["hr-request", id] });
      qc.invalidateQueries({ queryKey: ["hr-request-comments", id] });
    }
  };
  return {
    create: useMutation({ mutationFn: requestsApi.createHrRequest, onSuccess: () => invalidate() }),
    transition: useMutation({
      mutationFn: (input: { id: string; newStatus: Parameters<typeof requestsApi.transitionHrRequest>[1]; comment?: string | null }) =>
        requestsApi.transitionHrRequest(input.id, input.newStatus, input.comment),
      onSuccess: (_v, vars) => invalidate(vars.id),
    }),
    addComment: useMutation({
      mutationFn: (input: { id: string; comment: string }) => requestsApi.addHrRequestComment(input.id, input.comment),
      onSuccess: (_v, vars) => invalidate(vars.id),
    }),
  };
}

// ---------------------------------------------------------------------
// Benefits / deductions
// ---------------------------------------------------------------------
export function useBenefits(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-benefits", employeeId], queryFn: () => benefitsApi.listBenefits(employeeId!), enabled: !!employeeId });
}

export function useAllBenefits(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-all-benefits", companyId], queryFn: () => benefitsApi.listAllBenefits(companyId!), enabled: !!companyId });
}

export function useAllDeductions(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-all-deductions", companyId], queryFn: () => benefitsApi.listAllDeductions(companyId!), enabled: !!companyId });
}

export function useBenefitMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-benefits", employeeId] });
  return {
    create: useMutation({ mutationFn: benefitsApi.createBenefit, onSuccess: invalidate }),
    setStatus: useMutation({
      mutationFn: (input: { id: string; status: Parameters<typeof benefitsApi.updateBenefitStatus>[1] }) => benefitsApi.updateBenefitStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
  };
}

export function useDeductions(employeeId: string | undefined) {
  return useQuery({ queryKey: ["hr-deductions", employeeId], queryFn: () => benefitsApi.listDeductions(employeeId!), enabled: !!employeeId });
}

export function useDeductionMutations(employeeId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-deductions", employeeId] });
  return {
    create: useMutation({ mutationFn: benefitsApi.createDeduction, onSuccess: invalidate }),
    setStatus: useMutation({
      mutationFn: (input: { id: string; status: Parameters<typeof benefitsApi.updateDeductionStatus>[1] }) => benefitsApi.updateDeductionStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
  };
}

// ---------------------------------------------------------------------
// Payroll periods
// ---------------------------------------------------------------------
export function usePayrollPeriods(companyId: string | undefined) {
  return useQuery({ queryKey: ["hr-payroll-periods", companyId], queryFn: () => payrollApi.listPayrollPeriods(companyId!), enabled: !!companyId });
}

export function usePayrollPeriodMutations(companyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-payroll-periods", companyId] });
  return {
    create: useMutation({ mutationFn: payrollApi.createPayrollPeriod, onSuccess: invalidate }),
    setStatus: useMutation({
      mutationFn: (input: { id: string; status: Parameters<typeof payrollApi.updatePayrollPeriodStatus>[1] }) => payrollApi.updatePayrollPeriodStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
  };
}
