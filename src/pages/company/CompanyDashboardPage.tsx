import { Link, useParams } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Ticket as TicketIcon,
  Flame,
  Clock,
  CheckCircle2,
  MessageSquare,
  ArrowRightCircle,
  ArrowRight,
  Boxes,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useMyProfile } from "@/lib/auth/useMyProfile";
import { useAuth } from "@/lib/auth/useAuth";
import { useCompanyUsersList } from "@/features/company/settings/useCompanyUsers";
import { useTicketDashboardStats, useMyTicketActivity } from "@/features/it/tickets/hooks";
import { useInventoryDashboardStats } from "@/features/it/inventory/hooks";
import { useProcurementDashboardStats } from "@/features/it/procurement/hooks";
import { useHrDashboardStats } from "@/features/hr/hooks";
import { useCashAccounts, useApAging, useArAging } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { useAdminDashboardSummary } from "@/features/admin/hooks";
import { useProductionDashboardSummary } from "@/features/production/hooks";
import { useCompanyAiContext, useOpenAlerts } from "@/features/ai/hooks";
import { MODULE_INFO } from "@/lib/modules/moduleInfo";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Money } from "@/components/shared/Money";
import type { AiHealthStatus } from "@/types/database";

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{value ?? 0}</p>}
      </CardContent>
    </Card>
  );
}

// One compact card per department the company actually has enabled --
// a handful of headline numbers plus a link into that department's own
// (already-comprehensive) dashboard for the full picture. This is the
// "make the dashboard usable" fix: previously only Team and Ticketing
// appeared here regardless of what else the company had turned on.
function ModuleOverviewCard({
  icon: Icon,
  title,
  description,
  href,
  stats,
  loading,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  stats: { label: string; value: React.ReactNode }[];
  loading: boolean;
}) {
  return (
    <Link to={href}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <div className="text-lg font-semibold text-foreground">{loading ? <Skeleton className="h-6 w-8" /> : s.value}</div>
                <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const HEALTH_DOT: Record<AiHealthStatus, string> = { GREEN: "bg-emerald-500", YELLOW: "bg-amber-500", RED: "bg-red-500" };
const HEALTH_LABEL: Record<AiHealthStatus, string> = { GREEN: "All clear", YELLOW: "Needs attention", RED: "Action needed" };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CompanyDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, enabledModules, hasPermission } = useCompany();
  const { data: profile } = useMyProfile();
  const { user } = useAuth();
  const base = `/c/${companySlug}`;

  const isAdmin = hasPermission(PERMISSIONS.ADMIN_USERS_MANAGE);
  const itEnabled = enabledModules.has("IT");
  const canViewAllTickets = hasPermission(PERMISSIONS.IT_TICKETS_VIEW);
  const inventoryVisible = itEnabled && enabledModules.has("INVENTORY") && hasPermission(PERMISSIONS.IT_INVENTORY_VIEW);
  const procurementVisible = itEnabled && enabledModules.has("PROCUREMENT") && hasPermission(PERMISSIONS.IT_PROCUREMENT_VIEW);
  const hrVisible = enabledModules.has("HR") && hasPermission(PERMISSIONS.HR_DASHBOARD_VIEW);
  const financeVisible = enabledModules.has("FINANCE") && hasPermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW);
  const adminDeptVisible = enabledModules.has("ADMIN") && hasPermission(PERMISSIONS.ADMIN_DASHBOARD_VIEW);
  const productionVisible = enabledModules.has("PRODUCTION") && hasPermission(PERMISSIONS.PRODUCTION_DASHBOARD_VIEW);
  const aiVisible = enabledModules.has("AI") && hasPermission(PERMISSIONS.AI_COMPANY_ANALYTICS_VIEW);
  const hasAnyDepartmentCard = inventoryVisible || procurementVisible || hrVisible || financeVisible || adminDeptVisible || productionVisible;

  const { data: users, isLoading: usersLoading } = useCompanyUsersList(isAdmin ? company?.id : undefined);
  const { data: stats, isLoading: ticketsLoading } = useTicketDashboardStats(itEnabled ? company?.id : undefined);
  const { data: activity, isLoading: activityLoading } = useMyTicketActivity(
    itEnabled && !canViewAllTickets ? company?.id : undefined,
    user?.id,
  );

  const { data: inventoryStats, isLoading: inventoryLoading } = useInventoryDashboardStats(inventoryVisible ? company?.id : undefined);
  const { data: procurementStats, isLoading: procurementLoading } = useProcurementDashboardStats(procurementVisible ? company?.id : undefined);
  const { data: hrStats, isLoading: hrLoading } = useHrDashboardStats(hrVisible ? company?.id : undefined);
  const { data: cashAccounts, isLoading: cashLoading } = useCashAccounts(financeVisible ? company?.id : undefined);
  const { data: apAging, isLoading: apLoading } = useApAging(financeVisible ? company?.id : undefined);
  const { data: arAging, isLoading: arLoading } = useArAging(financeVisible ? company?.id : undefined);
  const { data: currencySettings } = useCompanyCurrencySettings(financeVisible ? company?.id : undefined);
  const { data: adminSummary, isLoading: adminLoading } = useAdminDashboardSummary(adminDeptVisible ? company?.id : undefined);
  const { data: productionSummary, isLoading: productionLoading } = useProductionDashboardSummary(productionVisible ? company?.id : undefined);
  const { data: aiContext, isLoading: aiLoading } = useCompanyAiContext(aiVisible ? company?.id : undefined);
  const { data: openAlerts } = useOpenAlerts(aiVisible ? company?.id : undefined);

  const userStats = users
    ? {
        total: users.length,
        active: users.filter((u) => u.status === "ACTIVE").length,
        invited: users.filter((u) => u.status === "INVITED").length,
        disabled: users.filter((u) => u.status === "DISABLED").length,
      }
    : null;

  const financeCurrencyId = currencySettings?.base_currency_id;
  const cashBalance = (cashAccounts ?? []).reduce((sum, a) => sum + a.current_balance, 0);
  const arOutstanding = (arAging ?? []).reduce((sum, r) => sum + r.outstanding, 0);
  const apOutstanding = (apAging ?? []).reduce((sum, r) => sum + r.outstanding, 0);

  const hasAnyContent = isAdmin || itEnabled || hasAnyDepartmentCard || aiVisible;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{company?.name}</p>
        </div>
        <NotificationBell />
      </div>

      {!hasAnyContent && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing to show yet. Contact your company administrator.
          </CardContent>
        </Card>
      )}

      {aiVisible && (
        <Link to={`${base}/ai`}>
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              {aiLoading || !aiContext ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[aiContext.overall_status]}`} />
                    <span className="text-sm font-semibold text-foreground">Company health: {HEALTH_LABEL[aiContext.overall_status]}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(["it", "hr", "finance", "admin", "production"] as const).map((key) => (
                      <span key={key} className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[aiContext.modules[key].status]}`} />
                        {MODULE_INFO[key.toUpperCase() as keyof typeof MODULE_INFO]?.label ?? key}
                      </span>
                    ))}
                  </div>
                  {!!openAlerts?.length && (
                    <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400">{openAlerts.length} open alert{openAlerts.length === 1 ? "" : "s"}</span>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Team</h2>
            <Link
              to={`${base}/settings/users`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Manage users <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={Users} label="Total users" value={userStats?.total} loading={usersLoading} />
            <StatCard icon={UserCheck} label="Active" value={userStats?.active} loading={usersLoading} />
            <StatCard icon={UserPlus} label="Invited" value={userStats?.invited} loading={usersLoading} />
            <StatCard icon={UserX} label="Disabled" value={userStats?.disabled} loading={usersLoading} />
          </div>
        </div>
      )}

      {hasAnyDepartmentCard && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Departments</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inventoryVisible && (
              <ModuleOverviewCard
                icon={Boxes}
                title="Inventory"
                description="Hardware, software, and credentials"
                href={`${base}/it/inventory`}
                loading={inventoryLoading}
                stats={[
                  { label: "Total Assets", value: inventoryStats?.totalAssets ?? 0 },
                  { label: "Under Repair", value: inventoryStats?.underRepair ?? 0 },
                  { label: "Warranty Expiring", value: inventoryStats?.warrantyExpiring ?? 0 },
                ]}
              />
            )}
            {procurementVisible && (
              <ModuleOverviewCard
                icon={ShoppingCart}
                title="Procurement"
                description="Purchase requests, orders, and deliveries"
                href={`${base}/it/procurement`}
                loading={procurementLoading}
                stats={[
                  { label: "Pending Requests", value: procurementStats?.pendingRequests ?? 0 },
                  { label: "Open POs", value: procurementStats?.openPOs ?? 0 },
                  { label: "Overdue Deliveries", value: procurementStats?.overdueDeliveries ?? 0 },
                ]}
              />
            )}
            {hrVisible && (
              <ModuleOverviewCard
                icon={MODULE_INFO.HR.icon}
                title="HR"
                description="Employees, attendance, and payroll"
                href={`${base}/hr`}
                loading={hrLoading}
                stats={[
                  { label: "Employees", value: hrStats?.totalEmployees ?? 0 },
                  { label: "On Leave Today", value: hrStats?.employeesOnLeaveToday ?? 0 },
                  { label: "Pending Requests", value: hrStats?.pendingHrRequests ?? 0 },
                ]}
              />
            )}
            {financeVisible && (
              <ModuleOverviewCard
                icon={MODULE_INFO.FINANCE.icon}
                title="Finance"
                description="Cash, receivables, and payables"
                href={`${base}/finance`}
                loading={cashLoading || apLoading || arLoading}
                stats={[
                  { label: "Cash Balance", value: <Money amount={cashBalance} currencyId={financeCurrencyId} /> },
                  { label: "Receivable", value: <Money amount={arOutstanding} currencyId={financeCurrencyId} /> },
                  { label: "Payable", value: <Money amount={apOutstanding} currencyId={financeCurrencyId} /> },
                ]}
              />
            )}
            {adminDeptVisible && (
              <ModuleOverviewCard
                icon={MODULE_INFO.ADMIN.icon}
                title="Administration"
                description="Requests, facilities, and office operations"
                href={`${base}/admin`}
                loading={adminLoading}
                stats={[
                  { label: "Open Requests", value: adminSummary?.open_requests ?? 0 },
                  { label: "Pending Approvals", value: adminSummary?.pending_approvals ?? 0 },
                  { label: "Today's Meetings", value: adminSummary?.today_meetings ?? 0 },
                ]}
              />
            )}
            {productionVisible && (
              <ModuleOverviewCard
                icon={MODULE_INFO.PRODUCTION.icon}
                title="Production"
                description="Projects, tasks, and reviews"
                href={`${base}/production`}
                loading={productionLoading}
                stats={[
                  { label: "Active Projects", value: productionSummary?.active_projects ?? 0 },
                  { label: "Open Tasks", value: productionSummary?.open_tasks ?? 0 },
                  { label: "Pending Reviews", value: productionSummary?.pending_reviews ?? 0 },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {itEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Ticketing</h2>
            <Link
              to={`${base}/it`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open Ticketing <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {canViewAllTickets ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={TicketIcon} label="Open" value={stats?.open} loading={ticketsLoading} />
              <StatCard icon={Flame} label="Critical" value={stats?.critical} loading={ticketsLoading} />
              <StatCard icon={Clock} label="In Progress" value={stats?.inProgress} loading={ticketsLoading} />
              <StatCard icon={CheckCircle2} label="Resolved" value={stats?.resolved} loading={ticketsLoading} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard icon={TicketIcon} label="Open" value={stats?.active} loading={ticketsLoading} />
                <StatCard icon={CheckCircle2} label="Resolved" value={stats?.resolved} loading={ticketsLoading} />
                <StatCard icon={CheckCircle2} label="Closed" value={stats?.closed} loading={ticketsLoading} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent activity on your tickets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {activityLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : !activity || activity.length === 0 ? (
                    <EmptyState icon={MessageSquare} title="No recent activity" />
                  ) : (
                    activity.map((item) => (
                      <Link
                        key={item.id}
                        to={`${base}/it/tickets/${item.ticketId}`}
                        className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                      >
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                          {item.kind === "comment" ? (
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">
                            <span className="font-medium">{item.actorName}</span>{" "}
                            {item.kind === "comment" ? "commented on" : "changed status of"}{" "}
                            <span className="font-medium">{item.ticketNumber}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.kind === "comment" ? item.detail : item.subject}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
