import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RequirePlatformAdmin } from "@/routes/RequirePlatformAdmin";
import { RequireCompanyAccess } from "@/routes/RequireCompanyAccess";
import { RequireModule } from "@/routes/RequireModule";
import { RequirePermission } from "@/routes/RequirePermission";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { CompanyShell } from "@/components/layout/CompanyShell";
import { PERMISSIONS } from "@/lib/permissions/keys";

import PlatformLoginPage from "@/pages/platform/PlatformLoginPage";
import PlatformDashboardPage from "@/pages/platform/PlatformDashboardPage";
import PlatformCompaniesPage from "@/pages/platform/PlatformCompaniesPage";

import AcceptInvitePage from "@/pages/AcceptInvitePage";
import CompanySelectPage from "@/pages/company/CompanySelectPage";
import CompanyLoginPage from "@/pages/company/CompanyLoginPage";
import ForgotPasswordPage from "@/pages/company/ForgotPasswordPage";
import CompanyDashboardPage from "@/pages/company/CompanyDashboardPage";
import AccountSettingsPage from "@/pages/company/AccountSettingsPage";
import HandbookPage from "@/pages/company/HandbookPage";

import ITDashboardPage from "@/pages/it/ITDashboardPage";
import TicketsListPage from "@/pages/it/TicketsListPage";
import CreateTicketPage from "@/pages/it/CreateTicketPage";
import TicketDetailPage from "@/pages/it/TicketDetailPage";
import CategoriesPage from "@/pages/it/CategoriesPage";

import InventoryDashboardPage from "@/pages/it/inventory/InventoryDashboardPage";
import AssetListPage from "@/pages/it/inventory/AssetListPage";
import CreateAssetPage from "@/pages/it/inventory/CreateAssetPage";
import AssetDetailPage from "@/pages/it/inventory/AssetDetailPage";
import CredentialsPage from "@/pages/it/inventory/CredentialsPage";
import IpAddressesPage from "@/pages/it/inventory/IpAddressesPage";
import RepairsPage from "@/pages/it/inventory/RepairsPage";
import DisposalsPage from "@/pages/it/inventory/DisposalsPage";
import AssetHistoryPage from "@/pages/it/inventory/AssetHistoryPage";

import BudgetDashboardPage from "@/pages/it/budget/BudgetDashboardPage";
import BudgetsListPage from "@/pages/it/budget/BudgetsListPage";
import BudgetDetailPage from "@/pages/it/budget/BudgetDetailPage";
import BudgetCategoriesPage from "@/pages/it/budget/BudgetCategoriesPage";
import BudgetTransactionsPage from "@/pages/it/budget/BudgetTransactionsPage";

import ProcurementDashboardPage from "@/pages/it/procurement/ProcurementDashboardPage";
import PurchaseRequestsListPage from "@/pages/it/procurement/PurchaseRequestsListPage";
import CreatePurchaseRequestPage from "@/pages/it/procurement/CreatePurchaseRequestPage";
import PurchaseRequestDetailPage from "@/pages/it/procurement/PurchaseRequestDetailPage";
import QuotationsListPage from "@/pages/it/procurement/QuotationsListPage";
import PurchaseOrdersListPage from "@/pages/it/procurement/PurchaseOrdersListPage";
import PurchaseOrderDetailPage from "@/pages/it/procurement/PurchaseOrderDetailPage";
import DeliveriesListPage from "@/pages/it/procurement/DeliveriesListPage";
import SuppliersListPage from "@/pages/it/procurement/SuppliersListPage";
import SupplierDetailPage from "@/pages/it/procurement/SupplierDetailPage";
import ProcurementHistoryPage from "@/pages/it/procurement/ProcurementHistoryPage";
import ReportsPage from "@/pages/it/procurement/ReportsPage";

import HRDashboardPage from "@/pages/hr/HRDashboardPage";
import EmployeesListPage from "@/pages/hr/EmployeesListPage";
import CreateEmployeePage from "@/pages/hr/CreateEmployeePage";
import EmployeeDetailPage from "@/pages/hr/EmployeeDetailPage";
import HrDepartmentsPage from "@/pages/hr/organization/HrDepartmentsPage";
import PositionsPage from "@/pages/hr/organization/PositionsPage";
import OrgChartPage from "@/pages/hr/organization/OrgChartPage";
import AttendancePage from "@/pages/hr/AttendancePage";
import LeavePage from "@/pages/hr/LeavePage";
import OvertimePage from "@/pages/hr/OvertimePage";
import TimesheetsPage from "@/pages/hr/TimesheetsPage";
import HrRequestsListPage from "@/pages/hr/HrRequestsListPage";
import HrRequestDetailPage from "@/pages/hr/HrRequestDetailPage";
import DocumentsPage from "@/pages/hr/DocumentsPage";
import ContractsPage from "@/pages/hr/ContractsPage";
import BenefitsPage from "@/pages/hr/BenefitsPage";
import DeductionsPage from "@/pages/hr/DeductionsPage";
import PayrollPeriodsPage from "@/pages/hr/PayrollPeriodsPage";
import HrReportsPage from "@/pages/hr/HrReportsPage";
import HrSettingsPage from "@/pages/hr/HrSettingsPage";

import UsersPage from "@/pages/company/settings/UsersPage";
import DepartmentsPage from "@/pages/company/settings/DepartmentsPage";
import RolesPage from "@/pages/company/settings/RolesPage";
import AppearancePage from "@/pages/company/settings/AppearancePage";
import CurrencySettingsPage from "@/pages/company/settings/CurrencySettingsPage";
import ExchangeRatesPage from "@/pages/company/admin/ExchangeRatesPage";

import NotFoundPage from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/company" replace />} />
        <Route path="/company" element={<CompanySelectPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* Platform Superadmin */}
        <Route path="/platform/login" element={<PlatformLoginPage />} />
        <Route
          path="/platform"
          element={
            <RequirePlatformAdmin>
              <PlatformShell>
                <Outlet />
              </PlatformShell>
            </RequirePlatformAdmin>
          }
        >
          <Route index element={<PlatformDashboardPage />} />
          <Route path="companies" element={<PlatformCompaniesPage />} />
        </Route>

        {/* Company-scoped */}
        <Route path="/c/:companySlug">
          <Route path="login" element={<CompanyLoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />

          <Route
            element={
              <RequireCompanyAccess>
                <CompanyShell>
                  <Outlet />
                </CompanyShell>
              </RequireCompanyAccess>
            }
          >
            <Route index element={<CompanyDashboardPage />} />
            <Route path="account" element={<AccountSettingsPage />} />
            <Route
              path="handbook"
              element={
                <RequirePermission permission={PERMISSIONS.ADMIN_COMPANY_SETTINGS_MANAGE}>
                  <HandbookPage />
                </RequirePermission>
              }
            />

            <Route
              path="it"
              element={
                <RequireModule moduleKey="IT">
                  <Outlet />
                </RequireModule>
              }
            >
              <Route index element={<ITDashboardPage />} />
              <Route path="tickets">
                <Route index element={<TicketsListPage />} />
                <Route
                  path="new"
                  element={
                    <RequirePermission permission={PERMISSIONS.IT_TICKETS_CREATE}>
                      <CreateTicketPage />
                    </RequirePermission>
                  }
                />
                <Route path=":ticketId" element={<TicketDetailPage />} />
              </Route>
              <Route
                path="categories"
                element={
                  <RequirePermission permission={PERMISSIONS.ADMIN_IT_CATEGORIES_MANAGE}>
                    <CategoriesPage />
                  </RequirePermission>
                }
              />
            </Route>

            {/* Inventory is a separately toggleable module (Platform Superadmin
                can turn it on/off independently of Ticketing), so it gets its
                own RequireModule gate rather than nesting under "it" above --
                even though the URL and sidebar still present it as part of IT. */}
            <Route
              path="it/inventory"
              element={
                <RequireModule moduleKey="INVENTORY">
                  <RequirePermission permission={PERMISSIONS.IT_INVENTORY_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<InventoryDashboardPage />} />
              <Route path="items" element={<AssetListPage title="All Items" description="Every hardware and software asset" />} />
              <Route path="hardware" element={<AssetListPage presetType="HARDWARE" title="Hardware" description="Physical equipment inventory" />} />
              <Route path="software" element={<AssetListPage presetType="SOFTWARE" title="Software" description="Licenses and applications" />} />
              <Route
                path="subscriptions"
                element={<AssetListPage presetType="SOFTWARE" presetSoftwareType="SUBSCRIPTION" title="Subscriptions" description="Recurring software subscriptions" />}
              />
              <Route path="repairs" element={<RepairsPage />} />
              <Route path="disposal" element={<DisposalsPage />} />
              <Route path="history" element={<AssetHistoryPage />} />
              <Route
                path="new"
                element={
                  <RequirePermission permission={PERMISSIONS.IT_INVENTORY_CREATE}>
                    <CreateAssetPage />
                  </RequirePermission>
                }
              />
              <Route
                path="credentials"
                element={
                  <RequirePermission permission={PERMISSIONS.IT_CREDENTIALS_VIEW}>
                    <CredentialsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="ip"
                element={
                  <RequirePermission permission={PERMISSIONS.IT_IP_VIEW}>
                    <IpAddressesPage />
                  </RequirePermission>
                }
              />
              <Route path=":assetCode" element={<AssetDetailPage />} />
            </Route>

            {/* Budget & Procurement share one PROCUREMENT module toggle -- see
                CompanyShell.tsx for why -- each with its own permission gate. */}
            <Route
              path="it/budget"
              element={
                <RequireModule moduleKey="PROCUREMENT">
                  <RequirePermission permission={PERMISSIONS.IT_BUDGET_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<BudgetDashboardPage />} />
              <Route path="budgets" element={<BudgetsListPage />} />
              <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
              <Route path="categories" element={<BudgetCategoriesPage />} />
              <Route path="transactions" element={<BudgetTransactionsPage />} />
            </Route>

            <Route
              path="it/procurement"
              element={
                <RequireModule moduleKey="PROCUREMENT">
                  <RequirePermission permission={PERMISSIONS.IT_PROCUREMENT_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<ProcurementDashboardPage />} />
              <Route path="requests">
                <Route index element={<PurchaseRequestsListPage />} />
                <Route
                  path="new"
                  element={
                    <RequirePermission permission={PERMISSIONS.IT_PROCUREMENT_CREATE}>
                      <CreatePurchaseRequestPage />
                    </RequirePermission>
                  }
                />
                <Route path=":requestId" element={<PurchaseRequestDetailPage />} />
              </Route>
              <Route path="quotations" element={<QuotationsListPage />} />
              <Route path="orders">
                <Route index element={<PurchaseOrdersListPage />} />
                <Route path=":poId" element={<PurchaseOrderDetailPage />} />
              </Route>
              <Route path="deliveries" element={<DeliveriesListPage />} />
              <Route
                path="suppliers"
                element={
                  <RequirePermission permission={PERMISSIONS.IT_SUPPLIERS_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<SuppliersListPage />} />
                <Route path=":supplierId" element={<SupplierDetailPage />} />
              </Route>
              <Route path="history" element={<ProcurementHistoryPage />} />
            </Route>

            <Route
              path="it/reports"
              element={
                <RequireModule moduleKey="PROCUREMENT">
                  <RequirePermission permission={[PERMISSIONS.IT_PROCUREMENT_VIEW, PERMISSIONS.IT_BUDGET_VIEW]}>
                    <ReportsPage />
                  </RequirePermission>
                </RequireModule>
              }
            />

            <Route
              path="hr"
              element={
                <RequireModule moduleKey="HR">
                  <RequirePermission permission={PERMISSIONS.HR_DASHBOARD_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<HRDashboardPage />} />
              <Route
                path="employees"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_EMPLOYEES_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<EmployeesListPage />} />
                <Route
                  path="new"
                  element={
                    <RequirePermission permission={PERMISSIONS.HR_EMPLOYEES_CREATE}>
                      <CreateEmployeePage />
                    </RequirePermission>
                  }
                />
                <Route path=":employeeId" element={<EmployeeDetailPage />} />
              </Route>
              <Route
                path="organization/departments"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_DEPARTMENTS_VIEW}>
                    <HrDepartmentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="organization/positions"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_POSITIONS_VIEW}>
                    <PositionsPage />
                  </RequirePermission>
                }
              />
              <Route path="organization/chart" element={<OrgChartPage />} />
              <Route
                path="attendance"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_ATTENDANCE_VIEW}>
                    <AttendancePage />
                  </RequirePermission>
                }
              />
              <Route path="leave" element={<LeavePage />} />
              <Route path="overtime" element={<OvertimePage />} />
              <Route path="timesheets" element={<TimesheetsPage />} />
              <Route path="requests">
                <Route index element={<HrRequestsListPage />} />
                <Route path=":requestId" element={<HrRequestDetailPage />} />
              </Route>
              <Route
                path="documents"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_DOCUMENTS_VIEW}>
                    <DocumentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="contracts"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_CONTRACTS_VIEW}>
                    <ContractsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="benefits"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_BENEFITS_VIEW}>
                    <BenefitsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="deductions"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_DEDUCTIONS_VIEW}>
                    <DeductionsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="payroll"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_PAYROLL_VIEW}>
                    <PayrollPeriodsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="reports"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_REPORTS_VIEW}>
                    <HrReportsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="settings"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_SETTINGS_MANAGE}>
                    <HrSettingsPage />
                  </RequirePermission>
                }
              />
            </Route>

            <Route path="settings">
              <Route
                path="currency"
                element={
                  <RequirePermission permission={[PERMISSIONS.IT_CURRENCY_VIEW, PERMISSIONS.IT_CURRENCY_MANAGE]}>
                    <CurrencySettingsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="users"
                element={
                  <RequirePermission permission={[PERMISSIONS.ADMIN_USERS_VIEW, PERMISSIONS.ADMIN_USERS_MANAGE]}>
                    <UsersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="departments"
                element={
                  <RequirePermission permission={PERMISSIONS.ADMIN_DEPARTMENTS_MANAGE}>
                    <DepartmentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="roles"
                element={
                  <RequirePermission permission={PERMISSIONS.ADMIN_ROLES_MANAGE}>
                    <RolesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="appearance"
                element={
                  <RequirePermission permission={PERMISSIONS.ADMIN_COMPANY_SETTINGS_MANAGE}>
                    <AppearancePage />
                  </RequirePermission>
                }
              />
            </Route>

            <Route
              path="admin/currencies"
              element={
                <RequirePermission permission={[PERMISSIONS.IT_CURRENCY_VIEW, PERMISSIONS.IT_CURRENCY_UPDATE_RATES]}>
                  <ExchangeRatesPage />
                </RequirePermission>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
