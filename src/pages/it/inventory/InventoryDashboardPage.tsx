import { Link, useParams } from "react-router-dom";
import {
  Package,
  Cpu,
  AppWindow,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  UserX,
  Wrench,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Network,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useInventoryDashboardStats } from "@/features/it/inventory/hooks";
import { NotificationBell } from "@/features/it/inventory/components/NotificationBell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function StatCard({ icon: Icon, label, value, loading, to, tone }: { icon: LucideIcon; label: string; value?: number; loading: boolean; to?: string; tone?: "warn" | "danger" }) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={tone === "danger" ? "h-4 w-4 text-red-500" : tone === "warn" ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-muted-foreground"} />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{value ?? 0}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function InventoryDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: stats, isLoading } = useInventoryDashboardStats(company?.id);
  const base = `/c/${companySlug}/it/inventory`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Hardware, software, credentials, and network assets for {company?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link to={`${base}/items`}>
            <Button>View all items</Button>
          </Link>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Overview</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Package} label="Total Assets" value={stats?.totalAssets} loading={isLoading} to={`${base}/items`} />
          <StatCard icon={Cpu} label="Hardware" value={stats?.hardware} loading={isLoading} to={`${base}/hardware`} />
          <StatCard icon={AppWindow} label="Software" value={stats?.software} loading={isLoading} to={`${base}/software`} />
          <StatCard icon={RefreshCw} label="Subscriptions" value={stats?.subscriptions} loading={isLoading} to={`${base}/subscriptions`} />
          <StatCard icon={KeyRound} label="Credentials" value={stats?.credentials} loading={isLoading} to={`${base}/credentials`} />
          <StatCard icon={CheckCircle2} label="Active Assets" value={stats?.activeAssets} loading={isLoading} />
          <StatCard icon={UserX} label="Unassigned" value={stats?.unassignedAssets} loading={isLoading} />
          <StatCard icon={Wrench} label="Under Repair" value={stats?.underRepair} loading={isLoading} to={`${base}/repairs`} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Needs attention</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={AlertTriangle} label="Defective" value={stats?.defective} loading={isLoading} tone="danger" to={`${base}/items?status=DEFECTIVE`} />
          <StatCard icon={Clock} label="End of Life" value={stats?.endOfLife} loading={isLoading} tone="warn" to={`${base}/hardware`} />
          <StatCard icon={AlertTriangle} label="Expired Software" value={stats?.expiredSoftware} loading={isLoading} tone="danger" to={`${base}/subscriptions`} />
          <StatCard icon={Clock} label="Upcoming Renewals" value={stats?.upcomingRenewals} loading={isLoading} tone="warn" to={`${base}/subscriptions`} />
          <StatCard icon={ShieldAlert} label="Warranty Expiring" value={stats?.warrantyExpiring} loading={isLoading} tone="warn" to={`${base}/hardware`} />
          <StatCard icon={Network} label="IP Conflicts" value={stats?.ipConflicts} loading={isLoading} tone="danger" to={`${base}/ip`} />
        </div>
      </div>
    </div>
  );
}
