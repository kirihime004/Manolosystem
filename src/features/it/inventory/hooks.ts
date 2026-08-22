import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/features/it/inventory/inventoryApi";
import * as credentialsApi from "@/features/it/inventory/credentialsApi";
import * as ipApi from "@/features/it/inventory/ipApi";
import * as notificationsApi from "@/features/it/inventory/notificationsApi";

export function useInventoryDashboardStats(companyId: string | undefined) {
  return useQuery({
    queryKey: ["inventory-dashboard-stats", companyId],
    queryFn: () => api.getInventoryDashboardStats(companyId!),
    enabled: !!companyId,
  });
}

export function useAssets(companyId: string | undefined, filters: api.AssetFilters) {
  return useQuery({
    queryKey: ["assets", companyId, filters],
    queryFn: () => api.listAssets(companyId!, filters),
    enabled: !!companyId,
  });
}

export function useAsset(companyId: string | undefined, assetCode: string | undefined) {
  return useQuery({
    queryKey: ["asset", companyId, assetCode],
    queryFn: () => api.getAssetByCode(companyId!, assetCode!),
    enabled: !!companyId && !!assetCode,
  });
}

export function useSuppliers(companyId: string | undefined) {
  return useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: () => api.listSuppliers(companyId!),
    enabled: !!companyId,
  });
}

export function useAssetMutations(assetCode?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-dashboard-stats"] });
    if (assetCode) queryClient.invalidateQueries({ queryKey: ["asset", undefined, assetCode] });
    queryClient.invalidateQueries({ queryKey: ["asset"] });
  };

  const create = useMutation({ mutationFn: api.createAsset, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { assetId: string; patch: Partial<api.CreateAssetInput> }) => api.updateAsset(input.assetId, input.patch),
    onSuccess: invalidate,
  });
  const reassign = useMutation({ mutationFn: api.reassignAsset, onSuccess: invalidate });
  const updateStatus = useMutation({
    mutationFn: (input: { assetId: string; status: string }) => api.updateAssetStatus(input.assetId, input.status),
    onSuccess: invalidate,
  });
  const markDefective = useMutation({ mutationFn: api.markAssetDefective, onSuccess: invalidate });

  return { create, update, reassign, updateStatus, markDefective };
}

export function useRepairs(companyId: string | undefined) {
  return useQuery({
    queryKey: ["repairs", companyId],
    queryFn: () => api.listRepairs(companyId!),
    enabled: !!companyId,
  });
}

export function useRepairMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["repairs"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["asset"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-dashboard-stats"] });
  };
  const create = useMutation({ mutationFn: api.createRepair, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { repairId: string; patch: Parameters<typeof api.updateRepair>[1] }) => api.updateRepair(input.repairId, input.patch),
    onSuccess: invalidate,
  });
  return { create, update };
}

export function useDisposals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["disposals", companyId],
    queryFn: () => api.listDisposals(companyId!),
    enabled: !!companyId,
  });
}

export function useDisposalMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["disposals"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["asset"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-dashboard-stats"] });
  };
  const create = useMutation({ mutationFn: api.createDisposal, onSuccess: invalidate });
  return { create };
}

export function useAssetHistory(companyId: string | undefined) {
  return useQuery({
    queryKey: ["asset-history-feed", companyId],
    queryFn: () => api.listAssetHistory(companyId!),
    enabled: !!companyId,
  });
}

// ---------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------
export function useCredentials(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["credentials", companyId, search],
    queryFn: () => credentialsApi.listCredentials(companyId!, search),
    enabled: !!companyId,
  });
}

export function useCredentialMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["credentials"] });

  const create = useMutation({ mutationFn: credentialsApi.createCredential, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof credentialsApi.updateCredential>[1] }) =>
      credentialsApi.updateCredential(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: credentialsApi.deleteCredential, onSuccess: invalidate });
  const setSecret = useMutation({ mutationFn: credentialsApi.setCredentialSecret });
  const reveal = useMutation({ mutationFn: credentialsApi.revealCredential });

  return { create, update, remove, setSecret, reveal };
}

// ---------------------------------------------------------------------
// IP addresses
// ---------------------------------------------------------------------
export function useIpStats(companyId: string | undefined) {
  return useQuery({
    queryKey: ["ip-stats", companyId],
    queryFn: () => ipApi.getIpStats(companyId!),
    enabled: !!companyId,
  });
}

export function useIpAddresses(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["ip-addresses", companyId, search],
    queryFn: () => ipApi.listIpAddresses(companyId!, search),
    enabled: !!companyId,
  });
}

export function useIpMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ip-addresses"] });
    queryClient.invalidateQueries({ queryKey: ["ip-stats"] });
  };
  const create = useMutation({ mutationFn: ipApi.createIpAddress, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof ipApi.updateIpAddress>[1] }) => ipApi.updateIpAddress(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: ipApi.deleteIpAddress, onSuccess: invalidate });
  return { create, update, remove };
}

export function useAgentTokens(companyId: string | undefined) {
  return useQuery({
    queryKey: ["agent-tokens", companyId],
    queryFn: () => ipApi.listAgentTokens(companyId!),
    enabled: !!companyId,
  });
}

export function useAgentTokenMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["agent-tokens", companyId] });
  const create = useMutation({
    mutationFn: (name: string) => ipApi.createAgentToken(companyId!, name),
    onSuccess: invalidate,
  });
  const revoke = useMutation({ mutationFn: ipApi.revokeAgentToken, onSuccess: invalidate });
  return { create, revoke };
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------
export function useInventoryNotifications(companyId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", companyId],
    queryFn: () => notificationsApi.listNotifications(companyId!),
    enabled: !!companyId,
  });
}

export function useUnreadNotificationCount(companyId: string | undefined) {
  return useQuery({
    queryKey: ["notifications-unread-count", companyId],
    queryFn: () => notificationsApi.getUnreadCount(companyId!),
    enabled: !!companyId,
  });
}

export function useNotificationMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", companyId] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", companyId] });
  };
  const markRead = useMutation({ mutationFn: notificationsApi.markNotificationRead, onSuccess: invalidate });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsRead(companyId!),
    onSuccess: invalidate,
  });
  return { markRead, markAllRead };
}
