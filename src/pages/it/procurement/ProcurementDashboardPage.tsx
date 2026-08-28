import { Link, useParams } from "react-router-dom";
import { FileText, CheckCircle2, Clock, Package, PackageCheck, AlertTriangle, Wallet, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProcurementDashboardStats } from "@/features/it/procurement/hooks";
import { useBudgets, useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/Money";
import { Can } from "@/lib/permissions/Can";
import type { BudgetModuleKey } from "@/types/database";

export default function ProcurementDashboardPage({ moduleKey = "IT" }: { moduleKey?: BudgetModuleKey }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const config = PROCUREMENT_MODULE_CONFIG[moduleKey];
  const { data: stats, isLoading } = useProcurementDashboardStats(company?.id, moduleKey);
  const { data: budgets } = useBudgets(company?.id, moduleKey);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);

  const totalAvailable = (budgets ?? []).filter((b) => b.status === "ACTIVE").reduce((sum, b) => sum + b.available, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{config.label} Procurement</h1>
          <p className="text-sm text-muted-foreground">Purchase requests, orders, and deliveries for {company?.name}</p>
        </div>
        <Can permission={config.createPermission}>
          <Link to={`/c/${companySlug}/${config.basePath}/requests/new`}>
            <Button><Plus className="h-4 w-4" />New request</Button>
          </Link>
        </Can>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Clock} label="Pending Requests" value={stats?.pendingRequests} loading={isLoading} to={`${companySlug}/${config.basePath}/requests`} />
        <StatCard icon={CheckCircle2} label="Approved Requests" value={stats?.approvedRequests} loading={isLoading} />
        <StatCard icon={FileText} label="Pending POs" value={stats?.pendingPOs} loading={isLoading} to={`${companySlug}/${config.basePath}/orders`} />
        <StatCard icon={Package} label="Open POs" value={stats?.openPOs} loading={isLoading} />
        <StatCard icon={PackageCheck} label="Partially Received" value={stats?.partiallyReceived} loading={isLoading} />
        <StatCard icon={AlertTriangle} label="Overdue Deliveries" value={stats?.overdueDeliveries} loading={isLoading} tone="danger" />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Procurement (Year)</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-xl font-semibold"><Money amount={stats?.totalProcurementThisYear ?? 0} currencyId={currencySettings?.base_currency_id} /></p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-emerald-600">Budget Remaining</CardTitle></CardHeader>
          <CardContent><Wallet className="mb-1 h-4 w-4 text-emerald-500" /><p className="text-xl font-semibold"><Money amount={totalAvailable} currencyId={currencySettings?.base_currency_id} /></p></CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, loading, to, tone }: { icon: typeof FileText; label: string; value?: number; loading: boolean; to?: string; tone?: "danger" }) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone === "danger" ? "text-red-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{value ?? 0}</p>}</CardContent>
    </Card>
  );
  return to ? <Link to={`/c/${to}`}>{content}</Link> : content;
}
