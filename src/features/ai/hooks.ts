import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as aiApi from "@/features/ai/aiApi";

export function useConversations(companyId: string | undefined) {
  return useQuery({ queryKey: ["ai-conversations", companyId], queryFn: () => aiApi.listConversations(companyId!), enabled: !!companyId });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({ queryKey: ["ai-messages", conversationId], queryFn: () => aiApi.listMessages(conversationId!), enabled: !!conversationId });
}

export function useCompanyAiContext(companyId: string | undefined) {
  return useQuery({ queryKey: ["ai-company-context", companyId], queryFn: () => aiApi.getCompanyAiContext(companyId!), enabled: !!companyId });
}

export function useAiCompanySettings(companyId: string | undefined) {
  return useQuery({ queryKey: ["ai-company-settings", companyId], queryFn: () => aiApi.getAiCompanySettings(companyId!), enabled: !!companyId });
}

export function useConversationMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["ai-conversations", companyId] });

  const create = useMutation({
    mutationFn: (userId: string) => aiApi.createConversation(companyId!, userId),
    onSuccess: invalidateList,
  });
  const rename = useMutation({
    mutationFn: (input: { id: string; title: string }) => aiApi.renameConversation(input.id, input.title),
    onSuccess: invalidateList,
  });
  const remove = useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: invalidateList,
  });

  return { create, rename, remove };
}

export function useSendMessage(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId: string; message: string }) => aiApi.sendMessage({ companyId: input.companyId, conversationId: conversationId!, message: input.message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });
}

export function useAiCompanySettingsMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof aiApi.upsertAiCompanySettings>[1]) => aiApi.upsertAiCompanySettings(companyId!, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-company-settings", companyId] }),
  });
  return { update };
}

export function useOpenAlerts(companyId: string | undefined) {
  return useQuery({ queryKey: ["ai-alerts", companyId], queryFn: () => aiApi.listOpenAlerts(companyId!), enabled: !!companyId });
}

export function useAlertMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ai-alerts", companyId] });
  const scan = useMutation({ mutationFn: () => aiApi.scanForAlerts(companyId!), onSuccess: invalidate });
  const acknowledge = useMutation({ mutationFn: (input: { id: string; userId: string }) => aiApi.acknowledgeAlert(input.id, input.userId), onSuccess: invalidate });
  const resolve = useMutation({ mutationFn: (input: { id: string; userId: string }) => aiApi.resolveAlert(input.id, input.userId), onSuccess: invalidate });
  return { scan, acknowledge, resolve };
}

export function useAiUsageSummary(companyId: string | undefined, days = 30) {
  return useQuery({ queryKey: ["ai-usage-summary", companyId, days], queryFn: () => aiApi.getAiUsageSummary(companyId!, days), enabled: !!companyId });
}

export function useCaptureDailySnapshot() {
  return useMutation({ mutationFn: (companyId: string) => aiApi.captureDailySnapshot(companyId) });
}

export function useSnapshotHistory(companyId: string | undefined, days = 30) {
  return useQuery({ queryKey: ["ai-snapshots", companyId, days], queryFn: () => aiApi.listSnapshots(companyId!, days), enabled: !!companyId });
}

export function useMetricForecast(companyId: string | undefined, module: string, metric: string) {
  return useQuery({ queryKey: ["ai-forecast", companyId, module, metric], queryFn: () => aiApi.getMetricForecast(companyId!, module, metric), enabled: !!companyId });
}
