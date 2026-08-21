import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RequirePlatformAdmin } from "@/routes/RequirePlatformAdmin";
import { RequireCompanyAccess } from "@/routes/RequireCompanyAccess";
import { RequireModule } from "@/routes/RequireModule";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { CompanyShell } from "@/components/layout/CompanyShell";

import PlatformLoginPage from "@/pages/platform/PlatformLoginPage";
import PlatformDashboardPage from "@/pages/platform/PlatformDashboardPage";
import PlatformCompaniesPage from "@/pages/platform/PlatformCompaniesPage";

import CompanySelectPage from "@/pages/company/CompanySelectPage";
import CompanyLoginPage from "@/pages/company/CompanyLoginPage";
import ForgotPasswordPage from "@/pages/company/ForgotPasswordPage";
import CompanyDashboardPage from "@/pages/company/CompanyDashboardPage";

import ITDashboardPage from "@/pages/it/ITDashboardPage";
import TicketsListPage from "@/pages/it/TicketsListPage";
import CreateTicketPage from "@/pages/it/CreateTicketPage";
import TicketDetailPage from "@/pages/it/TicketDetailPage";

import NotFoundPage from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/company" replace />} />
        <Route path="/company" element={<CompanySelectPage />} />

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
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
