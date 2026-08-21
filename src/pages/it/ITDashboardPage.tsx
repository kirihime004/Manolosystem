import { Link, useParams } from "react-router-dom";
import {
  Ticket as TicketIcon,
  UserCheck,
  Clock,
  AlertTriangle,
  Flame,
  Timer,
  CheckCircle2,
  Archive,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import {
  useTicketDashboardStats,
  useRecentTickets,
  useAssignedTickets,
  useCriticalTickets,
} from "@/features/it/tickets/hooks";
import { TicketSearchBox } from "@/features/it/tickets/components/TicketSearchBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketStatusBadge } from "@/components/shared/TicketBadges";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { MiniTicket } from "@/features/it/tickets/ticketApi";
import type { TicketPriority, TicketStatus } from "@/types/database";

const STATUS_ORDER: TicketStatus[] = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_VENDOR", "RESOLVED", "CLOSED", "CANCELLED",
];
const PRIORITY_ORDER: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_BAR_COLOR: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500",
  ASSIGNED: "bg-indigo-500",
  IN_PROGRESS: "bg-amber-500",
  WAITING_FOR_USER: "bg-orange-500",
  WAITING_FOR_VENDOR: "bg-orange-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-zinc-400",
  CANCELLED: "bg-red-500",
};

const PRIORITY_BAR_COLOR: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-zinc-400",
};

export default function ITDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompany();
  const { user } = useAuth();

  // All the counts and mini-lists below are now computed server-side
  // (get_ticket_dashboard_stats, and targeted limit(5) queries) instead of
  // fetching the company's entire ticket history and filtering it in the
  // browser -- that stopped scaling once there were a couple hundred
  // tickets. RLS still scopes everything per caller either way.
  const canViewAll = hasPermission(PERMISSIONS.IT_TICKETS_VIEW);

  const { data: stats, isLoading: statsLoading } = useTicketDashboardStats(company?.id);
  const { data: recent, isLoading: recentLoading } = useRecentTickets(company?.id, canViewAll ? 5 : 10);
  const { data: mine, isLoading: mineLoading } = useAssignedTickets(company?.id, user?.id, 5);
  const { data: critical, isLoading: criticalLoading } = useCriticalTickets(company?.id, 5);

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {canViewAll ? "Ticketing" : "My Tickets"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {canViewAll ? `Ticketing overview for ${company?.name}` : "Tickets you've submitted"}
          </p>
        </div>
        <div className="flex gap-2">
          <Can permission={PERMISSIONS.ADMIN_IT_CATEGORIES_MANAGE}>
            <Link to={`/c/${companySlug}/it/categories`}>
              <Button variant="outline">Manage categories</Button>
            </Link>
          </Can>
          <Can permission={PERMISSIONS.IT_TICKETS_CREATE}>
            <Link to={`/c/${companySlug}/it/tickets/new`}>
              <Button>
                <Plus className="h-4 w-4" />
                New ticket
              </Button>
            </Link>
          </Can>
        </div>
      </div>
      {canViewAll && <TicketSearchBox companyId={company?.id} companySlug={companySlug!} />}
    </div>
  );

  if (!canViewAll) {
    return (
      <div className="space-y-8">
        {header}

        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={TicketIcon} label="Open" value={stats?.active} loading={statsLoading} />
          <StatCard icon={CheckCircle2} label="Resolved" value={stats?.resolved} loading={statsLoading} />
          <StatCard icon={Archive} label="Closed" value={stats?.closed} loading={statsLoading} />
        </div>

        <TicketMiniList title="My tickets" tickets={recent} companySlug={companySlug!} loading={recentLoading} />
      </div>
    );
  }

  const statusCounts = STATUS_ORDER.map((status) => ({
    key: status,
    label: status.replace(/_/g, " "),
    count: stats?.statusCounts[status] ?? 0,
    color: STATUS_BAR_COLOR[status],
  }));
  const priorityCounts = PRIORITY_ORDER.map((priority) => ({
    key: priority,
    label: priority,
    count: stats?.priorityCounts[priority] ?? 0,
    color: PRIORITY_BAR_COLOR[priority],
  }));

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={TicketIcon} label="Open" value={stats?.open} loading={statsLoading} />
        <StatCard icon={UserCheck} label="Assigned to me" value={stats?.assignedToMe} loading={statsLoading} />
        <StatCard icon={Clock} label="In Progress" value={stats?.inProgress} loading={statsLoading} />
        <StatCard icon={Timer} label="Waiting for User" value={stats?.waitingForUser} loading={statsLoading} />
        <StatCard icon={Flame} label="Critical" value={stats?.critical} loading={statsLoading} />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats?.overdue} loading={statsLoading} />
        <StatCard icon={CheckCircle2} label="Resolved Today" value={stats?.resolvedToday} loading={statsLoading} />
        <StatCard icon={Archive} label="Closed Today" value={stats?.closedToday} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DistributionCard title="Status distribution" rows={statusCounts} loading={statsLoading} />
        <DistributionCard title="Priority distribution" rows={priorityCounts} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TicketMiniList title="Recent tickets" tickets={recent} companySlug={companySlug!} loading={recentLoading} />
        <TicketMiniList title="My assigned tickets" tickets={mine} companySlug={companySlug!} loading={mineLoading} />
        <TicketMiniList title="Critical tickets" tickets={critical} companySlug={companySlug!} loading={criticalLoading} />
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { key: string; label: string; count: number; color: string }[];
  loading: boolean;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : total === 0 ? (
          <EmptyState icon={TicketIcon} title="No tickets yet" />
        ) : (
          rows
            .filter((r) => r.count > 0)
            .map((r) => (
              <div key={r.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-foreground">{r.label.toLowerCase()}</span>
                  <span className="text-muted-foreground">
                    {r.count} ({Math.round((r.count / total) * 100)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${r.color}`}
                    style={{ width: `${(r.count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))
        )}
      </CardContent>
    </Card>
  );
}

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

function TicketMiniList({
  title,
  tickets,
  companySlug,
  loading,
}: {
  title: string;
  tickets: MiniTicket[] | undefined;
  companySlug: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : !tickets || tickets.length === 0 ? (
          <EmptyState icon={TicketIcon} title="No tickets" />
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              to={`/c/${companySlug}/it/tickets/${t.id}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.ticket_number}</p>
              </div>
              <TicketStatusBadge status={t.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
