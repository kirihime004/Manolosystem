import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as requestsApi from "@/features/admin/adminRequestsApi";
import * as facilitiesApi from "@/features/admin/adminFacilitiesApi";
import * as suppliesApi from "@/features/admin/adminSuppliesApi";
import * as assetsApi from "@/features/admin/adminAssetsApi";
import * as maintenanceApi from "@/features/admin/adminMaintenanceApi";
import * as vehiclesApi from "@/features/admin/adminVehiclesApi";
import * as travelApi from "@/features/admin/adminTravelApi";
import * as visitorsApi from "@/features/admin/adminVisitorsApi";
import * as meetingsApi from "@/features/admin/adminMeetingsApi";
import * as eventsApi from "@/features/admin/adminEventsApi";
import * as contractsApi from "@/features/admin/adminContractsApi";
import * as complianceApi from "@/features/admin/adminComplianceApi";
import * as documentsApi from "@/features/admin/adminDocumentsApi";
import * as announcementsApi from "@/features/admin/adminAnnouncementsApi";
import * as courierApi from "@/features/admin/adminCourierApi";
import * as dashboardApi from "@/features/admin/adminDashboardApi";
import type { AdminRequestFilters } from "@/features/admin/adminRequestsApi";

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export function useAdminDashboardSummary(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-dashboard", companyId], queryFn: () => dashboardApi.getAdminDashboardSummary(companyId!), enabled: !!companyId });
}

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------
export function useAdminRequestCategories(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-request-categories", companyId], queryFn: () => requestsApi.listAdminRequestCategories(companyId!), enabled: !!companyId });
}

export function useAdminRequestCategoryMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-request-categories", companyId] });
  const create = useMutation({ mutationFn: requestsApi.createAdminRequestCategory, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof requestsApi.updateAdminRequestCategory>[1] }) => requestsApi.updateAdminRequestCategory(input.id, input.patch),
    onSuccess: invalidate,
  });
  return { create, update };
}

export function useAdminRequests(companyId: string | undefined, filters: AdminRequestFilters = {}) {
  return useQuery({ queryKey: ["admin-requests", companyId, filters], queryFn: () => requestsApi.listAdminRequests(companyId!, filters), enabled: !!companyId });
}

export function useAdminRequest(id: string | undefined) {
  return useQuery({ queryKey: ["admin-request", id], queryFn: () => requestsApi.getAdminRequest(id!), enabled: !!id });
}

export function useAdminRequestComments(requestId: string | undefined) {
  return useQuery({ queryKey: ["admin-request-comments", requestId], queryFn: () => requestsApi.listAdminRequestComments(requestId!), enabled: !!requestId });
}

export function useAdminRequestApprovals(requestId: string | undefined) {
  return useQuery({ queryKey: ["admin-request-approvals", requestId], queryFn: () => requestsApi.listAdminRequestApprovals(requestId!), enabled: !!requestId });
}

export function useAdminRequestHistory(requestId: string | undefined) {
  return useQuery({ queryKey: ["admin-request-history", requestId], queryFn: () => requestsApi.listAdminRequestHistory(requestId!), enabled: !!requestId });
}

export function useAdminRequestMutations(companyId: string | undefined, requestId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-requests", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-request", requestId] });
    queryClient.invalidateQueries({ queryKey: ["admin-request-approvals", requestId] });
    queryClient.invalidateQueries({ queryKey: ["admin-request-history", requestId] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    create: useMutation({ mutationFn: requestsApi.createAdminRequest, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof requestsApi.updateAdminRequest>[1] }) => requestsApi.updateAdminRequest(input.id, input.patch), onSuccess: invalidate }),
    submit: useMutation({ mutationFn: requestsApi.submitAdminRequest, onSuccess: invalidate }),
    startReview: useMutation({ mutationFn: requestsApi.startAdminRequestReview, onSuccess: invalidate }),
    routeForApproval: useMutation({ mutationFn: requestsApi.routeAdminRequestForApproval, onSuccess: invalidate }),
    decideApproval: useMutation({
      mutationFn: (input: { approvalId: string; decision: "APPROVED" | "REJECTED"; comments?: string }) => requestsApi.decideAdminRequestApproval(input.approvalId, input.decision, input.comments),
      onSuccess: invalidate,
    }),
    assign: useMutation({ mutationFn: (input: { id: string; assignedTo: string }) => requestsApi.assignAdminRequest(input.id, input.assignedTo), onSuccess: invalidate }),
    startWork: useMutation({ mutationFn: requestsApi.startAdminRequestWork, onSuccess: invalidate }),
    markWaiting: useMutation({ mutationFn: (input: { id: string; reason?: string }) => requestsApi.markAdminRequestWaiting(input.id, input.reason), onSuccess: invalidate }),
    complete: useMutation({ mutationFn: requestsApi.completeAdminRequest, onSuccess: invalidate }),
    close: useMutation({ mutationFn: requestsApi.closeAdminRequest, onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (input: { id: string; reason?: string }) => requestsApi.rejectAdminRequest(input.id, input.reason), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: requestsApi.cancelAdminRequest, onSuccess: invalidate }),
    addComment: useMutation({ mutationFn: requestsApi.addAdminRequestComment, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-request-comments", requestId] }) }),
  };
}

// ---------------------------------------------------------------------
// Facilities: Locations / Buildings / Floors / Rooms / Bookings / Workspaces
// ---------------------------------------------------------------------
export function useLocations(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-locations", companyId], queryFn: () => facilitiesApi.listLocations(companyId!), enabled: !!companyId });
}

export function useLocationMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-locations", companyId] });
  return {
    create: useMutation({ mutationFn: facilitiesApi.createLocation, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof facilitiesApi.updateLocation>[1] }) => facilitiesApi.updateLocation(input.id, input.patch), onSuccess: invalidate }),
  };
}

export function useBuildings(locationId: string | undefined) {
  return useQuery({ queryKey: ["admin-buildings", locationId], queryFn: () => facilitiesApi.listBuildings(locationId!), enabled: !!locationId });
}

export function useBuildingMutations(locationId: string | undefined) {
  const queryClient = useQueryClient();
  return { create: useMutation({ mutationFn: facilitiesApi.createBuilding, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-buildings", locationId] }) }) };
}

export function useFloors(buildingId: string | undefined) {
  return useQuery({ queryKey: ["admin-floors", buildingId], queryFn: () => facilitiesApi.listFloors(buildingId!), enabled: !!buildingId });
}

export function useFloorMutations(buildingId: string | undefined) {
  const queryClient = useQueryClient();
  return { create: useMutation({ mutationFn: facilitiesApi.createFloor, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-floors", buildingId] }) }) };
}

export function useRooms(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-rooms", companyId], queryFn: () => facilitiesApi.listRooms(companyId!), enabled: !!companyId });
}

export function useRoomMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-rooms", companyId] });
  return {
    create: useMutation({ mutationFn: facilitiesApi.createRoom, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof facilitiesApi.updateRoom>[1] }) => facilitiesApi.updateRoom(input.id, input.patch), onSuccess: invalidate }),
  };
}

export function useRoomBookings(companyId: string | undefined, roomId?: string) {
  return useQuery({ queryKey: ["admin-room-bookings", companyId, roomId], queryFn: () => facilitiesApi.listRoomBookings(companyId!, roomId), enabled: !!companyId });
}

export function useRoomBookingMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-room-bookings", companyId] });
  return {
    create: useMutation({ mutationFn: facilitiesApi.createRoomBooking, onSuccess: invalidate }),
    updateStatus: useMutation({ mutationFn: (input: { id: string; status: string }) => facilitiesApi.updateRoomBookingStatus(input.id, input.status), onSuccess: invalidate }),
  };
}

export function useWorkspaces(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-workspaces", companyId], queryFn: () => facilitiesApi.listWorkspaces(companyId!), enabled: !!companyId });
}

export function useWorkspaceAssignments(workspaceId: string | undefined) {
  return useQuery({ queryKey: ["admin-workspace-assignments", workspaceId], queryFn: () => facilitiesApi.listWorkspaceAssignments(workspaceId!), enabled: !!workspaceId });
}

export function useWorkspaceMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-workspaces", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-workspace-assignments"] });
  };
  return {
    create: useMutation({ mutationFn: facilitiesApi.createWorkspace, onSuccess: invalidate }),
    assign: useMutation({
      mutationFn: (input: { workspaceId: string; employeeId: string; departmentId?: string | null; notes?: string }) =>
        facilitiesApi.assignWorkspace(input.workspaceId, input.employeeId, input.departmentId, input.notes),
      onSuccess: invalidate,
    }),
    release: useMutation({ mutationFn: (input: { workspaceId: string; notes?: string }) => facilitiesApi.releaseWorkspace(input.workspaceId, input.notes), onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Office Supplies
// ---------------------------------------------------------------------
export function useOfficeSupplies(companyId: string | undefined) {
  return useQuery({ queryKey: ["office-supplies", companyId], queryFn: () => suppliesApi.listOfficeSupplies(companyId!), enabled: !!companyId });
}

export function useSupplyMovements(supplyId: string | undefined) {
  return useQuery({ queryKey: ["office-supply-movements", supplyId], queryFn: () => suppliesApi.listSupplyMovements(supplyId!), enabled: !!supplyId });
}

export function useOfficeSupplyMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["office-supplies", companyId] });
    queryClient.invalidateQueries({ queryKey: ["office-supply-movements"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    create: useMutation({ mutationFn: suppliesApi.createOfficeSupply, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof suppliesApi.updateOfficeSupply>[1] }) => suppliesApi.updateOfficeSupply(input.id, input.patch), onSuccess: invalidate }),
    recordMovement: useMutation({ mutationFn: suppliesApi.recordSupplyMovement, onSuccess: invalidate }),
  };
}

export function useOfficeSupplyRequests(companyId: string | undefined) {
  return useQuery({ queryKey: ["office-supply-requests", companyId], queryFn: () => suppliesApi.listOfficeSupplyRequests(companyId!), enabled: !!companyId });
}

export function useOfficeSupplyRequestMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["office-supply-requests", companyId] });
    queryClient.invalidateQueries({ queryKey: ["office-supplies", companyId] });
  };
  return {
    create: useMutation({ mutationFn: suppliesApi.createOfficeSupplyRequest, onSuccess: invalidate }),
    decide: useMutation({ mutationFn: (input: { id: string; approve: boolean }) => suppliesApi.decideOfficeSupplyRequest(input.id, input.approve), onSuccess: invalidate }),
    issue: useMutation({ mutationFn: suppliesApi.issueOfficeSupplyRequest, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Admin Assets
// ---------------------------------------------------------------------
export function useAdminAssets(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-assets", companyId], queryFn: () => assetsApi.listAdminAssets(companyId!), enabled: !!companyId });
}

export function useAdminAsset(id: string | undefined) {
  return useQuery({ queryKey: ["admin-asset", id], queryFn: () => assetsApi.getAdminAsset(id!), enabled: !!id });
}

export function useAdminAssetMutations(companyId: string | undefined, assetId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-assets", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-asset", assetId] });
  };
  return {
    create: useMutation({ mutationFn: assetsApi.createAdminAsset, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof assetsApi.updateAdminAsset>[1] }) => assetsApi.updateAdminAsset(input.id, input.patch), onSuccess: invalidate }),
    reassign: useMutation({ mutationFn: assetsApi.reassignAdminAsset, onSuccess: invalidate }),
    dispose: useMutation({
      mutationFn: (input: { assetId: string; status: "DISPOSED" | "RETIRED" | "LOST" | "DAMAGED"; reason?: string }) => assetsApi.disposeAdminAsset(input.assetId, input.status, input.reason),
      onSuccess: invalidate,
    }),
    postAccountingEntry: useMutation({
      mutationFn: (input: { companyId: string; assetId: string }) => assetsApi.postAdminAssetDisposalEntry(input.companyId, input.assetId),
      onSuccess: invalidate,
    }),
  };
}

// ---------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------
export function useMaintenanceRecords(companyId: string | undefined) {
  return useQuery({ queryKey: ["maintenance-records", companyId], queryFn: () => maintenanceApi.listMaintenanceRecords(companyId!), enabled: !!companyId });
}

export function useMaintenanceRecord(id: string | undefined) {
  return useQuery({ queryKey: ["maintenance-record", id], queryFn: () => maintenanceApi.getMaintenanceRecord(id!), enabled: !!id });
}

export function useMaintenanceSchedules(companyId: string | undefined) {
  return useQuery({ queryKey: ["maintenance-schedules", companyId], queryFn: () => maintenanceApi.listMaintenanceSchedules(companyId!), enabled: !!companyId });
}

export function useMaintenanceMutations(companyId: string | undefined, recordId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["maintenance-records", companyId] });
    queryClient.invalidateQueries({ queryKey: ["maintenance-record", recordId] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    create: useMutation({ mutationFn: maintenanceApi.createMaintenanceRecord, onSuccess: invalidate }),
    assign: useMutation({ mutationFn: (input: { id: string; assignedTo: string; scheduledDate?: string }) => maintenanceApi.assignMaintenance(input.id, input.assignedTo, input.scheduledDate), onSuccess: invalidate }),
    start: useMutation({ mutationFn: maintenanceApi.startMaintenance, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: (input: { id: string; actualCost?: number; notes?: string }) => maintenanceApi.completeMaintenance(input.id, input.actualCost, input.notes), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (input: { id: string; reason?: string }) => maintenanceApi.cancelMaintenance(input.id, input.reason), onSuccess: invalidate }),
  };
}

export function useMaintenanceScheduleMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["maintenance-schedules", companyId] });
  return {
    create: useMutation({ mutationFn: maintenanceApi.createMaintenanceSchedule, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof maintenanceApi.updateMaintenanceSchedule>[1] }) => maintenanceApi.updateMaintenanceSchedule(input.id, input.patch), onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------
export function useVehicles(companyId: string | undefined) {
  return useQuery({ queryKey: ["vehicles", companyId], queryFn: () => vehiclesApi.listVehicles(companyId!), enabled: !!companyId });
}

export function useVehicle(id: string | undefined) {
  return useQuery({ queryKey: ["vehicle", id], queryFn: () => vehiclesApi.getVehicle(id!), enabled: !!id });
}

export function useVehicleAssignments(vehicleId: string | undefined) {
  return useQuery({ queryKey: ["vehicle-assignments", vehicleId], queryFn: () => vehiclesApi.listVehicleAssignments(vehicleId!), enabled: !!vehicleId });
}

export function useVehicleMaintenance(vehicleId: string | undefined) {
  return useQuery({ queryKey: ["vehicle-maintenance", vehicleId], queryFn: () => vehiclesApi.listVehicleMaintenance(vehicleId!), enabled: !!vehicleId });
}

export function useVehicleMutations(companyId: string | undefined, vehicleId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vehicles", companyId] });
    queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["vehicle-assignments", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    create: useMutation({ mutationFn: vehiclesApi.createVehicle, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof vehiclesApi.updateVehicle>[1] }) => vehiclesApi.updateVehicle(input.id, input.patch), onSuccess: invalidate }),
    assign: useMutation({
      mutationFn: (input: { vehicleId: string; employeeId: string; departmentId?: string | null; notes?: string }) => vehiclesApi.assignVehicle(input.vehicleId, input.employeeId, input.departmentId, input.notes),
      onSuccess: invalidate,
    }),
    return: useMutation({ mutationFn: (input: { vehicleId: string; notes?: string }) => vehiclesApi.returnVehicle(input.vehicleId, input.notes), onSuccess: invalidate }),
    addMaintenance: useMutation({ mutationFn: vehiclesApi.addVehicleMaintenance, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicle-maintenance", vehicleId] }) }),
  };
}

// ---------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------
export function useTravelRequests(companyId: string | undefined) {
  return useQuery({ queryKey: ["travel-requests", companyId], queryFn: () => travelApi.listTravelRequests(companyId!), enabled: !!companyId });
}

export function useTravelRequest(id: string | undefined) {
  return useQuery({ queryKey: ["travel-request", id], queryFn: () => travelApi.getTravelRequest(id!), enabled: !!id });
}

export function useTravelDocuments(travelRequestId: string | undefined) {
  return useQuery({ queryKey: ["travel-documents", travelRequestId], queryFn: () => travelApi.listTravelDocuments(travelRequestId!), enabled: !!travelRequestId });
}

export function useTravelRequestMutations(companyId: string | undefined, travelRequestId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["travel-requests", companyId] });
    queryClient.invalidateQueries({ queryKey: ["travel-request", travelRequestId] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    create: useMutation({ mutationFn: travelApi.createTravelRequest, onSuccess: invalidate }),
    submit: useMutation({ mutationFn: travelApi.submitTravelRequest, onSuccess: invalidate }),
    advance: useMutation({ mutationFn: travelApi.advanceTravelRequest, onSuccess: invalidate }),
    reject: useMutation({ mutationFn: (input: { id: string; reason?: string }) => travelApi.rejectTravelRequest(input.id, input.reason), onSuccess: invalidate }),
    book: useMutation({ mutationFn: (input: { id: string; details: Parameters<typeof travelApi.bookTravelRequest>[1] }) => travelApi.bookTravelRequest(input.id, input.details), onSuccess: invalidate }),
    start: useMutation({ mutationFn: travelApi.startTravel, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: travelApi.completeTravel, onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: travelApi.cancelTravelRequest, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------
export function useVisitors(companyId: string | undefined, date?: string) {
  return useQuery({ queryKey: ["visitors", companyId, date], queryFn: () => visitorsApi.listVisitors(companyId!, date), enabled: !!companyId });
}

export function useVisitorMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["visitors", companyId] });
  return {
    create: useMutation({ mutationFn: visitorsApi.createVisitor, onSuccess: invalidate }),
    checkIn: useMutation({ mutationFn: (input: { id: string; badgeNumber?: string }) => visitorsApi.checkInVisitor(input.id, input.badgeNumber), onSuccess: invalidate }),
    checkOut: useMutation({ mutationFn: (input: { id: string; badgeStatus?: "RETURNED" | "LOST" }) => visitorsApi.checkOutVisitor(input.id, input.badgeStatus), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: visitorsApi.cancelVisitor, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------
export function useMeetings(companyId: string | undefined) {
  return useQuery({ queryKey: ["meetings", companyId], queryFn: () => meetingsApi.listMeetings(companyId!), enabled: !!companyId });
}

export function useMeeting(id: string | undefined) {
  return useQuery({ queryKey: ["meeting", id], queryFn: () => meetingsApi.getMeeting(id!), enabled: !!id });
}

export function useMeetingParticipants(meetingId: string | undefined) {
  return useQuery({ queryKey: ["meeting-participants", meetingId], queryFn: () => meetingsApi.listMeetingParticipants(meetingId!), enabled: !!meetingId });
}

export function useMeetingMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-room-bookings", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard", companyId] });
  };
  return {
    schedule: useMutation({ mutationFn: meetingsApi.scheduleMeeting, onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: meetingsApi.cancelMeeting, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: meetingsApi.completeMeeting, onSuccess: invalidate }),
    addParticipant: useMutation({
      mutationFn: (input: { companyId: string; meetingId: string; employeeId: string }) => meetingsApi.addMeetingParticipant(input.companyId, input.meetingId, input.employeeId),
      onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["meeting-participants", vars.meetingId] }),
    }),
  };
}

// ---------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------
export function useEvents(companyId: string | undefined) {
  return useQuery({ queryKey: ["events", companyId], queryFn: () => eventsApi.listEvents(companyId!), enabled: !!companyId });
}

export function useEvent(id: string | undefined) {
  return useQuery({ queryKey: ["event", id], queryFn: () => eventsApi.getEvent(id!), enabled: !!id });
}

export function useEventTasks(eventId: string | undefined) {
  return useQuery({ queryKey: ["event-tasks", eventId], queryFn: () => eventsApi.listEventTasks(eventId!), enabled: !!eventId });
}

export function useEventMutations(companyId: string | undefined, eventId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["events", companyId] });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
  };
  return {
    create: useMutation({ mutationFn: eventsApi.createEvent, onSuccess: invalidate }),
    updateStatus: useMutation({ mutationFn: (input: { id: string; status: string }) => eventsApi.updateEventStatus(input.id, input.status), onSuccess: invalidate }),
    createTask: useMutation({ mutationFn: eventsApi.createEventTask, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-tasks", eventId] }) }),
    updateTaskStatus: useMutation({
      mutationFn: (input: { id: string; status: string }) => eventsApi.updateEventTaskStatus(input.id, input.status),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-tasks", eventId] }),
    }),
  };
}

// ---------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------
export function useAdminContracts(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-contracts", companyId], queryFn: () => contractsApi.listAdminContracts(companyId!), enabled: !!companyId });
}

export function useAdminContract(id: string | undefined) {
  return useQuery({ queryKey: ["admin-contract", id], queryFn: () => contractsApi.getAdminContract(id!), enabled: !!id });
}

export function useAdminContractMutations(companyId: string | undefined, contractId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-contracts", companyId] });
    queryClient.invalidateQueries({ queryKey: ["admin-contract", contractId] });
  };
  return {
    create: useMutation({ mutationFn: contractsApi.createAdminContract, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof contractsApi.updateAdminContract>[1] }) => contractsApi.updateAdminContract(input.id, input.patch), onSuccess: invalidate }),
    activate: useMutation({ mutationFn: contractsApi.activateAdminContract, onSuccess: invalidate }),
    renew: useMutation({
      mutationFn: (input: { id: string; newStartDate: string; newEndDate: string; newValue?: number }) => contractsApi.renewAdminContract(input.id, input.newStartDate, input.newEndDate, input.newValue),
      onSuccess: invalidate,
    }),
    terminate: useMutation({ mutationFn: (input: { id: string; reason?: string }) => contractsApi.terminateAdminContract(input.id, input.reason), onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------
export function useAdminComplianceList(companyId: string | undefined) {
  return useQuery({ queryKey: ["admin-compliance", companyId], queryFn: () => complianceApi.listAdminCompliance(companyId!), enabled: !!companyId });
}

export function useAdminComplianceMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-compliance", companyId] });
  return {
    create: useMutation({ mutationFn: complianceApi.createAdminCompliance, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (input: { id: string; patch: Parameters<typeof complianceApi.updateAdminCompliance>[1] }) => complianceApi.updateAdminCompliance(input.id, input.patch), onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------
export function useAdminDocuments(companyId: string | undefined, resourceType?: string, resourceId?: string) {
  return useQuery({ queryKey: ["admin-documents", companyId, resourceType, resourceId], queryFn: () => documentsApi.listAdminDocuments(companyId!, resourceType, resourceId), enabled: !!companyId });
}

export function useAdminDocumentMutations(companyId: string | undefined, resourceType?: string, resourceId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-documents", companyId, resourceType, resourceId] });
  return {
    upload: useMutation({ mutationFn: documentsApi.uploadAdminDocument, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (input: { id: string; storagePath: string }) => documentsApi.deleteAdminDocument(input.id, input.storagePath), onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------
export function useAnnouncements(companyId: string | undefined) {
  return useQuery({ queryKey: ["announcements", companyId], queryFn: () => announcementsApi.listAnnouncements(companyId!), enabled: !!companyId });
}

export function useAnnouncementMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["announcements", companyId] });
  return {
    create: useMutation({ mutationFn: announcementsApi.createAnnouncement, onSuccess: invalidate }),
    publish: useMutation({ mutationFn: announcementsApi.publishAnnouncement, onSuccess: invalidate }),
    retract: useMutation({ mutationFn: announcementsApi.retractAnnouncement, onSuccess: invalidate }),
  };
}

// ---------------------------------------------------------------------
// Courier / Mail
// ---------------------------------------------------------------------
export function useCourierMail(companyId: string | undefined) {
  return useQuery({ queryKey: ["courier-mail", companyId], queryFn: () => courierApi.listCourierMail(companyId!), enabled: !!companyId });
}

export function useCourierMailMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["courier-mail", companyId] });
  return {
    create: useMutation({ mutationFn: courierApi.createCourierMail, onSuccess: invalidate }),
    updateStatus: useMutation({ mutationFn: (input: { id: string; status: string }) => courierApi.updateCourierMailStatus(input.id, input.status), onSuccess: invalidate }),
  };
}
