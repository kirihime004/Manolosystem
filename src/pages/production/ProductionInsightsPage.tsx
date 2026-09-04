import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Minus, FolderKanban, CheckCircle2, Activity, PauseCircle, Clock, FolderOpen } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProductionInsightsSummary } from "@/features/production/hooks";
import { useCurrencies } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { DonutChart, GroupedBarChart, ProjectTimelineChart, statusChartColor } from "@/components/production/charts/ProductionCharts";

const TASK_BUCKET_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  NOT_STARTED: "Not Started",
};

const TASK_BUCKET_COLOR: Record<string, string> = {
  COMPLETED: statusChartColor("COMPLETED"),
  IN_PROGRESS: statusChartColor("IN_PROGRESS"),
  REVIEW: statusChartColor("PENDING_REVIEW"),
  NOT_STARTED: statusChartColor("NOT_STARTED"),
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" />no change</span>;
    return <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><ArrowUp className="h-3 w-3" />new</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  const up = pct > 0;
  return (
    <span className={`flex items-center gap-1 text-xs ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

export default function ProductionInsightsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: currencies } = useCurrencies();

  const [range, setRange] = useState(() => ({ start: isoDate(new Date(Date.now() - 89 * 86400000)), end: isoDate(new Date()) }));
  const { data, isLoading } = useProductionInsightsSummary(company?.id, range.start, range.end);

  const statCards = data?.stat_cards;
  const manHours = data?.man_hours;

  const cards = [
    { label: "Total Projects", icon: FolderKanban, value: statCards?.total_projects, prev: statCards?.total_projects_prev },
    { label: "Completed", icon: CheckCircle2, value: statCards?.completed_projects, prev: statCards?.completed_projects_prev },
    { label: "In Progress", icon: Activity, value: statCards?.in_progress_projects, prev: statCards?.in_progress_projects_prev },
    { label: "On Hold", icon: PauseCircle, value: statCards?.on_hold_projects, prev: statCards?.on_hold_projects_prev },
    { label: "Total Man-Hours", icon: Clock, value: manHours?.current, prev: manHours?.previous },
  ];

  const taskStatusData = useMemo(() => {
    const rows = data?.task_status ?? [];
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return [];
    return (["COMPLETED", "IN_PROGRESS", "REVIEW", "NOT_STARTED"] as const)
      .map((bucket) => ({ label: TASK_BUCKET_LABEL[bucket], value: rows.find((r) => r.bucket === bucket)?.count ?? 0, color: TASK_BUCKET_COLOR[bucket] }));
  }, [data]);

  const workloadCategories = useMemo(
    () => (data?.department_workload ?? []).map((d) => ({ label: d.department, values: [d.planned_hours, d.actual_hours] })),
    [data],
  );

  const timelineRows = useMemo(
    () => (data?.project_timeline ?? []).map((p) => ({
      key: p.project_id, label: p.name, start: p.start_date, plannedEnd: p.target_end_date, actualEnd: p.actual_end_date, risk: p.risk, status: p.status,
    })),
    [data],
  );

  const budgetCurrency = currencies?.find((c) => c.code === data?.budget.currency_code);

  const budgetPct = data?.budget.total_budget
    ? Math.min(100, Math.round((data.budget.spent / data.budget.total_budget) * 100))
    : 0;

  const insights = useMemo(() => {
    if (!data) return [];
    const out: { title: string; description: string; tone: "success" | "warn" | "info" }[] = [];
    const completedDelta = statCards!.completed_projects - statCards!.completed_projects_prev;
    if (completedDelta > 0) {
      out.push({ title: "Productivity Up", description: `${completedDelta} more project${completedDelta === 1 ? "" : "s"} completed than the previous period.`, tone: "success" });
    }
    const openStatuses = new Set(["PLANNING", "IN_PROGRESS", "ON_HOLD"]);
    const atRisk = timelineRows.filter((r) => openStatuses.has(r.status) && (r.risk === "AT_RISK" || r.risk === "LATE")).length;
    if (atRisk > 0) {
      out.push({ title: "Watch Out", description: `${atRisk} project${atRisk === 1 ? " is" : "s are"} at risk of delay. Review resource allocation.`, tone: "warn" });
    }
    const overworked = (data.department_workload ?? []).filter((d) => d.planned_hours > 0 && d.actual_hours > d.planned_hours);
    if (overworked.length > 0) {
      out.push({ title: "Team Performance", description: `${overworked.map((d) => d.department).join(", ")} logged more hours than planned this period.`, tone: "warn" });
    }
    const early = (data.recent_projects ?? []).filter((p) => p.variance_days !== null && p.variance_days < 0);
    if (early.length > 0) {
      out.push({ title: "Opportunity", description: `${early.length} project${early.length === 1 ? "" : "s"} finished ahead of schedule.`, tone: "success" });
    }
    return out;
  }, [data, statCards, timelineRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Production Insights</h1>
          <p className="text-sm text-muted-foreground">Pipeline analytics across every project for {company?.name}.</p>
        </div>
        <div className="flex items-end gap-2 print:hidden">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardDescription>{c.label}</CardDescription>
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-2xl font-semibold tabular-nums text-foreground">{c.value ?? 0}</div>
                  <Delta current={c.value ?? 0} previous={c.prev ?? 0} />
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Project Timeline vs Actual</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : <ProjectTimelineChart rows={timelineRows} rangeStart={range.start} rangeEnd={range.end} />}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Task Status</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-40 w-full" /> : <DonutChart data={taskStatusData} />}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Department Workload</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <GroupedBarChart
                  height={160}
                  categories={workloadCategories}
                  series={[{ key: "planned", label: "Planned", color: "#93c5fd" }, { key: "actual", label: "Actual", color: "#3b82f6" }]}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent Projects</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.recent_projects.length ?? 0) === 0 ? (
              <EmptyState icon={FolderOpen} title="No projects in this range" description="Pick a wider date range, or create a project to see it here." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Planned End</TableHead>
                      <TableHead>Actual End</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.recent_projects.map((p) => (
                      <TableRow key={p.project_id}>
                        <TableCell>
                          <Link to={`/c/${companySlug}/production/projects/${p.project_id}`} className="font-medium text-foreground hover:underline">{p.name}</Link>
                        </TableCell>
                        <TableCell><ProductionStatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress_pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{p.progress_pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.target_end_date ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.actual_end_date ?? "—"}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${p.variance_days == null ? "text-muted-foreground" : p.variance_days > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {p.variance_days == null ? "—" : `${p.variance_days > 0 ? "+" : ""}${p.variance_days} day${Math.abs(p.variance_days) === 1 ? "" : "s"}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Budget vs Actual Spend</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Budget</span><Money amount={data?.budget.total_budget} currencyId={budgetCurrency?.id} /></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-primary" style={{ width: "100%" }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Actual Spend</span><Money amount={data?.budget.spent} currencyId={budgetCurrency?.id} /></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-blue-500" style={{ width: `${budgetPct}%` }} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{budgetPct}% of budget used</p>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-lg font-semibold text-foreground"><Money amount={data?.budget.remaining} currencyId={budgetCurrency?.id} /></p>
                    <p className="text-xs text-muted-foreground">Remaining budget</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Key Insights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : insights.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not enough activity in this range yet to surface insights.</p>
              ) : (
                insights.map((ins) => (
                  <div key={ins.title} className="space-y-0.5">
                    <p className={`text-sm font-medium ${ins.tone === "success" ? "text-emerald-600 dark:text-emerald-400" : ins.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{ins.title}</p>
                    <p className="text-xs text-muted-foreground">{ins.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
