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
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useMyProfile } from "@/lib/auth/useMyProfile";
import { useAuth } from "@/lib/auth/useAuth";
import { useCompanyUsersList } from "@/features/company/settings/useCompanyUsers";
import { useTicketDashboardStats, useMyTicketActivity } from "@/features/it/tickets/hooks";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationBell } from "@/components/shared/NotificationBell";

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

  const isAdmin = hasPermission(PERMISSIONS.ADMIN_USERS_MANAGE);
  const itEnabled = enabledModules.has("IT");
  const canViewAllTickets = hasPermission(PERMISSIONS.IT_TICKETS_VIEW);

  const { data: users, isLoading: usersLoading } = useCompanyUsersList(isAdmin ? company?.id : undefined);
  const { data: stats, isLoading: ticketsLoading } = useTicketDashboardStats(itEnabled ? company?.id : undefined);
  const { data: activity, isLoading: activityLoading } = useMyTicketActivity(
    itEnabled && !canViewAllTickets ? company?.id : undefined,
    user?.id,
  );

  const userStats = users
    ? {
        total: users.length,
        active: users.filter((u) => u.status === "ACTIVE").length,
        invited: users.filter((u) => u.status === "INVITED").length,
        disabled: users.filter((u) => u.status === "DISABLED").length,
      }
    : null;

  const hasAnyContent = isAdmin || itEnabled;

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

      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Team</h2>
            <Link
              to={`/c/${companySlug}/settings/users`}
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

      {itEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Ticketing</h2>
            <Link
              to={`/c/${companySlug}/it`}
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
                        to={`/c/${companySlug}/it/tickets/${item.ticketId}`}
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
