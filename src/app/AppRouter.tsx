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

import ITDashboardPage from "@/pages/it/ITDashboardPage";
import TicketsListPage from "@/pages/it/TicketsListPage";
import CreateTicketPage from "@/pages/it/CreateTicketPage";
import TicketDetailPage from "@/pages/it/TicketDetailPage";
import CategoriesPage from "@/pages/it/CategoriesPage";

import UsersPage from "@/pages/company/settings/UsersPage";
import DepartmentsPage from "@/pages/company/settings/DepartmentsPage";
import RolesPage from "@/pages/company/settings/RolesPage";

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
                <Route path="new" element={<CreateTicketPage />} />
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
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
