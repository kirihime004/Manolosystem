import { type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  LogOut,
  ChevronsUpDown,
  UserCog,
  ShieldCheck,
  Palette,
  BookOpen,
  Inbox,
  Boxes,
  FolderTree,
  Wallet,
  ShoppingCart,
  BarChart3,
  Coins,
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

const MODULE_NAV = (Object.entries(MODULE_INFO) as [ModuleKey, (typeof MODULE_INFO)[ModuleKey]][])
  .filter(([key]) => key !== "IT" && key !== "INVENTORY" && key !== "PROCUREMENT") // each gets its own nested nav block below
  .map(([key, info]) => ({ key, label: info.label, icon: info.icon, path: info.path }));

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
            {enabledModules.has("IT") && (
              <>
                <NavLink
                  to={`${base}/it`}
                  icon={MODULE_INFO.IT.icon}
                  label="Ticketing"
                  active={location.pathname === `${base}/it`}
                />
                <NavLink
                  to={`${base}/it/tickets`}
                  icon={Inbox}
                  label="Tickets"
                  active={location.pathname.startsWith(`${base}/it/tickets`)}
                />

                {hasPermission(PERMISSIONS.ADMIN_IT_CATEGORIES_MANAGE) && (
                  <NavLink
                    to={`${base}/it/categories`}
                    icon={FolderTree}
                    label="Categories"
                    active={location.pathname === `${base}/it/categories`}
                  />
                )}
              </>
            )}

            {/* Inventory is its own toggleable module (Platform Superadmin controls
                it independently of Ticketing), so it's gated on enabledModules
                separately even though it's presented nested in the same area. */}
            {enabledModules.has("INVENTORY") && hasPermission(PERMISSIONS.IT_INVENTORY_VIEW) && (
              <>
                <NavLink
                  to={`${base}/it/inventory`}
                  icon={Boxes}
                  label="Inventory"
                  active={location.pathname === `${base}/it/inventory`}
                />
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
              </>
            )}

            {/* Budget & Procurement share one PROCUREMENT module toggle (they're
                tightly coupled -- a company without Procurement has no use for
                a standalone IT Budget tracker), but each section still checks
                its own permission set independently. */}
            {enabledModules.has("PROCUREMENT") && hasPermission(PERMISSIONS.IT_BUDGET_VIEW) && (
              <>
                <NavLink
                  to={`${base}/it/budget`}
                  icon={Wallet}
                  label="Budget"
                  active={location.pathname === `${base}/it/budget`}
                />
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
              </>
            )}

            {enabledModules.has("PROCUREMENT") && hasPermission(PERMISSIONS.IT_PROCUREMENT_VIEW) && (
              <>
                <NavLink
                  to={`${base}/it/procurement`}
                  icon={ShoppingCart}
                  label="Procurement"
                  active={location.pathname === `${base}/it/procurement`}
                />
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
                </div>
                <NavLink
                  to={`${base}/it/reports`}
                  icon={BarChart3}
                  label="Reports"
                  active={location.pathname === `${base}/it/reports`}
                />
              </>
            )}

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
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
