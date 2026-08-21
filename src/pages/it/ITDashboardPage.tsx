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
import { useTickets } from "@/features/it/tickets/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketStatusBadge } from "@/components/shared/TicketBadges";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/types/database";

const isToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export default function ITDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: tickets, isLoading } = useTickets(company?.id, {});

  const stats = tickets
    ? {
        open: tickets.filter((t) => t.status === "OPEN").length,
        assigned: tickets.filter((t) => t.assigned_to === user?.id && !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status)).length,
        inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
        waitingForUser: tickets.filter((t) => t.status === "WAITING_FOR_USER").length,
        critical: tickets.filter((t) => t.priority === "CRITICAL" && !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status)).length,
        overdue: tickets.filter(
          (t) =>
            !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status) &&
            Date.now() - new Date(t.created_at).getTime() > 48 * 60 * 60 * 1000,
        ).length,
        resolvedToday: tickets.filter((t) => t.resolved_at && isToday(t.resolved_at)).length,
        closedToday: tickets.filter((t) => t.closed_at && isToday(t.closed_at)).length,
      }
    : null;

  const recent = tickets?.slice(0, 5) ?? [];
  const mine = tickets?.filter((t) => t.assigned_to === user?.id).slice(0, 5) ?? [];
  const critical = tickets?.filter((t) => t.priority === "CRITICAL").slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">IT Dashboard</h1>
          <p className="text-sm text-muted-foreground">Ticketing overview for {company?.name}</p>
        </div>
        <Link to={`/c/${companySlug}/it/tickets/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={TicketIcon} label="Open" value={stats?.open} loading={isLoading} />
        <StatCard icon={UserCheck} label="Assigned to me" value={stats?.assigned} loading={isLoading} />
        <StatCard icon={Clock} label="In Progress" value={stats?.inProgress} loading={isLoading} />
        <StatCard icon={Timer} label="Waiting for User" value={stats?.waitingForUser} loading={isLoading} />
        <StatCard icon={Flame} label="Critical" value={stats?.critical} loading={isLoading} />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats?.overdue} loading={isLoading} />
        <StatCard icon={CheckCircle2} label="Resolved Today" value={stats?.resolvedToday} loading={isLoading} />
        <StatCard icon={Archive} label="Closed Today" value={stats?.closedToday} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TicketMiniList title="Recent tickets" tickets={recent} companySlug={companySlug!} loading={isLoading} />
        <TicketMiniList title="My assigned tickets" tickets={mine} companySlug={companySlug!} loading={isLoading} />
        <TicketMiniList title="Critical tickets" tickets={critical} companySlug={companySlug!} loading={isLoading} />
      </div>
    </div>
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
  tickets: { id: string; ticket_number: string; subject: string; status: TicketStatus; priority: string }[];
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
        ) : tickets.length === 0 ? (
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
