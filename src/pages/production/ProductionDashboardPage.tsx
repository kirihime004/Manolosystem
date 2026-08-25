import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProductionDashboardSummary } from "@/features/production/hooks";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductionDashboardPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Production</h1>
        <p className="text-sm text-muted-foreground">Pipeline overview for {company?.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => (
              <Link key={c.label} to={c.href}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardDescription>{c.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-foreground">{c.value ?? 0}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>
    </div>
  );
}
