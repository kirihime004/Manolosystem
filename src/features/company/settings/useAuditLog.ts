import { useQuery } from "@tanstack/react-query";
import * as api from "@/features/company/settings/auditLogApi";
import type { AuditLogFilters } from "@/features/company/settings/auditLogApi";

export function useAuditLog(companyId: string | undefined, filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-log", companyId, filters],
    queryFn: () => api.listAuditLogs(companyId!, filters),
    enabled: !!companyId,
  });
}

export function useAuditLogResourceTypes(companyId: string | undefined) {
  return useQuery({
    queryKey: ["audit-log-resource-types", companyId],
    queryFn: () => api.listAuditLogResourceTypes(companyId!),
    enabled: !!companyId,
  });
}
