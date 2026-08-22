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

import UsersPage from "@/pages/company/settings/UsersPage";
import DepartmentsPage from "@/pages/company/settings/DepartmentsPage";
import RolesPage from "@/pages/company/settings/RolesPage";
import AppearancePage from "@/pages/company/settings/AppearancePage";

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

            <Route path="settings">
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
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
