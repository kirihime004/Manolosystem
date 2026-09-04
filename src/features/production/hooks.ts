import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as projectsApi from "@/features/production/productionProjectsApi";
import * as shotsApi from "@/features/production/productionShotsApi";
import * as assetsApi from "@/features/production/productionAssetsApi";
import * as tasksApi from "@/features/production/productionTasksApi";
import * as scheduleApi from "@/features/production/productionScheduleApi";
import * as versionsApi from "@/features/production/productionVersionsApi";
import * as deliverablesApi from "@/features/production/productionDeliverablesApi";
import * as settingsApi from "@/features/production/productionSettingsApi";
import * as dashboardApi from "@/features/production/productionDashboardApi";
import * as clientPortalApi from "@/features/production/productionClientPortalApi";
import * as rateCardsApi from "@/features/production/productionRateCardsApi";

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export function useProductionDashboardSummary(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-dashboard", companyId], queryFn: () => dashboardApi.getProductionDashboardSummary(companyId!), enabled: !!companyId });
}

export function useProductionHistory(resourceType: string, resourceId: string | undefined) {
  return useQuery({ queryKey: ["production-history", resourceType, resourceId], queryFn: () => dashboardApi.listHistory(resourceType, resourceId!), enabled: !!resourceId });
}

export function useProjectInsights(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-project-insights", projectId], queryFn: () => dashboardApi.getProjectInsights(projectId!), enabled: !!projectId });
}

export function useProductionInsightsSummary(companyId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["production-insights", companyId, startDate, endDate],
    queryFn: () => dashboardApi.getProductionInsightsSummary(companyId!, startDate, endDate),
    enabled: !!companyId,
  });
}

// ---------------------------------------------------------------------
// Settings + Projects
// ---------------------------------------------------------------------
export function useProductionSettings(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-settings", companyId], queryFn: () => projectsApi.getProductionSettings(companyId!), enabled: !!companyId });
}

export function useProjects(companyId: string | undefined, status?: string) {
  return useQuery({ queryKey: ["production-projects", companyId, status], queryFn: () => projectsApi.listProjects(companyId!, status), enabled: !!companyId });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: ["production-project", id], queryFn: () => projectsApi.getProject(id!), enabled: !!id });
}

export function useProjectMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-projects", companyId] });
  const create = useMutation({ mutationFn: projectsApi.createProject, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof projectsApi.updateProject>[1] }) => projectsApi.updateProject(input.id, input.patch),
    onSuccess: (_data, vars) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["production-project", vars.id] });
    },
  });
  const remove = useMutation({ mutationFn: projectsApi.deleteProject, onSuccess: invalidate });
  return { create, update, remove };
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-project-members", projectId], queryFn: () => projectsApi.listProjectMembers(projectId!), enabled: !!projectId });
}

export function useProjectMemberMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-project-members", projectId] });
  const add = useMutation({ mutationFn: projectsApi.addProjectMember, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: projectsApi.removeProjectMember, onSuccess: invalidate });
  return { add, remove };
}

export function useShows(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-shows", projectId], queryFn: () => projectsApi.listShows(projectId!), enabled: !!projectId });
}

export function useEpisodes(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-episodes", projectId], queryFn: () => projectsApi.listEpisodes(projectId!), enabled: !!projectId });
}

export function useSequences(projectId: string | undefined, episodeId?: string | null) {
  return useQuery({ queryKey: ["production-sequences", projectId, episodeId], queryFn: () => projectsApi.listSequences(projectId!, episodeId), enabled: !!projectId });
}

export function useHierarchyMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-shows", projectId] });
    queryClient.invalidateQueries({ queryKey: ["production-episodes", projectId] });
    queryClient.invalidateQueries({ queryKey: ["production-sequences", projectId] });
  };
  const createShow = useMutation({ mutationFn: projectsApi.createShow, onSuccess: invalidate });
  const updateShow = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof projectsApi.updateShow>[1] }) => projectsApi.updateShow(input.id, input.patch),
    onSuccess: invalidate,
  });
  const deleteShow = useMutation({ mutationFn: projectsApi.deleteShow, onSuccess: invalidate });

  const createEpisode = useMutation({ mutationFn: projectsApi.createEpisode, onSuccess: invalidate });
  const updateEpisode = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof projectsApi.updateEpisode>[1] }) => projectsApi.updateEpisode(input.id, input.patch),
    onSuccess: invalidate,
  });
  const deleteEpisode = useMutation({ mutationFn: projectsApi.deleteEpisode, onSuccess: invalidate });

  const createSequence = useMutation({ mutationFn: projectsApi.createSequence, onSuccess: invalidate });
  const updateSequence = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof projectsApi.updateSequence>[1] }) => projectsApi.updateSequence(input.id, input.patch),
    onSuccess: invalidate,
  });
  const deleteSequence = useMutation({ mutationFn: projectsApi.deleteSequence, onSuccess: invalidate });

  return {
    createShow, updateShow, deleteShow,
    createEpisode, updateEpisode, deleteEpisode,
    createSequence, updateSequence, deleteSequence,
  };
}

export function useProjectTemplates(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-project-templates", companyId], queryFn: () => projectsApi.listProjectTemplates(companyId!), enabled: !!companyId });
}

export function useProjectTemplateMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: projectsApi.createProjectTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production-project-templates", companyId] }),
  });
  const apply = useMutation({
    mutationFn: (input: { projectId: string; templateId: string }) => projectsApi.applyProjectTemplate(input.projectId, input.templateId),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["production-milestones", vars.projectId] }),
  });
  return { create, apply };
}

export function useProductionBudgetSummary(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-budget-summary", projectId], queryFn: () => projectsApi.getProductionBudgetSummary(projectId!), enabled: !!projectId });
}

// ---------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------
export function useShots(projectId: string | undefined, sequenceId?: string) {
  return useQuery({ queryKey: ["production-shots", projectId, sequenceId], queryFn: () => shotsApi.listShots(projectId!, sequenceId), enabled: !!projectId });
}

export function useShot(id: string | undefined) {
  return useQuery({ queryKey: ["production-shot", id], queryFn: () => shotsApi.getShot(id!), enabled: !!id });
}

export function useShotFullCode(id: string | undefined) {
  return useQuery({ queryKey: ["production-shot-full-code", id], queryFn: () => shotsApi.getShotFullCode(id!), enabled: !!id });
}

export function useShotMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-shots", projectId] });
  const create = useMutation({ mutationFn: shotsApi.createShot, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof shotsApi.updateShot>[1] }) => shotsApi.updateShot(input.id, input.patch),
    onSuccess: (_d, vars) => { invalidate(); queryClient.invalidateQueries({ queryKey: ["production-shot", vars.id] }); },
  });
  const remove = useMutation({ mutationFn: shotsApi.deleteShot, onSuccess: invalidate });
  return { create, update, remove };
}

// ---------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------
export function useAssets(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-assets", projectId], queryFn: () => assetsApi.listAssets(projectId!), enabled: !!projectId });
}

export function useAsset(id: string | undefined) {
  return useQuery({ queryKey: ["production-asset", id], queryFn: () => assetsApi.getAsset(id!), enabled: !!id });
}

export function useAssetMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-assets", projectId] });
  const create = useMutation({ mutationFn: assetsApi.createAsset, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof assetsApi.updateAsset>[1] }) => assetsApi.updateAsset(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: assetsApi.deleteAsset, onSuccess: invalidate });
  return { create, update, remove };
}

// ---------------------------------------------------------------------
// Task types + Tasks + Dependencies + Workload
// ---------------------------------------------------------------------
export function useTaskTypes(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-task-types", companyId], queryFn: () => tasksApi.listTaskTypes(companyId!), enabled: !!companyId });
}

export function useTaskTypeMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-task-types", companyId] });
  const create = useMutation({ mutationFn: tasksApi.createTaskType, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof tasksApi.updateTaskType>[1] }) => tasksApi.updateTaskType(input.id, input.patch),
    onSuccess: invalidate,
  });
  return { create, update };
}

export function useTasks(companyId: string | undefined, filters: Parameters<typeof tasksApi.listTasks>[1] = {}) {
  return useQuery({ queryKey: ["production-tasks", companyId, filters], queryFn: () => tasksApi.listTasks(companyId!, filters), enabled: !!companyId });
}

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: ["production-task", id], queryFn: () => tasksApi.getTask(id!), enabled: !!id });
}

export function useTaskMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-tasks", companyId] });
  const create = useMutation({ mutationFn: tasksApi.createTask, onSuccess: invalidate });
  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) => tasksApi.updateTaskStatus(input.id, input.status),
    onSuccess: (_d, vars) => { invalidate(); queryClient.invalidateQueries({ queryKey: ["production-task", vars.id] }); },
  });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof tasksApi.updateTask>[1] }) => tasksApi.updateTask(input.id, input.patch),
    onSuccess: (_d, vars) => { invalidate(); queryClient.invalidateQueries({ queryKey: ["production-task", vars.id] }); },
  });
  const remove = useMutation({ mutationFn: tasksApi.deleteTask, onSuccess: invalidate });
  return { create, updateStatus, update, remove };
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({ queryKey: ["production-task-dependencies", taskId], queryFn: () => tasksApi.listTaskDependencies(taskId!), enabled: !!taskId });
}

export function useTaskDependencyMutations(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-task-dependencies", taskId] });
  const add = useMutation({ mutationFn: tasksApi.addTaskDependency, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: tasksApi.removeTaskDependency, onSuccess: invalidate });
  return { add, remove };
}

export function useProductionWorkload(companyId: string | undefined, onDate?: string) {
  return useQuery({ queryKey: ["production-workload", companyId, onDate], queryFn: () => tasksApi.getProductionWorkload(companyId!, onDate), enabled: !!companyId });
}

// ---------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------
export function useMilestones(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-milestones", projectId], queryFn: () => scheduleApi.listMilestones(projectId!), enabled: !!projectId });
}

export function useAllMilestones(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-all-milestones", companyId], queryFn: () => scheduleApi.listAllMilestones(companyId!), enabled: !!companyId });
}

export function useMilestoneMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-milestones", projectId] });
    queryClient.invalidateQueries({ queryKey: ["production-all-milestones"] });
  };
  const create = useMutation({ mutationFn: scheduleApi.createMilestone, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof scheduleApi.updateMilestone>[1] }) => scheduleApi.updateMilestone(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: scheduleApi.deleteMilestone, onSuccess: invalidate });
  return { create, update, remove };
}

// ---------------------------------------------------------------------
// Versions + Reviews + Notes
// ---------------------------------------------------------------------
export function useVersions(filters: Parameters<typeof versionsApi.listVersions>[0]) {
  const key = filters.shotId ?? filters.assetId ?? filters.taskId;
  return useQuery({ queryKey: ["production-versions", key], queryFn: () => versionsApi.listVersions(filters), enabled: !!key });
}

export function usePendingReviewVersions(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-pending-versions", companyId], queryFn: () => versionsApi.listPendingReviewVersions(companyId!), enabled: !!companyId });
}

export function useVersionMutations(scopeKey: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-versions", scopeKey] });
    queryClient.invalidateQueries({ queryKey: ["production-pending-versions"] });
  };
  const create = useMutation({ mutationFn: versionsApi.createVersion, onSuccess: invalidate });
  const setClientVisible = useMutation({
    mutationFn: (input: { id: string; clientVisible: boolean }) => versionsApi.setVersionClientVisible(input.id, input.clientVisible),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: versionsApi.deleteVersion, onSuccess: invalidate });
  return { create, setClientVisible, remove };
}

export function useReviews(versionId: string | undefined) {
  return useQuery({ queryKey: ["production-reviews", versionId], queryFn: () => versionsApi.listReviews(versionId!), enabled: !!versionId });
}

export function useReviewMutations(versionId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-reviews", versionId] });
    queryClient.invalidateQueries({ queryKey: ["production-pending-versions"] });
    queryClient.invalidateQueries({ queryKey: ["production-versions"] });
    // A decision can flip the shot's or asset's own status as a trigger
    // side effect (apply_production_review_decision()) -- without this,
    // whichever detail page is open keeps showing the pre-decision status
    // until a manual reload.
    queryClient.invalidateQueries({ queryKey: ["production-shot"] });
    queryClient.invalidateQueries({ queryKey: ["production-shots"] });
    queryClient.invalidateQueries({ queryKey: ["production-asset"] });
    queryClient.invalidateQueries({ queryKey: ["production-assets"] });
  };
  const request = useMutation({ mutationFn: versionsApi.requestReview, onSuccess: invalidate });
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; comment?: string | null }) => versionsApi.decideReview(input.id, input.decision, input.comment),
    onSuccess: invalidate,
  });
  return { request, decide };
}

export function useNotes(resourceType: string, resourceId: string | undefined) {
  return useQuery({ queryKey: ["production-notes", resourceType, resourceId], queryFn: () => versionsApi.listNotes(resourceType, resourceId!), enabled: !!resourceId });
}

export function useNoteMutations(resourceType: string, resourceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-notes", resourceType, resourceId] });
  const create = useMutation({ mutationFn: versionsApi.createNote, onSuccess: invalidate });
  const resolve = useMutation({
    mutationFn: (input: { id: string; resolvedBy: string }) => versionsApi.resolveNote(input.id, input.resolvedBy),
    onSuccess: invalidate,
  });
  return { create, resolve };
}

// ---------------------------------------------------------------------
// Deliverables + Files
// ---------------------------------------------------------------------
export function useDeliverables(projectId: string | undefined) {
  return useQuery({ queryKey: ["production-deliverables", projectId], queryFn: () => deliverablesApi.listDeliverables(projectId!), enabled: !!projectId });
}

export function useAllDeliverables(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-all-deliverables", companyId], queryFn: () => deliverablesApi.listAllDeliverables(companyId!), enabled: !!companyId });
}

export function useDeliverableMutations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-deliverables", projectId] });
    queryClient.invalidateQueries({ queryKey: ["production-all-deliverables"] });
  };
  const create = useMutation({ mutationFn: deliverablesApi.createDeliverable, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof deliverablesApi.updateDeliverable>[1] }) => deliverablesApi.updateDeliverable(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deliverablesApi.deleteDeliverable, onSuccess: invalidate });
  return { create, update, remove };
}

export function useProductionFiles(resourceType: string, resourceId: string | undefined) {
  return useQuery({ queryKey: ["production-files", resourceType, resourceId], queryFn: () => deliverablesApi.listFiles(resourceType, resourceId!), enabled: !!resourceId });
}

export function useProductionFileMutations(resourceType: string, resourceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-files", resourceType, resourceId] });
  const upload = useMutation({ mutationFn: deliverablesApi.uploadProductionFile, onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (input: { id: string; storagePath: string }) => deliverablesApi.deleteProductionFile(input.id, input.storagePath),
    onSuccess: invalidate,
  });
  return { upload, remove };
}

// ---------------------------------------------------------------------
// Custom fields + Workflow templates + Client access
// ---------------------------------------------------------------------
export function useCustomFields(companyId: string | undefined, entityType?: string) {
  return useQuery({ queryKey: ["production-custom-fields", companyId, entityType], queryFn: () => settingsApi.listCustomFields(companyId!, entityType), enabled: !!companyId });
}

export function useCustomFieldMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-custom-fields", companyId] });
  const create = useMutation({ mutationFn: settingsApi.createCustomField, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: settingsApi.deactivateCustomField, onSuccess: invalidate });
  return { create, deactivate };
}

export function useCustomFieldValues(entityType: string, entityId: string | undefined) {
  return useQuery({ queryKey: ["production-custom-field-values", entityType, entityId], queryFn: () => settingsApi.listCustomFieldValues(entityType, entityId!), enabled: !!entityId });
}

export function useCustomFieldValueMutations(entityType: string, entityId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-custom-field-values", entityType, entityId] });
  const set = useMutation({ mutationFn: settingsApi.setCustomFieldValue, onSuccess: invalidate });
  return { set };
}

export function useWorkflowTemplates(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-workflow-templates", companyId], queryFn: () => settingsApi.listWorkflowTemplates(companyId!), enabled: !!companyId });
}

export function useWorkflowStages(templateId: string | undefined) {
  return useQuery({ queryKey: ["production-workflow-stages", templateId], queryFn: () => settingsApi.listWorkflowStages(templateId!), enabled: !!templateId });
}

export function useWorkflowMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const createTemplate = useMutation({
    mutationFn: settingsApi.createWorkflowTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["production-workflow-templates", companyId] }),
  });
  const addStage = useMutation({
    mutationFn: settingsApi.addWorkflowStage,
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["production-workflow-stages", vars.workflowTemplateId] }),
  });
  const deleteStage = useMutation({
    mutationFn: (vars: { id: string; workflowTemplateId: string }) => settingsApi.deleteWorkflowStage(vars.id),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["production-workflow-stages", vars.workflowTemplateId] }),
  });
  return { createTemplate, addStage, deleteStage };
}

// A project's task status options come from its chosen TASK workflow
// template's stages when one is set (each stage becomes one option,
// labeled by the stage's own name but writing its mapped status), or from
// `fallback` otherwise -- this is how a project can adopt a custom pipeline
// without changing what an unconfigured project sees.
export function useProjectTaskStatusOptions(
  project: { task_workflow_template_id: string | null } | undefined,
  fallback: { status: string; label: string }[],
): { status: string; label: string }[] {
  const templateId = project?.task_workflow_template_id ?? undefined;
  const { data: stages } = useWorkflowStages(templateId);
  if (!templateId) return fallback;
  if (!stages) return fallback;
  const seen = new Set<string>();
  const options: { status: string; label: string }[] = [];
  for (const s of [...stages].sort((a, b) => a.sort_order - b.sort_order)) {
    if (seen.has(s.maps_to_status)) continue;
    seen.add(s.maps_to_status);
    options.push({ status: s.maps_to_status, label: s.name });
  }
  return options.length > 0 ? options : fallback;
}

export function useClientUsers(companyId: string | undefined, customerId?: string) {
  return useQuery({ queryKey: ["production-client-users", companyId, customerId], queryFn: () => settingsApi.listClientUsers(companyId!, customerId), enabled: !!companyId });
}

export function useClientUserMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-client-users", companyId] });
  const link = useMutation({ mutationFn: dashboardApi.linkClientUser, onSuccess: invalidate });
  const setActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => settingsApi.setClientUserActive(input.id, input.isActive),
    onSuccess: invalidate,
  });
  return { link, setActive };
}

// ---------------------------------------------------------------------
// Client Portal (unauthenticated-to-staff, authenticated-as-client)
// ---------------------------------------------------------------------
export function useMyClientProfile() {
  return useQuery({ queryKey: ["my-client-profile"], queryFn: clientPortalApi.getMyClientProfile });
}

export function useMyClientProjects() {
  return useQuery({ queryKey: ["my-client-projects"], queryFn: clientPortalApi.listMyProjects });
}

export function useMyClientProjectShots(projectId: string | undefined) {
  return useQuery({ queryKey: ["my-client-project-shots", projectId], queryFn: () => clientPortalApi.listMyProjectShots(projectId!), enabled: !!projectId });
}

export function useMyClientShotVersions(shotId: string | undefined) {
  return useQuery({ queryKey: ["my-client-shot-versions", shotId], queryFn: () => clientPortalApi.listMyShotVersions(shotId!), enabled: !!shotId });
}

export function useMyClientDeliverables(projectId: string | undefined) {
  return useQuery({ queryKey: ["my-client-deliverables", projectId], queryFn: () => clientPortalApi.listMyDeliverables(projectId!), enabled: !!projectId });
}

// ---------------------------------------------------------------------
// Production Rate Card + Approved Work Payment System
// ---------------------------------------------------------------------
export function useProductionUnits(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-units", companyId], queryFn: () => rateCardsApi.listProductionUnits(companyId!), enabled: !!companyId });
}

export function useProductionUnitMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-units", companyId] });
  const create = useMutation({ mutationFn: rateCardsApi.createProductionUnit, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof rateCardsApi.updateProductionUnit>[1] }) => rateCardsApi.updateProductionUnit(input.id, input.patch),
    onSuccess: invalidate,
  });
  return { create, update };
}

export function useRateCards(companyId: string | undefined) {
  return useQuery({ queryKey: ["production-rate-cards", companyId], queryFn: () => rateCardsApi.listRateCards(companyId!), enabled: !!companyId });
}

export function useRateCardMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["production-rate-cards", companyId] });
  const create = useMutation({ mutationFn: rateCardsApi.createRateCard, onSuccess: invalidate });
  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: "DRAFT" | "ACTIVE" | "INACTIVE" }) => rateCardsApi.updateRateCardStatus(input.id, input.status),
    onSuccess: invalidate,
  });
  const duplicateAsNewVersion = useMutation({ mutationFn: rateCardsApi.duplicateRateCardAsNewVersion, onSuccess: invalidate });
  return { create, setStatus, duplicateAsNewVersion };
}

// Task pricing lives on production_tasks itself -- useTask/useTaskMutations
// (above) already cover reads/edits. This adds the two RPC-backed actions.
export function useTaskPricingMutations(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["production-task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
  };
  const setConfig = useMutation({
    mutationFn: (input: { productionUnitId: string | null }) => rateCardsApi.setTaskPricingConfig(taskId!, input),
    onSuccess: invalidate,
  });
  const recalculate = useMutation({
    mutationFn: (input: { manualQuantity?: number | null; overrideReason?: string | null } = {}) =>
      rateCardsApi.recalculateTaskPricing(taskId!, input.manualQuantity, input.overrideReason),
    onSuccess: invalidate,
  });
  const submit = useMutation({
    mutationFn: (input: { quantityOverride?: number | null; overrideReason?: string | null } = {}) =>
      rateCardsApi.submitProductionWork(taskId!, input.quantityOverride, input.overrideReason),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["production-my-work-earnings"] });
      queryClient.invalidateQueries({ queryKey: ["production-all-work-earnings"] });
    },
  });
  return { setConfig, recalculate, submit };
}

export function useMyWorkEarnings(companyId: string | undefined, employeeId: string | undefined) {
  return useQuery({
    queryKey: ["production-my-work-earnings", companyId, employeeId],
    queryFn: () => rateCardsApi.listMyWorkEarnings(companyId!, employeeId!),
    enabled: !!companyId && !!employeeId,
  });
}

export function useAllWorkEarnings(companyId: string | undefined, status?: string | string[]) {
  return useQuery({
    queryKey: ["production-all-work-earnings", companyId, status],
    queryFn: () => rateCardsApi.listAllWorkEarnings(companyId!, status),
    enabled: !!companyId,
  });
}

export function useWorkEarning(id: string | undefined) {
  return useQuery({ queryKey: ["production-work-earning", id], queryFn: () => rateCardsApi.getWorkEarning(id!), enabled: !!id });
}

export function usePendingWorkApprovals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["production-pending-work-approvals", companyId],
    queryFn: () => rateCardsApi.listPendingWorkApprovals(companyId!),
    enabled: !!companyId,
  });
}

export function useWorkApprovals(workEarningId: string | undefined) {
  return useQuery({ queryKey: ["production-work-approvals", workEarningId], queryFn: () => rateCardsApi.listWorkApprovals(workEarningId!), enabled: !!workEarningId });
}

export function useWorkAdjustments(workEarningId: string | undefined) {
  return useQuery({ queryKey: ["production-work-adjustments", workEarningId], queryFn: () => rateCardsApi.listWorkAdjustments(workEarningId!), enabled: !!workEarningId });
}

export function useProductionWorkMutations(_companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["production-my-work-earnings"] });
    queryClient.invalidateQueries({ queryKey: ["production-all-work-earnings"] });
    queryClient.invalidateQueries({ queryKey: ["production-pending-work-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["production-work-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["production-work-earning"] });
  };
  const decide = useMutation({ mutationFn: rateCardsApi.decideProductionWork, onSuccess: invalidateAll });
  const sendToFinance = useMutation({ mutationFn: rateCardsApi.sendProductionWorkToFinance, onSuccess: invalidateAll });
  const createAdjustment = useMutation({
    mutationFn: rateCardsApi.createProductionWorkAdjustment,
    onSuccess: (_d, vars) => { invalidateAll(); queryClient.invalidateQueries({ queryKey: ["production-work-adjustments", vars.workEarningId] }); },
  });
  return { decide, sendToFinance, createAdjustment };
}

export function useAddProductionEarningsToPayrollItem(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { payrollItemId: string; workEarningIds: string[]; payrollRunId: string }) =>
      rateCardsApi.addProductionEarningsToPayrollItem(input.payrollItemId, input.workEarningIds),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["finance-payroll-run", vars.payrollRunId] });
      queryClient.invalidateQueries({ queryKey: ["finance-payroll-items", vars.payrollRunId] });
      queryClient.invalidateQueries({ queryKey: ["production-all-work-earnings", companyId] });
    },
  });
}
