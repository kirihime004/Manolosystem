import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  UserCog,
  ShieldCheck,
  Palette,
  BookOpen,
  Boxes,
  Wallet,
  ShoppingCart,
  BarChart3,
  Coins,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyProfile } from "@/lib/auth/useMyProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isColorDark } from "@/lib/color";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { MODULE_INFO } from "@/lib/modules/moduleInfo";
import type { ModuleKey } from "@/types/database";

const NESTED_MODULE_KEYS: ModuleKey[] = [
  "IT", "TICKETING", "INVENTORY", "PROCUREMENT",
  "HR", "HR_EMPLOYEES", "HR_ATTENDANCE_LEAVE", "HR_PAYROLL",
  "FINANCE", "FINANCE_ACCOUNTING", "FINANCE_AP", "FINANCE_AR",
  "FINANCE_EXPENSES", "FINANCE_BANK", "FINANCE_PAYROLL",
];

const MODULE_NAV = (Object.entries(MODULE_INFO) as [ModuleKey, (typeof MODULE_INFO)[ModuleKey]][])
  .filter(([key]) => !NESTED_MODULE_KEYS.includes(key)) // each gets its own nested nav block below
  .map(([key, info]) => ({ key, label: info.label, icon: info.icon, path: info.path }));

const HR_NAV: { label: string; path: string; permission: string; moduleKey: ModuleKey }[] = [
  { label: "Employees", path: "employees", permission: PERMISSIONS.HR_EMPLOYEES_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Departments", path: "organization/departments", permission: PERMISSIONS.HR_DEPARTMENTS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Positions", path: "organization/positions", permission: PERMISSIONS.HR_POSITIONS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Org Chart", path: "organization/chart", permission: PERMISSIONS.HR_EMPLOYEES_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Attendance", path: "attendance", permission: PERMISSIONS.HR_ATTENDANCE_VIEW, moduleKey: "HR_ATTENDANCE_LEAVE" },
  { label: "Leave", path: "leave", permission: PERMISSIONS.HR_LEAVE_VIEW, moduleKey: "HR_ATTENDANCE_LEAVE" },
  { label: "Overtime", path: "overtime", permission: PERMISSIONS.HR_OVERTIME_VIEW, moduleKey: "HR_ATTENDANCE_LEAVE" },
  { label: "Timesheets", path: "timesheets", permission: PERMISSIONS.HR_TIMESHEETS_VIEW, moduleKey: "HR_ATTENDANCE_LEAVE" },
  { label: "Employee Requests", path: "requests", permission: PERMISSIONS.HR_REQUESTS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Documents", path: "documents", permission: PERMISSIONS.HR_DOCUMENTS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Contracts", path: "contracts", permission: PERMISSIONS.HR_CONTRACTS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Benefits", path: "benefits", permission: PERMISSIONS.HR_BENEFITS_VIEW, moduleKey: "HR_PAYROLL" },
  { label: "Deductions", path: "deductions", permission: PERMISSIONS.HR_DEDUCTIONS_VIEW, moduleKey: "HR_PAYROLL" },
  { label: "Payroll", path: "payroll", permission: PERMISSIONS.HR_PAYROLL_VIEW, moduleKey: "HR_PAYROLL" },
  { label: "Reports", path: "reports", permission: PERMISSIONS.HR_REPORTS_VIEW, moduleKey: "HR_EMPLOYEES" },
  { label: "Settings", path: "settings", permission: PERMISSIONS.HR_SETTINGS_MANAGE, moduleKey: "HR_EMPLOYEES" },
];

const FINANCE_NAV: { label: string; path: string; permission: string; moduleKey: ModuleKey }[] = [
  { label: "Chart of Accounts", path: "accounting/chart-of-accounts", permission: PERMISSIONS.FINANCE_ACCOUNTS_VIEW, moduleKey: "FINANCE_ACCOUNTING" },
  { label: "Journal Entries", path: "accounting/journals", permission: PERMISSIONS.FINANCE_JOURNALS_VIEW, moduleKey: "FINANCE_ACCOUNTING" },
  { label: "General Ledger", path: "accounting/general-ledger", permission: PERMISSIONS.FINANCE_GL_VIEW, moduleKey: "FINANCE_ACCOUNTING" },
  { label: "Trial Balance", path: "accounting/trial-balance", permission: PERMISSIONS.FINANCE_TRIAL_BALANCE_VIEW, moduleKey: "FINANCE_ACCOUNTING" },
  { label: "Bills", path: "ap/bills", permission: PERMISSIONS.FINANCE_AP_VIEW, moduleKey: "FINANCE_AP" },
  { label: "AP Aging", path: "ap/aging", permission: PERMISSIONS.FINANCE_AP_VIEW, moduleKey: "FINANCE_AP" },
  { label: "Customers", path: "ar/customers", permission: PERMISSIONS.FINANCE_CUSTOMERS_VIEW, moduleKey: "FINANCE_AR" },
  { label: "Invoices", path: "ar/invoices", permission: PERMISSIONS.FINANCE_AR_VIEW, moduleKey: "FINANCE_AR" },
  { label: "AR Aging", path: "ar/aging", permission: PERMISSIONS.FINANCE_AR_VIEW, moduleKey: "FINANCE_AR" },
  { label: "Expenses", path: "expenses", permission: PERMISSIONS.FINANCE_EXPENSES_VIEW, moduleKey: "FINANCE_EXPENSES" },
  { label: "Cash & Bank", path: "cash-bank", permission: PERMISSIONS.FINANCE_BANK_VIEW, moduleKey: "FINANCE_BANK" },
  { label: "Payroll", path: "payroll", permission: PERMISSIONS.FINANCE_PAYROLL_VIEW, moduleKey: "FINANCE_PAYROLL" },
  { label: "Reports", path: "reports", permission: PERMISSIONS.FINANCE_REPORTS_VIEW, moduleKey: "FINANCE_ACCOUNTING" },
  { label: "Settings", path: "settings", permission: PERMISSIONS.FINANCE_SETTINGS_MANAGE, moduleKey: "FINANCE_ACCOUNTING" },
];

const INVENTORY_NAV: { label: string; path: string; permission: string }[] = [
  { label: "All Items", path: "items", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Hardware", path: "hardware", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Software", path: "software", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Subscriptions", path: "subscriptions", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Credentials", path: "credentials", permission: PERMISSIONS.IT_CREDENTIALS_VIEW },
  { label: "IP Addresses", path: "ip", permission: PERMISSIONS.IT_IP_VIEW },
  { label: "Repairs", path: "repairs", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Disposal", path: "disposal", permission: PERMISSIONS.IT_INVENTORY_VIEW },
  { label: "Asset History", path: "history", permission: PERMISSIONS.IT_INVENTORY_VIEW },
];

const BUDGET_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Dashboard", path: "", permission: PERMISSIONS.IT_BUDGET_VIEW },
  { label: "Budgets", path: "budgets", permission: PERMISSIONS.IT_BUDGET_VIEW },
  { label: "Categories", path: "categories", permission: PERMISSIONS.IT_BUDGET_VIEW },
  { label: "Transactions", path: "transactions", permission: PERMISSIONS.IT_BUDGET_VIEW },
];

const PROCUREMENT_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Dashboard", path: "", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
  { label: "Purchase Requests", path: "requests", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
  { label: "Quotations", path: "quotations", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
  { label: "Purchase Orders", path: "orders", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
  { label: "Deliveries", path: "deliveries", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
  { label: "Suppliers", path: "suppliers", permission: PERMISSIONS.IT_SUPPLIERS_VIEW },
  { label: "History", path: "history", permission: PERMISSIONS.IT_PROCUREMENT_VIEW },
];

// Sidebar sections can nest three levels deep (IT > Inventory > "All Items")
// once every module/sub-module is enabled, which is a lot to scroll past to
// reach something unrelated. Each group header below gets its own
// collapse/expand toggle, persisted across reloads so the user's layout
// sticks. A group still force-expands whenever the active route is inside
// it, so navigating there directly (e.g. a bookmark) never hides the page
// you're actually on behind a collapsed section.
const SIDEBAR_COLLAPSE_STORAGE_KEY = "mindburst:sidebar-collapsed-groups";

function loadCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

const SETTINGS_NAV: { label: string; icon: LucideIcon; path: string; permissions: string[] }[] = [
  { label: "Users", icon: UserCog, path: "settings/users", permissions: [PERMISSIONS.ADMIN_USERS_VIEW, PERMISSIONS.ADMIN_USERS_MANAGE] },
  { label: "Departments", icon: Building2, path: "settings/departments", permissions: [PERMISSIONS.ADMIN_DEPARTMENTS_MANAGE] },
  { label: "Roles", icon: ShieldCheck, path: "settings/roles", permissions: [PERMISSIONS.ADMIN_ROLES_MANAGE] },
  { label: "Currency", icon: Coins, path: "settings/currency", permissions: [PERMISSIONS.IT_CURRENCY_MANAGE, PERMISSIONS.IT_CURRENCY_VIEW] },
  { label: "Exchange Rates", icon: BarChart3, path: "admin/currencies", permissions: [PERMISSIONS.IT_CURRENCY_UPDATE_RATES, PERMISSIONS.IT_CURRENCY_VIEW] },
  { label: "Appearance", icon: Palette, path: "settings/appearance", permissions: [PERMISSIONS.ADMIN_COMPANY_SETTINGS_MANAGE] },
  { label: "Mindburst Handbook", icon: BookOpen, path: "handbook", permissions: [PERMISSIONS.ADMIN_COMPANY_SETTINGS_MANAGE] },
];

export function CompanyShell({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, enabledModules, hasPermission } = useCompany();
  const { user, signOut } = useAuth();
  const { data: profile } = useMyProfile();
  const location = useLocation();
  const navigate = useNavigate();

  const base = `/c/${companySlug}`;
  const displayName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  const initials =
    (profile?.first_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Best-effort persistence -- a private-browsing tab or a full quota
        // shouldn't block collapsing the sidebar, just the memory of it.
      }
      return next;
    });
  };
  const isGroupExpanded = (key: string, activeWithin: boolean) => activeWithin || !collapsedGroups.has(key);

  // A custom background can be any arbitrary photo or color the admin
  // picked, so the sidebar can't just assume the app's normal light-card
  // styling still reads well on top of it. An image is treated as
  // unpredictable brightness -> always dark-scrim + light text. A solid
  // color's own luminance decides which way to go.
  const hasImage = !!company?.sidebar_background_url;
  const hasColor = !!company?.sidebar_background_color;
  const sidebarIsDark = hasImage || (hasColor && isColorDark(company!.sidebar_background_color!));
  const sidebarStyle = hasImage
    ? {
        backgroundImage: `url(${company!.sidebar_background_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : hasColor
      ? { backgroundColor: company!.sidebar_background_color! }
      : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "relative flex w-64 flex-col overflow-hidden border-r border-border bg-card",
          sidebarIsDark && "dark",
        )}
        style={sidebarStyle}
      >
        {hasImage && <div className="absolute inset-0 bg-black/55" />}

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage src={company?.logo_url ?? undefined} />
              <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                {company?.name?.slice(0, 2).toUpperCase() ?? "CO"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-semibold text-foreground">
              {company?.name ?? "Mindburst"}
            </span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <NavLink to={base} icon={LayoutDashboard} label="Dashboard" active={location.pathname === base} />
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Modules
            </p>
            {(enabledModules.has("TICKETING") || enabledModules.has("INVENTORY") || enabledModules.has("PROCUREMENT")) && (() => {
              const itActive = location.pathname.startsWith(`${base}/it`);
              const itExpanded = isGroupExpanded("it", itActive);
              return (
                <>
                  <GroupHeader
                    to={`${base}/it`}
                    icon={MODULE_INFO.IT.icon}
                    label="IT"
                    active={location.pathname === `${base}/it`}
                    expanded={itExpanded}
                    onToggle={() => toggleGroup("it")}
                  />
                  {itExpanded && (
                    <div className="ml-4 space-y-1 border-l border-border pl-2">
                      {enabledModules.has("TICKETING") && (() => {
                        const ticketingActive =
                          location.pathname.startsWith(`${base}/it/tickets`) || location.pathname === `${base}/it/categories`;
                        const ticketingExpanded = isGroupExpanded("it.ticketing", ticketingActive);
                        return (
                          <>
                            <GroupHeader
                              to={`${base}/it/tickets`}
                              icon={MODULE_INFO.TICKETING.icon}
                              label="Ticketing"
                              active={location.pathname.startsWith(`${base}/it/tickets`)}
                              expanded={ticketingExpanded}
                              onToggle={() => toggleGroup("it.ticketing")}
                            />
                            {ticketingExpanded && (
                              <div className="ml-4 space-y-1 border-l border-border pl-2">
                                <Link
                                  to={`${base}/it/tickets`}
                                  className={cn(
                                    "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                    location.pathname.startsWith(`${base}/it/tickets`)
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                  )}
                                >
                                  Tickets
                                </Link>
                                {hasPermission(PERMISSIONS.ADMIN_IT_CATEGORIES_MANAGE) && (
                                  <Link
                                    to={`${base}/it/categories`}
                                    className={cn(
                                      "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                      location.pathname === `${base}/it/categories`
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                  >
                                    Categories
                                  </Link>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Inventory is its own toggleable module (Platform Superadmin
                          controls it independently of Ticketing), so it's gated on
                          enabledModules separately even though it's presented nested
                          in the same IT group. */}
                      {enabledModules.has("INVENTORY") && hasPermission(PERMISSIONS.IT_INVENTORY_VIEW) && (() => {
                        const inventoryActive = location.pathname.startsWith(`${base}/it/inventory`);
                        const inventoryExpanded = isGroupExpanded("it.inventory", inventoryActive);
                        return (
                          <>
                            <GroupHeader
                              to={`${base}/it/inventory`}
                              icon={Boxes}
                              label="Inventory"
                              active={location.pathname === `${base}/it/inventory`}
                              expanded={inventoryExpanded}
                              onToggle={() => toggleGroup("it.inventory")}
                            />
                            {inventoryExpanded && (
                              <div className="ml-4 space-y-1 border-l border-border pl-2">
                                {INVENTORY_NAV.filter((s) => hasPermission(s.permission)).map((s) => (
                                  <Link
                                    key={s.path}
                                    to={`${base}/it/inventory/${s.path}`}
                                    className={cn(
                                      "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                      location.pathname === `${base}/it/inventory/${s.path}`
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                  >
                                    {s.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Budget & Procurement share one PROCUREMENT module toggle
                          (they're tightly coupled -- a company without Procurement
                          has no use for a standalone IT Budget tracker), but each
                          section still checks its own permission set independently. */}
                      {enabledModules.has("PROCUREMENT") && hasPermission(PERMISSIONS.IT_BUDGET_VIEW) && (() => {
                        const budgetActive = location.pathname.startsWith(`${base}/it/budget`);
                        const budgetExpanded = isGroupExpanded("it.budget", budgetActive);
                        return (
                          <>
                            <GroupHeader
                              to={`${base}/it/budget`}
                              icon={Wallet}
                              label="Budget"
                              active={location.pathname === `${base}/it/budget`}
                              expanded={budgetExpanded}
                              onToggle={() => toggleGroup("it.budget")}
                            />
                            {budgetExpanded && (
                              <div className="ml-4 space-y-1 border-l border-border pl-2">
                                {BUDGET_NAV.filter((s) => s.path !== "" && hasPermission(s.permission)).map((s) => (
                                  <Link
                                    key={s.path}
                                    to={`${base}/it/budget/${s.path}`}
                                    className={cn(
                                      "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                      location.pathname.startsWith(`${base}/it/budget/${s.path}`)
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                  >
                                    {s.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {enabledModules.has("PROCUREMENT") && hasPermission(PERMISSIONS.IT_PROCUREMENT_VIEW) && (() => {
                        const procurementActive =
                          location.pathname.startsWith(`${base}/it/procurement`) || location.pathname === `${base}/it/reports`;
                        const procurementExpanded = isGroupExpanded("it.procurement", procurementActive);
                        return (
                          <>
                            <GroupHeader
                              to={`${base}/it/procurement`}
                              icon={ShoppingCart}
                              label="Procurement"
                              active={location.pathname === `${base}/it/procurement`}
                              expanded={procurementExpanded}
                              onToggle={() => toggleGroup("it.procurement")}
                            />
                            {procurementExpanded && (
                              <div className="ml-4 space-y-1 border-l border-border pl-2">
                                {PROCUREMENT_NAV.filter((s) => s.path !== "" && hasPermission(s.permission)).map((s) => (
                                  <Link
                                    key={s.path}
                                    to={`${base}/it/procurement/${s.path}`}
                                    className={cn(
                                      "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                      location.pathname.startsWith(`${base}/it/procurement/${s.path}`)
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                  >
                                    {s.label}
                                  </Link>
                                ))}
                                <Link
                                  to={`${base}/it/reports`}
                                  className={cn(
                                    "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                    location.pathname === `${base}/it/reports`
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                  )}
                                >
                                  Reports
                                </Link>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              );
            })()}

            {(enabledModules.has("HR_EMPLOYEES") || enabledModules.has("HR_ATTENDANCE_LEAVE") || enabledModules.has("HR_PAYROLL")) &&
              hasPermission(PERMISSIONS.HR_DASHBOARD_VIEW) && (() => {
                const hrActive = location.pathname.startsWith(`${base}/hr`);
                const hrExpanded = isGroupExpanded("hr", hrActive);
                return (
                  <>
                    <GroupHeader
                      to={`${base}/hr`}
                      icon={Users}
                      label="HR"
                      active={location.pathname === `${base}/hr`}
                      expanded={hrExpanded}
                      onToggle={() => toggleGroup("hr")}
                    />
                    {hrExpanded && (
                      <div className="ml-4 space-y-1 border-l border-border pl-2">
                        {HR_NAV.filter((s) => hasPermission(s.permission) && enabledModules.has(s.moduleKey)).map((s) => (
                          <Link
                            key={s.path}
                            to={`${base}/hr/${s.path}`}
                            className={cn(
                              "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                              location.pathname.startsWith(`${base}/hr/${s.path}`)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            {s.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

            {(enabledModules.has("FINANCE_ACCOUNTING") || enabledModules.has("FINANCE_AP") || enabledModules.has("FINANCE_AR") ||
              enabledModules.has("FINANCE_EXPENSES") || enabledModules.has("FINANCE_BANK") || enabledModules.has("FINANCE_PAYROLL")) &&
              hasPermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW) && (() => {
                const financeActive = location.pathname.startsWith(`${base}/finance`);
                const financeExpanded = isGroupExpanded("finance", financeActive);
                return (
                  <>
                    <GroupHeader
                      to={`${base}/finance`}
                      icon={MODULE_INFO.FINANCE.icon}
                      label="Finance"
                      active={location.pathname === `${base}/finance`}
                      expanded={financeExpanded}
                      onToggle={() => toggleGroup("finance")}
                    />
                    {financeExpanded && (
                      <div className="ml-4 space-y-1 border-l border-border pl-2">
                        {FINANCE_NAV.filter((s) => hasPermission(s.permission) && enabledModules.has(s.moduleKey)).map((s) => (
                          <Link
                            key={s.path}
                            to={`${base}/finance/${s.path}`}
                            className={cn(
                              "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                              location.pathname.startsWith(`${base}/finance/${s.path}`)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            {s.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

            {MODULE_NAV.filter((m) => enabledModules.has(m.key)).map((m) => (
              <NavLink
                key={m.key}
                to={`${base}/${m.path}`}
                icon={m.icon}
                label={m.label}
                active={location.pathname.startsWith(`${base}/${m.path}`)}
              />
            ))}

            {SETTINGS_NAV.some((s) => s.permissions.some(hasPermission)) && (
              <>
                <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Settings
                </p>
                {SETTINGS_NAV.filter((s) => s.permissions.some(hasPermission)).map((s) => (
                  <NavLink
                    key={s.path}
                    to={`${base}/${s.path}`}
                    icon={s.icon}
                    label={s.label}
                    active={location.pathname.startsWith(`${base}/${s.path}`)}
                  />
                ))}
              </>
            )}
          </nav>

          <div className="border-t border-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {displayName || user?.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`${base}/account`)}>
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/company")}>
                  Switch company
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate(`${base}/login`);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  active,
  className,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

// A module group's header row: the label still navigates to that module's
// overview page like before, but now shares the row with a dedicated
// chevron button that only collapses/expands the nested list -- clicking
// the chevron never navigates, and clicking the label never collapses.
function GroupHeader({
  to,
  icon,
  label,
  active,
  expanded,
  onToggle,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <NavLink to={to} icon={icon} label={label} active={active} className="flex-1" />
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")} />
      </button>
    </div>
  );
}
