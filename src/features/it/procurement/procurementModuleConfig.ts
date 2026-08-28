import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/keys";
import type { BudgetModuleKey } from "@/types/database";

// One shared Procurement engine, five department-filtered views -- same
// shape as budgetModuleConfig.ts (the whole point of sharing Procurement
// the way Budget was already shared). This config is the only place that
// knows which permission/route/label belongs to which department, so the
// actual pages (ProcurementDashboardPage, PurchaseRequestsListPage,
// CreatePurchaseRequestPage, QuotationsListPage, PurchaseOrdersListPage,
// DeliveriesListPage) stay a single generalized implementation instead of
// five near-duplicates. Suppliers/History are NOT per-department --
// they're a shared catalog/feed reached from IT's own route, same as
// budget_categories was never given its own per-department route either.
export interface ProcurementModuleConfig {
  label: string;
  basePath: string; // e.g. "it/procurement" -- routes live at /c/:slug/<basePath>/...
  viewPermission: PermissionKey;
  createPermission: PermissionKey;
  updatePermission: PermissionKey;
  deletePermission: PermissionKey;
  submitPermission: PermissionKey;
  approvePermission: PermissionKey;
  rejectPermission: PermissionKey;
  createPoPermission: PermissionKey;
  approvePoPermission: PermissionKey;
  receivePermission: PermissionKey;
  exportPermission: PermissionKey;
  printPermission: PermissionKey;
  suppliersViewPermission: PermissionKey;
}

export const PROCUREMENT_MODULE_CONFIG: Record<BudgetModuleKey, ProcurementModuleConfig> = {
  IT: {
    label: "IT",
    basePath: "it/procurement",
    viewPermission: PERMISSIONS.IT_PROCUREMENT_VIEW,
    createPermission: PERMISSIONS.IT_PROCUREMENT_CREATE,
    updatePermission: PERMISSIONS.IT_PROCUREMENT_UPDATE,
    deletePermission: PERMISSIONS.IT_PROCUREMENT_DELETE,
    submitPermission: PERMISSIONS.IT_PROCUREMENT_SUBMIT,
    approvePermission: PERMISSIONS.IT_PROCUREMENT_APPROVE,
    rejectPermission: PERMISSIONS.IT_PROCUREMENT_REJECT,
    createPoPermission: PERMISSIONS.IT_PROCUREMENT_CREATE_PO,
    approvePoPermission: PERMISSIONS.IT_PROCUREMENT_APPROVE_PO,
    receivePermission: PERMISSIONS.IT_PROCUREMENT_RECEIVE,
    exportPermission: PERMISSIONS.IT_PROCUREMENT_EXPORT,
    printPermission: PERMISSIONS.IT_PROCUREMENT_PRINT,
    suppliersViewPermission: PERMISSIONS.IT_SUPPLIERS_VIEW,
  },
  HR: {
    label: "HR",
    basePath: "hr/procurement",
    viewPermission: PERMISSIONS.HR_PROCUREMENT_VIEW,
    createPermission: PERMISSIONS.HR_PROCUREMENT_CREATE,
    updatePermission: PERMISSIONS.HR_PROCUREMENT_UPDATE,
    deletePermission: PERMISSIONS.HR_PROCUREMENT_DELETE,
    submitPermission: PERMISSIONS.HR_PROCUREMENT_SUBMIT,
    approvePermission: PERMISSIONS.HR_PROCUREMENT_APPROVE,
    rejectPermission: PERMISSIONS.HR_PROCUREMENT_REJECT,
    createPoPermission: PERMISSIONS.HR_PROCUREMENT_CREATE_PO,
    approvePoPermission: PERMISSIONS.HR_PROCUREMENT_APPROVE_PO,
    receivePermission: PERMISSIONS.HR_PROCUREMENT_RECEIVE,
    exportPermission: PERMISSIONS.HR_PROCUREMENT_EXPORT,
    printPermission: PERMISSIONS.HR_PROCUREMENT_PRINT,
    suppliersViewPermission: PERMISSIONS.HR_SUPPLIERS_VIEW,
  },
  FINANCE: {
    label: "Finance",
    basePath: "finance/procurement",
    viewPermission: PERMISSIONS.FINANCE_PROCUREMENT_VIEW,
    createPermission: PERMISSIONS.FINANCE_PROCUREMENT_CREATE,
    updatePermission: PERMISSIONS.FINANCE_PROCUREMENT_UPDATE,
    deletePermission: PERMISSIONS.FINANCE_PROCUREMENT_DELETE,
    submitPermission: PERMISSIONS.FINANCE_PROCUREMENT_SUBMIT,
    approvePermission: PERMISSIONS.FINANCE_PROCUREMENT_APPROVE,
    rejectPermission: PERMISSIONS.FINANCE_PROCUREMENT_REJECT,
    createPoPermission: PERMISSIONS.FINANCE_PROCUREMENT_CREATE_PO,
    approvePoPermission: PERMISSIONS.FINANCE_PROCUREMENT_APPROVE_PO,
    receivePermission: PERMISSIONS.FINANCE_PROCUREMENT_RECEIVE,
    exportPermission: PERMISSIONS.FINANCE_PROCUREMENT_EXPORT,
    printPermission: PERMISSIONS.FINANCE_PROCUREMENT_PRINT,
    suppliersViewPermission: PERMISSIONS.FINANCE_SUPPLIERS_VIEW,
  },
  ADMIN: {
    label: "Administration",
    basePath: "admin/procurement",
    viewPermission: PERMISSIONS.ADMIN_PROCUREMENT_VIEW,
    createPermission: PERMISSIONS.ADMIN_PROCUREMENT_CREATE,
    updatePermission: PERMISSIONS.ADMIN_PROCUREMENT_UPDATE,
    deletePermission: PERMISSIONS.ADMIN_PROCUREMENT_DELETE,
    submitPermission: PERMISSIONS.ADMIN_PROCUREMENT_SUBMIT,
    approvePermission: PERMISSIONS.ADMIN_PROCUREMENT_APPROVE,
    rejectPermission: PERMISSIONS.ADMIN_PROCUREMENT_REJECT,
    createPoPermission: PERMISSIONS.ADMIN_PROCUREMENT_CREATE_PO,
    approvePoPermission: PERMISSIONS.ADMIN_PROCUREMENT_APPROVE_PO,
    receivePermission: PERMISSIONS.ADMIN_PROCUREMENT_RECEIVE,
    exportPermission: PERMISSIONS.ADMIN_PROCUREMENT_EXPORT,
    printPermission: PERMISSIONS.ADMIN_PROCUREMENT_PRINT,
    suppliersViewPermission: PERMISSIONS.ADMIN_SUPPLIERS_VIEW,
  },
  PRODUCTION: {
    label: "Production",
    basePath: "production/procurement",
    viewPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_VIEW,
    createPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_CREATE,
    updatePermission: PERMISSIONS.PRODUCTION_PROCUREMENT_UPDATE,
    deletePermission: PERMISSIONS.PRODUCTION_PROCUREMENT_DELETE,
    submitPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_SUBMIT,
    approvePermission: PERMISSIONS.PRODUCTION_PROCUREMENT_APPROVE,
    rejectPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_REJECT,
    createPoPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_CREATE_PO,
    approvePoPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_APPROVE_PO,
    receivePermission: PERMISSIONS.PRODUCTION_PROCUREMENT_RECEIVE,
    exportPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_EXPORT,
    printPermission: PERMISSIONS.PRODUCTION_PROCUREMENT_PRINT,
    suppliersViewPermission: PERMISSIONS.PRODUCTION_SUPPLIERS_VIEW,
  },
};
