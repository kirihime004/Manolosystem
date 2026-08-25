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
  "ADMIN", "ADMIN_REQUESTS", "ADMIN_FACILITIES", "ADMIN_SUPPLIES", "ADMIN_ASSETS",
  "ADMIN_VEHICLES", "ADMIN_TRAVEL", "ADMIN_VISITORS", "ADMIN_EVENTS", "ADMIN_CONTRACTS", "ADMIN_COMMS",
  "PRODUCTION", "PRODUCTION_PROJECTS", "PRODUCTION_SHOTS", "PRODUCTION_ASSETS", "PRODUCTION_TASKS",
  "PRODUCTION_SCHEDULE", "PRODUCTION_VERSIONS", "PRODUCTION_DELIVERABLES", "PRODUCTION_RESOURCES",
];

// Split by sub-module (matching AppRouter's own ADMIN_REQUESTS/
// ADMIN_FACILITIES/... route groups) instead of one flat list, so the
// sidebar can render each as its own collapsible group -- same treatment
// IT/HR/Finance already got. Settings (request categories) is tied to
// ADMIN_REQUESTS, the same way Finance ties its Settings tab to
// FINANCE_ACCOUNTING rather than inventing an eleventh leaf for it.
const ADMIN_REQUESTS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Requests", path: "requests", permission: PERMISSIONS.ADMIN_REQUESTS_VIEW },
  { label: "Settings", path: "settings", permission: PERMISSIONS.ADMIN_SETTINGS_MANAGE },
];

const ADMIN_FACILITIES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Facilities", path: "facilities", permission: PERMISSIONS.ADMIN_FACILITIES_VIEW },
  { label: "Rooms", path: "rooms", permission: PERMISSIONS.ADMIN_ROOMS_VIEW },
  { label: "Room Bookings", path: "rooms/bookings", permission: PERMISSIONS.ADMIN_ROOMS_VIEW },
  { label: "Workspaces", path: "workspaces", permission: PERMISSIONS.ADMIN_WORKSPACES_VIEW },
];

const ADMIN_SUPPLIES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Office Supplies", path: "supplies", permission: PERMISSIONS.ADMIN_SUPPLIES_VIEW },
  { label: "Supply Requests", path: "supplies/requests", permission: PERMISSIONS.ADMIN_SUPPLIES_VIEW },
];

const ADMIN_ASSETS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Administrative Assets", path: "assets", permission: PERMISSIONS.ADMIN_ASSETS_VIEW },
  { label: "Maintenance", path: "maintenance", permission: PERMISSIONS.ADMIN_MAINTENANCE_VIEW },
];

const ADMIN_VEHICLES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Vehicles", path: "vehicles", permission: PERMISSIONS.ADMIN_VEHICLES_VIEW },
];

const ADMIN_TRAVEL_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Travel", path: "travel", permission: PERMISSIONS.ADMIN_TRAVEL_VIEW },
];

const ADMIN_VISITORS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Visitors", path: "visitors", permission: PERMISSIONS.ADMIN_VISITORS_VIEW },
  { label: "Meetings", path: "meetings", permission: PERMISSIONS.ADMIN_MEETINGS_VIEW },
];

const ADMIN_EVENTS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Events", path: "events", permission: PERMISSIONS.ADMIN_EVENTS_VIEW },
];

const ADMIN_CONTRACTS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Contracts", path: "contracts", permission: PERMISSIONS.ADMIN_CONTRACTS_VIEW },
  { label: "Documents", path: "documents", permission: PERMISSIONS.ADMIN_DOCUMENTS_VIEW },
  { label: "Compliance", path: "compliance", permission: PERMISSIONS.ADMIN_COMPLIANCE_VIEW },
];

const ADMIN_COMMS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Announcements", path: "announcements", permission: PERMISSIONS.ADMIN_ANNOUNCEMENTS_VIEW },
  { label: "Courier / Mail", path: "courier", permission: PERMISSIONS.ADMIN_COURIER_VIEW },
];

// Split by sub-module (matching AppRouter's own PRODUCTION_PROJECTS/
// PRODUCTION_SHOTS/... route groups), same treatment every other
// multi-leaf module already got. Settings (task types, naming, custom
// fields, workflows, client access) is tied to PRODUCTION_PROJECTS, the
// same way Admin ties request categories to ADMIN_REQUESTS.
const PRODUCTION_PROJECTS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Projects", path: "projects", permission: PERMISSIONS.PRODUCTION_PROJECTS_VIEW },
  { label: "Settings", path: "settings", permission: PERMISSIONS.PRODUCTION_SETTINGS_MANAGE },
];

const PRODUCTION_SHOTS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Shots", path: "shots", permission: PERMISSIONS.PRODUCTION_SHOTS_VIEW },
];

const PRODUCTION_ASSETS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Assets", path: "assets", permission: PERMISSIONS.PRODUCTION_ASSETS_VIEW },
];

const PRODUCTION_TASKS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Task Board", path: "tasks", permission: PERMISSIONS.PRODUCTION_TASKS_VIEW },
];

const PRODUCTION_SCHEDULE_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Schedule", path: "schedule", permission: PERMISSIONS.PRODUCTION_MILESTONES_VIEW },
];

const PRODUCTION_VERSIONS_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Reviews", path: "reviews", permission: PERMISSIONS.PRODUCTION_REVIEWS_VIEW },
];

const PRODUCTION_DELIVERABLES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Deliverables", path: "deliverables", permission: PERMISSIONS.PRODUCTION_DELIVERABLES_VIEW },
];

const PRODUCTION_RESOURCES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Resources", path: "resources", permission: PERMISSIONS.PRODUCTION_RESOURCES_VIEW },
];

const MODULE_NAV = (Object.entries(MODULE_INFO) as [ModuleKey, (typeof MODULE_INFO)[ModuleKey]][])
  .filter(([key]) => !NESTED_MODULE_KEYS.includes(key)) // each gets its own nested nav block below
  .map(([key, info]) => ({ key, label: info.label, icon: info.icon, path: info.path }));

// Split by sub-module (matching AppRouter's own HR_EMPLOYEES/
// HR_ATTENDANCE_LEAVE/HR_PAYROLL route groups) instead of one flat list,
// so the sidebar can render each as its own collapsible group -- same
// treatment IT's Ticketing/Inventory/Budget/Procurement already got.
const HR_EMPLOYEES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Employees", path: "employees", permission: PERMISSIONS.HR_EMPLOYEES_VIEW },
  { label: "Departments", path: "organization/departments", permission: PERMISSIONS.HR_DEPARTMENTS_VIEW },
  { label: "Positions", path: "organization/positions", permission: PERMISSIONS.HR_POSITIONS_VIEW },
  { label: "Org Chart", path: "organization/chart", permission: PERMISSIONS.HR_EMPLOYEES_VIEW },
  { label: "Employee Requests", path: "requests", permission: PERMISSIONS.HR_REQUESTS_VIEW },
  { label: "Documents", path: "documents", permission: PERMISSIONS.HR_DOCUMENTS_VIEW },
  { label: "Contracts", path: "contracts", permission: PERMISSIONS.HR_CONTRACTS_VIEW },
  { label: "Reports", path: "reports", permission: PERMISSIONS.HR_REPORTS_VIEW },
  { label: "Settings", path: "settings", permission: PERMISSIONS.HR_SETTINGS_MANAGE },
];

const HR_ATTENDANCE_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Attendance", path: "attendance", permission: PERMISSIONS.HR_ATTENDANCE_VIEW },
  { label: "Leave", path: "leave", permission: PERMISSIONS.HR_LEAVE_VIEW },
  { label: "Overtime", path: "overtime", permission: PERMISSIONS.HR_OVERTIME_VIEW },
  { label: "Timesheets", path: "timesheets", permission: PERMISSIONS.HR_TIMESHEETS_VIEW },
];

const HR_PAYROLL_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Benefits", path: "benefits", permission: PERMISSIONS.HR_BENEFITS_VIEW },
  { label: "Deductions", path: "deductions", permission: PERMISSIONS.HR_DEDUCTIONS_VIEW },
  { label: "Payroll", path: "payroll", permission: PERMISSIONS.HR_PAYROLL_VIEW },
];

// Split by sub-module (matching AppRouter's own FINANCE_ACCOUNTING/
// FINANCE_AP/FINANCE_AR/FINANCE_EXPENSES/FINANCE_BANK/FINANCE_PAYROLL
// route groups) instead of one flat list, so the sidebar can render each
// as its own collapsible group -- same treatment IT and HR already got.
const FINANCE_ACCOUNTING_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Chart of Accounts", path: "accounting/chart-of-accounts", permission: PERMISSIONS.FINANCE_ACCOUNTS_VIEW },
  { label: "Journal Entries", path: "accounting/journals", permission: PERMISSIONS.FINANCE_JOURNALS_VIEW },
  { label: "General Ledger", path: "accounting/general-ledger", permission: PERMISSIONS.FINANCE_GL_VIEW },
  { label: "Trial Balance", path: "accounting/trial-balance", permission: PERMISSIONS.FINANCE_TRIAL_BALANCE_VIEW },
  { label: "Reports", path: "reports", permission: PERMISSIONS.FINANCE_REPORTS_VIEW },
  { label: "Settings", path: "settings", permission: PERMISSIONS.FINANCE_SETTINGS_MANAGE },
];

const FINANCE_AP_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Bills", path: "ap/bills", permission: PERMISSIONS.FINANCE_AP_VIEW },
  { label: "AP Aging", path: "ap/aging", permission: PERMISSIONS.FINANCE_AP_VIEW },
];

const FINANCE_AR_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Customers", path: "ar/customers", permission: PERMISSIONS.FINANCE_CUSTOMERS_VIEW },
  { label: "Invoices", path: "ar/invoices", permission: PERMISSIONS.FINANCE_AR_VIEW },
  { label: "AR Aging", path: "ar/aging", permission: PERMISSIONS.FINANCE_AR_VIEW },
];

const FINANCE_EXPENSES_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Expenses", path: "expenses", permission: PERMISSIONS.FINANCE_EXPENSES_VIEW },
];

const FINANCE_BANK_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Cash & Bank", path: "cash-bank", permission: PERMISSIONS.FINANCE_BANK_VIEW },
];

const FINANCE_PAYROLL_NAV: { label: string; path: string; permission: string }[] = [
  { label: "Payroll", path: "payroll", permission: PERMISSIONS.FINANCE_PAYROLL_VIEW },
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

  // Finance has six parallel leaf sub-modules (vs. IT/HR's three each), so
  // rendering each as its own collapsible group inline would repeat the
  // same ~25 lines six times. This closure captures the same base/
  // location/hasPermission/enabledModules/isGroupExpanded/toggleGroup the
  // inline IT/HR groups use, just parameterized per Finance section.
  const renderFinanceGroup = (opts: {
    storageKey: string;
    moduleKey: ModuleKey;
    to: string;
    icon: LucideIcon;
    label: string;
    items: { label: string; path: string; permission: string }[];
  }) => {
    if (!enabledModules.has(opts.moduleKey)) return null;
    const active = opts.items.some((s) => location.pathname.startsWith(`${base}/finance/${s.path}`));

    // A single-item group has nothing to collapse -- the group header and
    // its one nested link would just be the same destination twice. Render
    // it as a plain flat link instead, like every other one-page module.
    if (opts.items.length === 1) {
      const only = opts.items[0];
      if (!hasPermission(only.permission)) return null;
      return <NavLink key={opts.storageKey} to={`${base}/finance/${only.path}`} icon={opts.icon} label={opts.label} active={active} />;
    }

    const expanded = isGroupExpanded(opts.storageKey, active);
    return (
      <div key={opts.storageKey}>
        <GroupHeader
          to={`${base}/finance/${opts.to}`}
          icon={opts.icon}
          label={opts.label}
          active={active}
          expanded={expanded}
          onToggle={() => toggleGroup(opts.storageKey)}
        />
        {expanded && (
          <div className="ml-4 space-y-1 border-l border-border pl-2">
            {opts.items.filter((s) => hasPermission(s.permission)).map((s) => (
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
      </div>
    );
  };

  // Same shape as renderFinanceGroup, parameterized for /admin instead of
  // /finance -- Administration has ten parallel leaf sub-modules (more
  // than Finance's six), so this closure is even more load-bearing here.
  const renderAdminGroup = (opts: {
    storageKey: string;
    moduleKey: ModuleKey;
    to: string;
    icon: LucideIcon;
    label: string;
    items: { label: string; path: string; permission: string }[];
  }) => {
    if (!enabledModules.has(opts.moduleKey)) return null;
    const active = opts.items.some((s) => location.pathname.startsWith(`${base}/admin/${s.path}`));

    if (opts.items.length === 1) {
      const only = opts.items[0];
      if (!hasPermission(only.permission)) return null;
      return <NavLink key={opts.storageKey} to={`${base}/admin/${only.path}`} icon={opts.icon} label={opts.label} active={active} />;
    }

    const expanded = isGroupExpanded(opts.storageKey, active);
    return (
      <div key={opts.storageKey}>
        <GroupHeader
          to={`${base}/admin/${opts.to}`}
          icon={opts.icon}
          label={opts.label}
          active={active}
          expanded={expanded}
          onToggle={() => toggleGroup(opts.storageKey)}
        />
        {expanded && (
          <div className="ml-4 space-y-1 border-l border-border pl-2">
            {opts.items.filter((s) => hasPermission(s.permission)).map((s) => (
              <Link
                key={s.path}
                to={`${base}/admin/${s.path}`}
                className={cn(
                  "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  location.pathname.startsWith(`${base}/admin/${s.path}`)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Same shape again, parameterized for /production.
  const renderProductionGroup = (opts: {
    storageKey: string;
    moduleKey: ModuleKey;
    to: string;
    icon: LucideIcon;
    label: string;
    items: { label: string; path: string; permission: string }[];
  }) => {
    if (!enabledModules.has(opts.moduleKey)) return null;
    const active = opts.items.some((s) => location.pathname.startsWith(`${base}/production/${s.path}`));

    if (opts.items.length === 1) {
      const only = opts.items[0];
      if (!hasPermission(only.permission)) return null;
      return <NavLink key={opts.storageKey} to={`${base}/production/${only.path}`} icon={opts.icon} label={opts.label} active={active} />;
    }

    const expanded = isGroupExpanded(opts.storageKey, active);
    return (
      <div key={opts.storageKey}>
        <GroupHeader
          to={`${base}/production/${opts.to}`}
          icon={opts.icon}
          label={opts.label}
          active={active}
          expanded={expanded}
          onToggle={() => toggleGroup(opts.storageKey)}
        />
        {expanded && (
          <div className="ml-4 space-y-1 border-l border-border pl-2">
            {opts.items.filter((s) => hasPermission(s.permission)).map((s) => (
              <Link
                key={s.path}
                to={`${base}/production/${s.path}`}
                className={cn(
                  "block truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  location.pathname.startsWith(`${base}/production/${s.path}`)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

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
                        {enabledModules.has("HR_EMPLOYEES") && (() => {
                          const employeesActive = HR_EMPLOYEES_NAV.some((s) => location.pathname.startsWith(`${base}/hr/${s.path}`));
                          const employeesExpanded = isGroupExpanded("hr.employees", employeesActive);
                          return (
                            <>
                              <GroupHeader
                                to={`${base}/hr/employees`}
                                icon={MODULE_INFO.HR_EMPLOYEES.icon}
                                label="Employees"
                                active={location.pathname.startsWith(`${base}/hr/employees`)}
                                expanded={employeesExpanded}
                                onToggle={() => toggleGroup("hr.employees")}
                              />
                              {employeesExpanded && (
                                <div className="ml-4 space-y-1 border-l border-border pl-2">
                                  {HR_EMPLOYEES_NAV.filter((s) => hasPermission(s.permission)).map((s) => (
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

                        {enabledModules.has("HR_ATTENDANCE_LEAVE") && (() => {
                          const attendanceActive = HR_ATTENDANCE_NAV.some((s) => location.pathname.startsWith(`${base}/hr/${s.path}`));
                          const attendanceExpanded = isGroupExpanded("hr.attendance", attendanceActive);
                          return (
                            <>
                              <GroupHeader
                                to={`${base}/hr/attendance`}
                                icon={MODULE_INFO.HR_ATTENDANCE_LEAVE.icon}
                                label="Attendance & Leave"
                                active={location.pathname.startsWith(`${base}/hr/attendance`)}
                                expanded={attendanceExpanded}
                                onToggle={() => toggleGroup("hr.attendance")}
                              />
                              {attendanceExpanded && (
                                <div className="ml-4 space-y-1 border-l border-border pl-2">
                                  {HR_ATTENDANCE_NAV.filter((s) => hasPermission(s.permission)).map((s) => (
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

                        {enabledModules.has("HR_PAYROLL") && (() => {
                          const payrollActive = HR_PAYROLL_NAV.some((s) => location.pathname.startsWith(`${base}/hr/${s.path}`));
                          const payrollExpanded = isGroupExpanded("hr.payroll", payrollActive);
                          return (
                            <>
                              <GroupHeader
                                to={`${base}/hr/benefits`}
                                icon={MODULE_INFO.HR_PAYROLL.icon}
                                label="Payroll & Benefits"
                                active={location.pathname.startsWith(`${base}/hr/benefits`) || location.pathname.startsWith(`${base}/hr/deductions`) || location.pathname.startsWith(`${base}/hr/payroll`)}
                                expanded={payrollExpanded}
                                onToggle={() => toggleGroup("hr.payroll")}
                              />
                              {payrollExpanded && (
                                <div className="ml-4 space-y-1 border-l border-border pl-2">
                                  {HR_PAYROLL_NAV.filter((s) => hasPermission(s.permission)).map((s) => (
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
                        {renderFinanceGroup({
                          storageKey: "finance.accounting",
                          moduleKey: "FINANCE_ACCOUNTING",
                          to: "accounting/chart-of-accounts",
                          icon: MODULE_INFO.FINANCE_ACCOUNTING.icon,
                          label: "Accounting",
                          items: FINANCE_ACCOUNTING_NAV,
                        })}
                        {renderFinanceGroup({
                          storageKey: "finance.ap",
                          moduleKey: "FINANCE_AP",
                          to: "ap/bills",
                          icon: MODULE_INFO.FINANCE_AP.icon,
                          label: "Accounts Payable",
                          items: FINANCE_AP_NAV,
                        })}
                        {renderFinanceGroup({
                          storageKey: "finance.ar",
                          moduleKey: "FINANCE_AR",
                          to: "ar/customers",
                          icon: MODULE_INFO.FINANCE_AR.icon,
                          label: "Accounts Receivable",
                          items: FINANCE_AR_NAV,
                        })}
                        {renderFinanceGroup({
                          storageKey: "finance.expenses",
                          moduleKey: "FINANCE_EXPENSES",
                          to: "expenses",
                          icon: MODULE_INFO.FINANCE_EXPENSES.icon,
                          label: "Expenses",
                          items: FINANCE_EXPENSES_NAV,
                        })}
                        {renderFinanceGroup({
                          storageKey: "finance.bank",
                          moduleKey: "FINANCE_BANK",
                          to: "cash-bank",
                          icon: MODULE_INFO.FINANCE_BANK.icon,
                          label: "Cash & Bank",
                          items: FINANCE_BANK_NAV,
                        })}
                        {renderFinanceGroup({
                          storageKey: "finance.payroll",
                          moduleKey: "FINANCE_PAYROLL",
                          to: "payroll",
                          icon: MODULE_INFO.FINANCE_PAYROLL.icon,
                          label: "Payroll",
                          items: FINANCE_PAYROLL_NAV,
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

            {(enabledModules.has("ADMIN_REQUESTS") || enabledModules.has("ADMIN_FACILITIES") || enabledModules.has("ADMIN_SUPPLIES") ||
              enabledModules.has("ADMIN_ASSETS") || enabledModules.has("ADMIN_VEHICLES") || enabledModules.has("ADMIN_TRAVEL") ||
              enabledModules.has("ADMIN_VISITORS") || enabledModules.has("ADMIN_EVENTS") || enabledModules.has("ADMIN_CONTRACTS") ||
              enabledModules.has("ADMIN_COMMS")) &&
              hasPermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW) && (() => {
              const adminActive = location.pathname.startsWith(`${base}/admin`);
              const adminExpanded = isGroupExpanded("admin", adminActive);
              return (
                <>
                  <GroupHeader
                    to={`${base}/admin`}
                    icon={MODULE_INFO.ADMIN.icon}
                    label="Administration"
                    active={location.pathname === `${base}/admin`}
                    expanded={adminExpanded}
                    onToggle={() => toggleGroup("admin")}
                  />
                  {adminExpanded && (
                    <div className="ml-4 space-y-1 border-l border-border pl-2">
                      {renderAdminGroup({
                        storageKey: "admin.requests",
                        moduleKey: "ADMIN_REQUESTS",
                        to: "requests",
                        icon: MODULE_INFO.ADMIN_REQUESTS.icon,
                        label: "Requests",
                        items: ADMIN_REQUESTS_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.facilities",
                        moduleKey: "ADMIN_FACILITIES",
                        to: "facilities",
                        icon: MODULE_INFO.ADMIN_FACILITIES.icon,
                        label: "Facilities",
                        items: ADMIN_FACILITIES_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.supplies",
                        moduleKey: "ADMIN_SUPPLIES",
                        to: "supplies",
                        icon: MODULE_INFO.ADMIN_SUPPLIES.icon,
                        label: "Office Supplies",
                        items: ADMIN_SUPPLIES_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.assets",
                        moduleKey: "ADMIN_ASSETS",
                        to: "assets",
                        icon: MODULE_INFO.ADMIN_ASSETS.icon,
                        label: "Administrative Assets",
                        items: ADMIN_ASSETS_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.vehicles",
                        moduleKey: "ADMIN_VEHICLES",
                        to: "vehicles",
                        icon: MODULE_INFO.ADMIN_VEHICLES.icon,
                        label: "Vehicles",
                        items: ADMIN_VEHICLES_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.travel",
                        moduleKey: "ADMIN_TRAVEL",
                        to: "travel",
                        icon: MODULE_INFO.ADMIN_TRAVEL.icon,
                        label: "Travel",
                        items: ADMIN_TRAVEL_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.visitors",
                        moduleKey: "ADMIN_VISITORS",
                        to: "visitors",
                        icon: MODULE_INFO.ADMIN_VISITORS.icon,
                        label: "Visitors",
                        items: ADMIN_VISITORS_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.events",
                        moduleKey: "ADMIN_EVENTS",
                        to: "events",
                        icon: MODULE_INFO.ADMIN_EVENTS.icon,
                        label: "Events",
                        items: ADMIN_EVENTS_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.contracts",
                        moduleKey: "ADMIN_CONTRACTS",
                        to: "contracts",
                        icon: MODULE_INFO.ADMIN_CONTRACTS.icon,
                        label: "Contracts",
                        items: ADMIN_CONTRACTS_NAV,
                      })}
                      {renderAdminGroup({
                        storageKey: "admin.comms",
                        moduleKey: "ADMIN_COMMS",
                        to: "announcements",
                        icon: MODULE_INFO.ADMIN_COMMS.icon,
                        label: "Announcements & Courier",
                        items: ADMIN_COMMS_NAV,
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {(enabledModules.has("PRODUCTION_PROJECTS") || enabledModules.has("PRODUCTION_SHOTS") || enabledModules.has("PRODUCTION_ASSETS") ||
              enabledModules.has("PRODUCTION_TASKS") || enabledModules.has("PRODUCTION_SCHEDULE") || enabledModules.has("PRODUCTION_VERSIONS") ||
              enabledModules.has("PRODUCTION_DELIVERABLES") || enabledModules.has("PRODUCTION_RESOURCES")) &&
              hasPermission(PERMISSIONS.PRODUCTION_DASHBOARD_VIEW) && (() => {
              const productionActive = location.pathname.startsWith(`${base}/production`);
              const productionExpanded = isGroupExpanded("production", productionActive);
              return (
                <>
                  <GroupHeader
                    to={`${base}/production`}
                    icon={MODULE_INFO.PRODUCTION.icon}
                    label="Production"
                    active={location.pathname === `${base}/production`}
                    expanded={productionExpanded}
                    onToggle={() => toggleGroup("production")}
                  />
                  {productionExpanded && (
                    <div className="ml-4 space-y-1 border-l border-border pl-2">
                      {renderProductionGroup({
                        storageKey: "production.projects",
                        moduleKey: "PRODUCTION_PROJECTS",
                        to: "projects",
                        icon: MODULE_INFO.PRODUCTION_PROJECTS.icon,
                        label: "Projects",
                        items: PRODUCTION_PROJECTS_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.shots",
                        moduleKey: "PRODUCTION_SHOTS",
                        to: "shots",
                        icon: MODULE_INFO.PRODUCTION_SHOTS.icon,
                        label: "Shots",
                        items: PRODUCTION_SHOTS_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.assets",
                        moduleKey: "PRODUCTION_ASSETS",
                        to: "assets",
                        icon: MODULE_INFO.PRODUCTION_ASSETS.icon,
                        label: "Assets",
                        items: PRODUCTION_ASSETS_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.tasks",
                        moduleKey: "PRODUCTION_TASKS",
                        to: "tasks",
                        icon: MODULE_INFO.PRODUCTION_TASKS.icon,
                        label: "Tasks",
                        items: PRODUCTION_TASKS_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.schedule",
                        moduleKey: "PRODUCTION_SCHEDULE",
                        to: "schedule",
                        icon: MODULE_INFO.PRODUCTION_SCHEDULE.icon,
                        label: "Schedule",
                        items: PRODUCTION_SCHEDULE_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.versions",
                        moduleKey: "PRODUCTION_VERSIONS",
                        to: "reviews",
                        icon: MODULE_INFO.PRODUCTION_VERSIONS.icon,
                        label: "Reviews",
                        items: PRODUCTION_VERSIONS_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.deliverables",
                        moduleKey: "PRODUCTION_DELIVERABLES",
                        to: "deliverables",
                        icon: MODULE_INFO.PRODUCTION_DELIVERABLES.icon,
                        label: "Deliverables",
                        items: PRODUCTION_DELIVERABLES_NAV,
                      })}
                      {renderProductionGroup({
                        storageKey: "production.resources",
                        moduleKey: "PRODUCTION_RESOURCES",
                        to: "resources",
                        icon: MODULE_INFO.PRODUCTION_RESOURCES.icon,
                        label: "Resources",
                        items: PRODUCTION_RESOURCES_NAV,
                      })}
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
