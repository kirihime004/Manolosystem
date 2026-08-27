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
import FinanceBudgetReviewListPage from "@/pages/finance/budgets/FinanceBudgetReviewListPage";
import FinanceBudgetReviewDetailPage from "@/pages/finance/budgets/FinanceBudgetReviewDetailPage";
import CompanyBudgetOverviewPage from "@/pages/finance/budgets/CompanyBudgetOverviewPage";

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

import FinanceDashboardPage from "@/pages/finance/FinanceDashboardPage";
import ChartOfAccountsPage from "@/pages/finance/accounting/ChartOfAccountsPage";
import JournalEntriesPage from "@/pages/finance/accounting/JournalEntriesPage";
import JournalEntryDetailPage from "@/pages/finance/accounting/JournalEntryDetailPage";
import GeneralLedgerPage from "@/pages/finance/accounting/GeneralLedgerPage";
import TrialBalancePage from "@/pages/finance/accounting/TrialBalancePage";
import SupplierBillsPage from "@/pages/finance/ap/SupplierBillsPage";
import SupplierBillDetailPage from "@/pages/finance/ap/SupplierBillDetailPage";
import ApAgingPage from "@/pages/finance/ap/ApAgingPage";
import CustomersPage from "@/pages/finance/ar/CustomersPage";
import CustomerInvoicesPage from "@/pages/finance/ar/CustomerInvoicesPage";
import CustomerInvoiceDetailPage from "@/pages/finance/ar/CustomerInvoiceDetailPage";
import ArAgingPage from "@/pages/finance/ar/ArAgingPage";
import ExpensesPage from "@/pages/finance/expenses/ExpensesPage";
import ExpenseDetailPage from "@/pages/finance/expenses/ExpenseDetailPage";
import CashAccountsPage from "@/pages/finance/cashbank/CashAccountsPage";
import CashAccountDetailPage from "@/pages/finance/cashbank/CashAccountDetailPage";
import PayrollRunsPage from "@/pages/finance/payroll/PayrollRunsPage";
import PayrollRunDetailPage from "@/pages/finance/payroll/PayrollRunDetailPage";
import FinanceReportsPage from "@/pages/finance/FinanceReportsPage";
import FinanceSettingsPage from "@/pages/finance/FinanceSettingsPage";

import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminRequestsListPage from "@/pages/admin/requests/AdminRequestsListPage";
import AdminRequestDetailPage from "@/pages/admin/requests/AdminRequestDetailPage";
import LocationsPage from "@/pages/admin/facilities/LocationsPage";
import RoomsPage from "@/pages/admin/facilities/RoomsPage";
import RoomBookingsPage from "@/pages/admin/facilities/RoomBookingsPage";
import WorkspacesPage from "@/pages/admin/facilities/WorkspacesPage";
import OfficeSuppliesPage from "@/pages/admin/OfficeSuppliesPage";
import OfficeSupplyRequestsPage from "@/pages/admin/OfficeSupplyRequestsPage";
import AdminAssetsPage from "@/pages/admin/AdminAssetsPage";
import MaintenancePage from "@/pages/admin/MaintenancePage";
import VehiclesPage from "@/pages/admin/VehiclesPage";
import TravelPage from "@/pages/admin/TravelPage";
import VisitorsPage from "@/pages/admin/VisitorsPage";
import MeetingsPage from "@/pages/admin/MeetingsPage";
import EventsPage from "@/pages/admin/EventsPage";
import EventDetailPage from "@/pages/admin/EventDetailPage";
import AdminContractsPage from "@/pages/admin/ContractsPage";
import CompliancePage from "@/pages/admin/CompliancePage";
import AnnouncementsPage from "@/pages/admin/AnnouncementsPage";
import CourierPage from "@/pages/admin/CourierPage";
import AdminDocumentsPage from "@/pages/admin/AdminDocumentsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";

import ProductionDashboardPage from "@/pages/production/ProductionDashboardPage";
import ProjectsListPage from "@/pages/production/projects/ProjectsListPage";
import ProjectDetailPage from "@/pages/production/projects/ProjectDetailPage";
import ShotsPage from "@/pages/production/shots/ShotsPage";
import ShotDetailPage from "@/pages/production/shots/ShotDetailPage";
import AssetsPage from "@/pages/production/assets/AssetsPage";
import ProductionAssetDetailPage from "@/pages/production/assets/AssetDetailPage";
import TasksBoardPage from "@/pages/production/tasks/TasksBoardPage";
import MilestonesPage from "@/pages/production/schedule/MilestonesPage";
import ReviewQueuePage from "@/pages/production/reviews/ReviewQueuePage";
import DeliverablesPage from "@/pages/production/deliverables/DeliverablesPage";
import ResourcesPage from "@/pages/production/resources/ResourcesPage";
import ProductionSettingsPage from "@/pages/production/ProductionSettingsPage";
import ApprovedWorkQueuePage from "@/pages/production/work/ApprovedWorkQueuePage";
import MyEarningsPage from "@/pages/production/work/MyEarningsPage";
import FinanceProductionEarningsPage from "@/pages/finance/production/FinanceProductionEarningsPage";
import ClientLoginPage from "@/pages/client/ClientLoginPage";
import ClientPortalPage from "@/pages/client/ClientPortalPage";

import AiDashboardPage from "@/pages/ai/AiDashboardPage";
import AiAssistantPage from "@/pages/ai/AiAssistantPage";

import UsersPage from "@/pages/company/settings/UsersPage";
import DepartmentsPage from "@/pages/company/settings/DepartmentsPage";
import RolesPage from "@/pages/company/settings/RolesPage";
import AppearancePage from "@/pages/company/settings/AppearancePage";
import CurrencySettingsPage from "@/pages/company/settings/CurrencySettingsPage";
import AiSettingsPage from "@/pages/company/settings/AiSettingsPage";
import ExchangeRatesPage from "@/pages/company/admin/ExchangeRatesPage";

import NotFoundPage from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/company" replace />} />
        <Route path="/company" element={<CompanySelectPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* Client Portal: a separate auth path from /c/:companySlug -- a
            client contact is a real Supabase auth user but never a
            company_users row, so it never goes through RequireCompanyAccess. */}
        <Route path="/client/:companySlug/login" element={<ClientLoginPage />} />
        <Route path="/client/:companySlug" element={<ClientPortalPage />} />

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
                <RequireModule moduleKey="TICKETING">
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
                <RequireModule moduleKey={["HR_EMPLOYEES", "HR_ATTENDANCE_LEAVE", "HR_PAYROLL"]}>
                  <RequirePermission permission={PERMISSIONS.HR_DASHBOARD_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<HRDashboardPage />} />

              {/* Employees owns the master people record, org structure, documents,
                  contracts, self-service requests, reports, and settings -- gated
                  on its own HR_EMPLOYEES leaf module, nested under HR's parent switch. */}
              <Route
                element={
                  <RequireModule moduleKey="HR_EMPLOYEES">
                    <Outlet />
                  </RequireModule>
                }
              >
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

              {/* Attendance & Leave: attendance, leave, overtime, timesheets. */}
              <Route
                element={
                  <RequireModule moduleKey="HR_ATTENDANCE_LEAVE">
                    <Outlet />
                  </RequireModule>
                }
              >
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
              </Route>

              {/* Payroll & Benefits: benefits, deductions, payroll periods. */}
              <Route
                element={
                  <RequireModule moduleKey="HR_PAYROLL">
                    <Outlet />
                  </RequireModule>
                }
              >
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
              </Route>

              {/* HR's own view onto the shared Budget & Procurement engine
                  (see the IT "budget" block below for the canonical
                  version -- same components, filtered to moduleKey="HR"). */}
              <Route
                path="budget"
                element={
                  <RequirePermission permission={PERMISSIONS.HR_BUDGET_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<BudgetDashboardPage moduleKey="HR" />} />
                <Route path="budgets" element={<BudgetsListPage moduleKey="HR" />} />
                <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
              </Route>
            </Route>

            <Route
              path="finance"
              element={
                <RequireModule moduleKey={["FINANCE_ACCOUNTING", "FINANCE_AP", "FINANCE_AR", "FINANCE_EXPENSES", "FINANCE_BANK", "FINANCE_PAYROLL"]}>
                  <RequirePermission permission={PERMISSIONS.FINANCE_DASHBOARD_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<FinanceDashboardPage />} />

              {/* Accounting owns the ledger core plus Reports/Settings, gated on
                  its own FINANCE_ACCOUNTING leaf module, nested under Finance's
                  parent switch. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_ACCOUNTING">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="accounting/chart-of-accounts"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_ACCOUNTS_VIEW}>
                      <ChartOfAccountsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="accounting/journals"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_JOURNALS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<JournalEntriesPage />} />
                  <Route path=":journalEntryId" element={<JournalEntryDetailPage />} />
                </Route>
                <Route
                  path="accounting/general-ledger"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_GL_VIEW}>
                      <GeneralLedgerPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="accounting/trial-balance"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_TRIAL_BALANCE_VIEW}>
                      <TrialBalancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_REPORTS_VIEW}>
                      <FinanceReportsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_SETTINGS_MANAGE}>
                      <FinanceSettingsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Accounts Payable: supplier bills and AP aging. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_AP">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="ap/bills"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_AP_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<SupplierBillsPage />} />
                  <Route path=":billId" element={<SupplierBillDetailPage />} />
                </Route>
                <Route
                  path="ap/aging"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_AP_VIEW}>
                      <ApAgingPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Accounts Receivable: customers, invoices, and AR aging. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_AR">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="ar/customers"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_CUSTOMERS_VIEW}>
                      <CustomersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="ar/invoices"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_AR_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<CustomerInvoicesPage />} />
                  <Route path=":invoiceId" element={<CustomerInvoiceDetailPage />} />
                </Route>
                <Route
                  path="ar/aging"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_AR_VIEW}>
                      <ArAgingPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Expenses: employee expense claims and approvals. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_EXPENSES">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="expenses"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_EXPENSES_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<ExpensesPage />} />
                  <Route path=":expenseId" element={<ExpenseDetailPage />} />
                </Route>
              </Route>

              {/* Cash & Bank: cash accounts, transactions, reconciliation. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_BANK">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="cash-bank"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_BANK_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<CashAccountsPage />} />
                  <Route path=":cashAccountId" element={<CashAccountDetailPage />} />
                </Route>
              </Route>

              {/* Payroll: payroll runs and payslips. */}
              <Route
                element={
                  <RequireModule moduleKey="FINANCE_PAYROLL">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="payroll"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_PAYROLL_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<PayrollRunsPage />} />
                  <Route path=":payrollRunId" element={<PayrollRunDetailPage />} />
                </Route>
                <Route
                  path="production-earnings"
                  element={
                    <RequirePermission permission={PERMISSIONS.FINANCE_PAYROLL_VIEW}>
                      <FinanceProductionEarningsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Finance's own view onto the shared Budget & Procurement
                  engine, plus the two Finance-only surfaces: the cross-
                  department approval queue and the company-wide overview. */}
              <Route
                path="budget"
                element={
                  <RequirePermission permission={PERMISSIONS.FINANCE_BUDGET_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<BudgetDashboardPage moduleKey="FINANCE" />} />
                <Route path="budgets" element={<BudgetsListPage moduleKey="FINANCE" />} />
                <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
              </Route>
              <Route
                path="budgets/review"
                element={
                  <RequirePermission permission={PERMISSIONS.BUDGET_FINANCE_APPROVE}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<FinanceBudgetReviewListPage />} />
                <Route path=":budgetId" element={<FinanceBudgetReviewDetailPage />} />
              </Route>
              <Route
                path="budgets/overview"
                element={
                  <RequirePermission permission={PERMISSIONS.FINANCE_BUDGET_VIEW}>
                    <CompanyBudgetOverviewPage />
                  </RequirePermission>
                }
              />
            </Route>

            <Route
              path="admin"
              element={
                <RequireModule
                  moduleKey={[
                    "ADMIN_REQUESTS", "ADMIN_FACILITIES", "ADMIN_SUPPLIES", "ADMIN_ASSETS", "ADMIN_VEHICLES",
                    "ADMIN_TRAVEL", "ADMIN_VISITORS", "ADMIN_EVENTS", "ADMIN_CONTRACTS", "ADMIN_COMMS",
                  ]}
                >
                  <RequirePermission permission={PERMISSIONS.ADMIN_DASHBOARD_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<AdminDashboardPage />} />

              {/* Requests: request queue + settings (request categories). */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_REQUESTS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="requests"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_REQUESTS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<AdminRequestsListPage />} />
                  <Route path=":requestId" element={<AdminRequestDetailPage />} />
                </Route>
                <Route
                  path="settings"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_SETTINGS_MANAGE}>
                      <AdminSettingsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Facilities: locations, rooms + bookings, workspaces. */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_FACILITIES">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="facilities"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_FACILITIES_VIEW}>
                      <LocationsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="rooms"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_ROOMS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<RoomsPage />} />
                  <Route path="bookings" element={<RoomBookingsPage />} />
                </Route>
                <Route
                  path="workspaces"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_WORKSPACES_VIEW}>
                      <WorkspacesPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Office Supplies: consumables + supply requests. */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_SUPPLIES">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="supplies"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_SUPPLIES_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<OfficeSuppliesPage />} />
                  <Route path="requests" element={<OfficeSupplyRequestsPage />} />
                </Route>
              </Route>

              {/* Administrative Assets: assets + maintenance. */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_ASSETS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="assets"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_ASSETS_VIEW}>
                      <AdminAssetsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="maintenance"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_MAINTENANCE_VIEW}>
                      <MaintenancePage />
                    </RequirePermission>
                  }
                />
              </Route>

              <Route
                path="vehicles"
                element={
                  <RequireModule moduleKey="ADMIN_VEHICLES">
                    <RequirePermission permission={PERMISSIONS.ADMIN_VEHICLES_VIEW}>
                      <VehiclesPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              <Route
                path="travel"
                element={
                  <RequireModule moduleKey="ADMIN_TRAVEL">
                    <RequirePermission permission={PERMISSIONS.ADMIN_TRAVEL_VIEW}>
                      <TravelPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              {/* Visitors + Meetings (front-of-house / room coordination cluster). */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_VISITORS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="visitors"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_VISITORS_VIEW}>
                      <VisitorsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="meetings"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_MEETINGS_VIEW}>
                      <MeetingsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              <Route
                path="events"
                element={
                  <RequireModule moduleKey="ADMIN_EVENTS">
                    <RequirePermission permission={PERMISSIONS.ADMIN_EVENTS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  </RequireModule>
                }
              >
                <Route index element={<EventsPage />} />
                <Route path=":eventId" element={<EventDetailPage />} />
              </Route>

              {/* Contracts + Documents + Compliance (legal/paperwork cluster). */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_CONTRACTS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="contracts"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_CONTRACTS_VIEW}>
                      <AdminContractsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="compliance"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_COMPLIANCE_VIEW}>
                      <CompliancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="documents"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_DOCUMENTS_VIEW}>
                      <AdminDocumentsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Announcements + Courier/Mail (office communications cluster). */}
              <Route
                element={
                  <RequireModule moduleKey="ADMIN_COMMS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="announcements"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_ANNOUNCEMENTS_VIEW}>
                      <AnnouncementsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="courier"
                  element={
                    <RequirePermission permission={PERMISSIONS.ADMIN_COURIER_VIEW}>
                      <CourierPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Administration's own view onto the shared Budget &
                  Procurement engine. */}
              <Route
                path="budget"
                element={
                  <RequirePermission permission={PERMISSIONS.ADMIN_BUDGET_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<BudgetDashboardPage moduleKey="ADMIN" />} />
                <Route path="budgets" element={<BudgetsListPage moduleKey="ADMIN" />} />
                <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
              </Route>
            </Route>

            <Route
              path="production"
              element={
                <RequireModule
                  moduleKey={[
                    "PRODUCTION_PROJECTS", "PRODUCTION_SHOTS", "PRODUCTION_ASSETS", "PRODUCTION_TASKS",
                    "PRODUCTION_SCHEDULE", "PRODUCTION_VERSIONS", "PRODUCTION_DELIVERABLES", "PRODUCTION_RESOURCES",
                  ]}
                >
                  <RequirePermission permission={PERMISSIONS.PRODUCTION_DASHBOARD_VIEW}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route index element={<ProductionDashboardPage />} />

              <Route
                element={
                  <RequireModule moduleKey="PRODUCTION_PROJECTS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="projects"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_PROJECTS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<ProjectsListPage />} />
                  <Route path=":projectId" element={<ProjectDetailPage />} />
                </Route>
                <Route
                  path="settings"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE}>
                      <ProductionSettingsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              <Route
                element={
                  <RequireModule moduleKey="PRODUCTION_SHOTS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="shots"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_SHOTS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<ShotsPage />} />
                  <Route path=":shotId" element={<ShotDetailPage />} />
                </Route>
              </Route>

              <Route
                element={
                  <RequireModule moduleKey="PRODUCTION_ASSETS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="assets"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_ASSETS_VIEW}>
                      <Outlet />
                    </RequirePermission>
                  }
                >
                  <Route index element={<AssetsPage />} />
                  <Route path=":assetId" element={<ProductionAssetDetailPage />} />
                </Route>
              </Route>

              <Route
                path="tasks"
                element={
                  <RequireModule moduleKey="PRODUCTION_TASKS">
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_TASKS_VIEW}>
                      <TasksBoardPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              <Route
                path="schedule"
                element={
                  <RequireModule moduleKey="PRODUCTION_SCHEDULE">
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_MILESTONES_VIEW}>
                      <MilestonesPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              <Route
                path="reviews"
                element={
                  <RequireModule moduleKey="PRODUCTION_VERSIONS">
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_REVIEWS_VIEW}>
                      <ReviewQueuePage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              <Route
                path="deliverables"
                element={
                  <RequireModule moduleKey="PRODUCTION_DELIVERABLES">
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_DELIVERABLES_VIEW}>
                      <DeliverablesPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              <Route
                path="resources"
                element={
                  <RequireModule moduleKey="PRODUCTION_RESOURCES">
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_RESOURCES_VIEW}>
                      <ResourcesPage />
                    </RequirePermission>
                  </RequireModule>
                }
              />

              {/* Production's own view onto the shared Budget &
                  Procurement engine. */}
              <Route
                path="budget"
                element={
                  <RequirePermission permission={PERMISSIONS.PRODUCTION_BUDGET_VIEW}>
                    <Outlet />
                  </RequirePermission>
                }
              >
                <Route index element={<BudgetDashboardPage moduleKey="PRODUCTION" />} />
                <Route path="budgets" element={<BudgetsListPage moduleKey="PRODUCTION" />} />
                <Route path="budgets/:budgetId" element={<BudgetDetailPage />} />
              </Route>

              {/* Rate Card + Approved Work Payment System. */}
              <Route
                element={
                  <RequireModule moduleKey="PRODUCTION_TASKS">
                    <Outlet />
                  </RequireModule>
                }
              >
                <Route
                  path="approved-work"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_WORK_APPROVE}>
                      <ApprovedWorkQueuePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="my-earnings"
                  element={
                    <RequirePermission permission={PERMISSIONS.PRODUCTION_WORK_VIEW_OWN}>
                      <MyEarningsPage />
                    </RequirePermission>
                  }
                />
              </Route>
            </Route>

            <Route
              path="ai"
              element={
                <RequireModule moduleKey="AI">
                  <RequirePermission permission={[PERMISSIONS.AI_ASSISTANT_VIEW, PERMISSIONS.AI_COMPANY_ANALYTICS_VIEW]}>
                    <Outlet />
                  </RequirePermission>
                </RequireModule>
              }
            >
              <Route
                index
                element={
                  <RequirePermission permission={PERMISSIONS.AI_COMPANY_ANALYTICS_VIEW}>
                    <AiDashboardPage />
                  </RequirePermission>
                }
              />
              <Route
                path="assistant"
                element={
                  <RequirePermission permission={PERMISSIONS.AI_ASSISTANT_VIEW}>
                    <AiAssistantPage />
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
                path="ai"
                element={
                  <RequirePermission permission={PERMISSIONS.AI_ADMIN_SETTINGS}>
                    <AiSettingsPage />
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
