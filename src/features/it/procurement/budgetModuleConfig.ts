import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/keys";
import type { BudgetModuleKey } from "@/types/database";

// One shared Budget engine, five department-filtered views -- this config
// is the only place that knows which permission/route/label belongs to
// which department, so the actual pages (BudgetDashboardPage,
// BudgetsListPage, BudgetDetailPage) stay a single generalized
// implementation instead of five near-duplicates.
export interface BudgetModuleConfig {
  label: string;
  basePath: string; // e.g. "it/budget" -- routes live at /c/:slug/<basePath>/...
  viewPermission: PermissionKey;
  createPermission: PermissionKey;
  updatePermission: PermissionKey;
  deletePermission: PermissionKey;
}

export const BUDGET_MODULE_CONFIG: Record<BudgetModuleKey, BudgetModuleConfig> = {
  IT: {
    label: "IT",
    basePath: "it/budget",
    viewPermission: PERMISSIONS.IT_BUDGET_VIEW,
    createPermission: PERMISSIONS.IT_BUDGET_CREATE,
    updatePermission: PERMISSIONS.IT_BUDGET_UPDATE,
    deletePermission: PERMISSIONS.IT_BUDGET_DELETE,
  },
  HR: {
    label: "HR",
    basePath: "hr/budget",
    viewPermission: PERMISSIONS.HR_BUDGET_VIEW,
    createPermission: PERMISSIONS.HR_BUDGET_CREATE,
    updatePermission: PERMISSIONS.HR_BUDGET_UPDATE,
    deletePermission: PERMISSIONS.HR_BUDGET_DELETE,
  },
  FINANCE: {
    label: "Finance",
    basePath: "finance/budget",
    viewPermission: PERMISSIONS.FINANCE_BUDGET_VIEW,
    createPermission: PERMISSIONS.FINANCE_BUDGET_CREATE,
    updatePermission: PERMISSIONS.FINANCE_BUDGET_UPDATE,
    deletePermission: PERMISSIONS.FINANCE_BUDGET_DELETE,
  },
  ADMIN: {
    label: "Administration",
    basePath: "admin/budget",
    viewPermission: PERMISSIONS.ADMIN_BUDGET_VIEW,
    createPermission: PERMISSIONS.ADMIN_BUDGET_CREATE,
    updatePermission: PERMISSIONS.ADMIN_BUDGET_UPDATE,
    deletePermission: PERMISSIONS.ADMIN_BUDGET_DELETE,
  },
  PRODUCTION: {
    label: "Production",
    basePath: "production/budget",
    viewPermission: PERMISSIONS.PRODUCTION_BUDGET_VIEW,
    createPermission: PERMISSIONS.PRODUCTION_BUDGET_CREATE,
    updatePermission: PERMISSIONS.PRODUCTION_BUDGET_UPDATE,
    deletePermission: PERMISSIONS.PRODUCTION_BUDGET_DELETE,
  },
};
