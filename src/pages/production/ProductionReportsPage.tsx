import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProductionDashboardSummary } from "@/features/production/hooks";
import { exportCsv } from "@/lib/csvExport";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function ProductionReportsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: summary, isLoading } = useProductionDashboardSummary(company?.id);

  const cards: { label: string; value: number | undefined; href: string }[] = [
    { label: "Active Projects", value: summary?.active_projects, href: `/c/${companySlug}/production/projects` },
    { label: "Open Tasks", value: summary?.open_tasks, href: `/c/${companySlug}/production/tasks` },
    { label: "My Tasks", value: summary?.my_tasks, href: `/c/${companySlug}/production/tasks?mine=1` },
    { label: "Tasks At Risk", value: summary?.tasks_at_risk, href: `/c/${companySlug}/production/tasks` },
    { label: "Tasks Late", value: summary?.tasks_late, href: `/c/${companySlug}/production/tasks` },
    { label: "Pending Reviews", value: summary?.pending_reviews, href: `/c/${companySlug}/production/reviews` },
    { label: "Upcoming Milestones", value: summary?.upcoming_milestones, href: `/c/${companySlug}/production/schedule` },
    { label: "Overdue Milestones", value: summary?.overdue_milestones, href: `/c/${companySlug}/production/schedule` },
    { label: "Pending Deliverables", value: summary?.pending_deliverables, href: `/c/${companySlug}/production/deliverables` },
    { label: "Overdue Deliverables", value: summary?.overdue_deliverables, href: `/c/${companySlug}/production/deliverables` },
  ];

  const handleExport = () => {
    exportCsv(`production-report-${new Date().toISOString().slice(0, 10)}.csv`, [
      { label: "Metric", render: (c: typeof cards[number]) => c.label },
      { label: "Count", render: (c: typeof cards[number]) => String(c.value ?? 0) },
    ], cards);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Production Reports</h1>
          <p className="text-sm text-muted-foreground">Current pipeline snapshot across projects, tasks, and deliverables</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Can permission={PERMISSIONS.PRODUCTION_REPORTS_PRINT}>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
          </Can>
          <Can permission={PERMISSIONS.PRODUCTION_REPORTS_EXPORT}>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export CSV</Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2"><CardDescription>{c.label}</CardDescription></CardHeader>
                <CardContent><div className="text-2xl font-semibold text-foreground">{c.value ?? 0}</div></CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
