import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useCompanyAiContext, useOpenAlerts, useAlertMutations, useCaptureDailySnapshot, useSnapshotHistory, useMetricForecast } from "@/features/ai/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Sparkles, ShieldAlert, History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AiAlertModule, AiAlertSeverity, AiHealthStatus, AiModuleHealth, AnalyticsSnapshot, ForecastConfidence } from "@/types/database";

const PRIMARY_METRICS: { module: AiAlertModule; metric: string; label: string }[] = [
  { module: "IT", metric: "open_tickets", label: "IT — Open tickets" },
  { module: "HR", metric: "pending_leave_requests", label: "HR — Pending leave requests" },
  { module: "FINANCE", metric: "period_expense", label: "Finance — Expense (MTD)" },
  { module: "ADMIN", metric: "open_requests", label: "Admin — Open requests" },
  { module: "PRODUCTION", metric: "open_tasks", label: "Production — Open tasks" },
];

const CONFIDENCE_STYLES: Record<ForecastConfidence, string> = {
  NONE: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  LOW: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  HIGH: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

// One deterministic linear-trend forecast per module's single primary
// metric -- statistics only, no LLM. Each row calls the hook itself
// (rather than looping useQuery calls in the parent) so the fixed
// 5-module list stays rules-of-hooks-clean.
function ForecastRow({ companyId, module, metric, label }: { companyId: string; module: AiAlertModule; metric: string; label: string }) {
  const { data: forecast, isLoading } = useMetricForecast(companyId, module, metric);
  if (isLoading || !forecast) return <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">{label}<span>Loading…</span></div>;

  const Icon = forecast.trend_direction === "INCREASING" ? TrendingUp : forecast.trend_direction === "DECREASING" ? TrendingDown : Minus;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{forecast.data_quality}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {forecast.prediction != null && (
          <span className="flex items-center gap-1 text-sm font-medium text-foreground">
            <Icon className="h-3.5 w-3.5" /> {forecast.prediction.toLocaleString()}
          </span>
        )}
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLES[forecast.confidence]}`}>{forecast.confidence}</span>
      </div>
    </div>
  );
}

const HISTORY_DAYS = 30;
const MIN_DAYS_FOR_TREND = 7;
const DOT_STYLES: Record<AiHealthStatus, string> = { GREEN: "bg-emerald-500", YELLOW: "bg-amber-500", RED: "bg-red-500" };
const MODULES: { key: AiAlertModule; label: string }[] = [
  { key: "IT", label: "IT" }, { key: "HR", label: "HR" }, { key: "FINANCE", label: "Finance" },
  { key: "ADMIN", label: "Admin" }, { key: "PRODUCTION", label: "Production" },
];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// A day-by-day strip, one dot per module per day. Renders exactly what's
// really been captured -- empty outline for days with no snapshot, never
// an interpolated or invented value. Below MIN_DAYS_FOR_TREND real days,
// this is honest history, not a trend -- the caption says so plainly
// rather than implying a pattern that isn't there yet.
function HealthHistoryStrip({ snapshots }: { snapshots: AnalyticsSnapshot[] | undefined }) {
  const byModuleDate = new Map<string, AnalyticsSnapshot>();
  for (const s of snapshots ?? []) byModuleDate.set(`${s.module}|${s.snapshot_date}`, s);

  const days: string[] = [];
  const today = new Date();
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }

  // Report the weakest-link module, not the union of dates across all five --
  // a union would overclaim "enough history" the moment just one module
  // (e.g. IT) has a long run, even while the other four still have a single
  // real day each. Each module's own count is what actually gates whether
  // *that* module's forecast is meaningful (see the Forecasts section).
  const perModuleDayCount = MODULES.map((m) => new Set((snapshots ?? []).filter((s) => s.module === m.key).map((s) => s.snapshot_date)).size);
  const minCapturedDayCount = Math.min(...perModuleDayCount);
  const maxCapturedDayCount = Math.max(...perModuleDayCount);
  const hasEnoughForTrend = minCapturedDayCount >= MIN_DAYS_FOR_TREND;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" /> Health history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {MODULES.map((m) => (
          <div key={m.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">{m.label}</span>
            <div className="flex flex-1 gap-[3px] overflow-x-auto">
              {days.map((day) => {
                const snap = byModuleDate.get(`${m.key}|${day}`);
                return (
                  <span
                    key={day}
                    title={snap ? `${day}: ${snap.status}` : `${day}: not captured`}
                    className={snap ? `h-3 w-3 shrink-0 rounded-sm ${DOT_STYLES[snap.status]}` : "h-3 w-3 shrink-0 rounded-sm border border-dashed border-border"}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {minCapturedDayCount === maxCapturedDayCount
            ? `${minCapturedDayCount} of the last ${HISTORY_DAYS} days captured for every module`
            : `Between ${minCapturedDayCount} and ${maxCapturedDayCount} of the last ${HISTORY_DAYS} days captured, depending on the module`}
          {" "}(one snapshot per module per day, taken automatically the first time anyone opens this dashboard that day).{" "}
          {hasEnoughForTrend
            ? "Every module has enough history to reason about a trend."
            : `At least one module still has fewer than ${MIN_DAYS_FOR_TREND} real days — see each module's own forecast below for its exact count. No days are backfilled or estimated.`}
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<AiHealthStatus, string> = {
  GREEN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  YELLOW: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  RED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const SEVERITY_STYLES: Record<AiAlertSeverity, string> = {
  INFO: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  LOW: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  HIGH: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  CRITICAL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const METRIC_LABELS: Record<string, string> = {
  open_tickets: "Open tickets", critical_tickets: "Critical tickets", tickets_resolved_30d: "Resolved (30d)",
  assets_in_repair: "Assets in repair", assets_needing_replacement: "Assets needing replacement", software_renewals_30d: "Renewals due (30d)",
  active_employees: "Active employees", pending_leave_requests: "Pending leave requests", employees_on_leave_today: "On leave today",
  period_revenue: "Revenue (MTD)", period_expense: "Expense (MTD)", overdue_invoices: "Overdue invoices", overdue_invoices_amount: "Overdue AR",
  overdue_bills: "Overdue bills", overdue_bills_amount: "Overdue AP",
  open_requests: "Open requests", pending_approvals: "Pending approvals", contracts_expiring: "Contracts expiring",
  open_tasks: "Open tasks", tasks_at_risk: "Tasks at risk", tasks_late: "Tasks late", pending_reviews: "Pending reviews",
};

function formatMetricValue(key: string, value: number | string): string {
  if (typeof value !== "number") return String(value);
  if (key.includes("amount") || key === "period_revenue" || key === "period_expense") {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString();
}

function ModuleCard({ title, health, askHref }: { title: string; health: AiModuleHealth; askHref: string }) {
  const { status, ...metrics } = health;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status as AiHealthStatus]}`}>{status}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{METRIC_LABELS[key] ?? key}</span>
              <span className="font-medium tabular-nums text-foreground">{formatMetricValue(key, value as number | string)}</span>
            </div>
          ))}
        </div>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to={askHref}>Ask AI to explain</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AiDashboardPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: context, isLoading, error } = useCompanyAiContext(company?.id);
  const { data: alerts } = useOpenAlerts(company?.id);
  const alertMutations = useAlertMutations(company?.id);
  const captureSnapshot = useCaptureDailySnapshot();
  const { data: snapshotHistory } = useSnapshotHistory(company?.id, HISTORY_DAYS);
  const capturedOnce = useRef(false);

  useEffect(() => {
    if (company?.id && !capturedOnce.current) {
      capturedOnce.current = true;
      captureSnapshot.mutate(company.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const handleScan = async () => {
    if (!company) return;
    try {
      const found = await alertMutations.scan.mutateAsync();
      toast.success(found.length > 0 ? `${found.length} open alert(s)` : "No new risks detected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const handleAcknowledge = async (id: string) => {
    if (!user) return;
    try {
      await alertMutations.acknowledge.mutateAsync({ id, userId: user.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    }
  };

  const handleResolve = async (id: string) => {
    if (!user) return;
    try {
      await alertMutations.resolve.mutateAsync({ id, userId: user.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorScreen title="Couldn't load AI health" description="You may not have permission to view company-wide AI analytics." />;
  if (!context) return null;

  const overall = context.overall_status;
  const askHref = (prompt: string) => `assistant?ask=${encodeURIComponent(prompt)}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground"><Sparkles className="h-5 w-5" /> AI Business Intelligence</h1>
          <p className="text-sm text-muted-foreground">Deterministic health, computed from real records just now</p>
        </div>
        <Button asChild size="sm"><Link to="assistant">Open Assistant</Link></Button>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Overall company health</p>
            <p className="text-2xl font-semibold text-foreground">{overall}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold ${STATUS_STYLES[overall]}`}>{overall}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="h-4 w-4" /> Alerts</CardTitle>
          <Button size="sm" variant="outline" onClick={handleScan} disabled={alertMutations.scan.isPending}>
            {alertMutations.scan.isPending ? "Scanning…" : "Scan for risks"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!alerts || alerts.length === 0) && <p className="text-sm text-muted-foreground">No open alerts. Run a scan to check for new risks.</p>}
          {(alerts ?? []).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${SEVERITY_STYLES[a.severity]}`}>{a.severity}</span>
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => handleAcknowledge(a.id)}>Acknowledge</Button>
                <Button size="sm" variant="outline" onClick={() => handleResolve(a.id)}>Resolve</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <HealthHistoryStrip snapshots={snapshotHistory} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4" /> Forecasts (next day, linear trend)</CardTitle>
        </CardHeader>
        <CardContent>
          {company?.id && PRIMARY_METRICS.map((m) => (
            <ForecastRow key={m.module} companyId={company.id} module={m.module} metric={m.metric} label={m.label} />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModuleCard title="IT" health={context.modules.it} askHref={askHref("Why is IT " + context.modules.it.status + "? Explain using real data.")} />
        <ModuleCard title="HR" health={context.modules.hr} askHref={askHref("Why is HR " + context.modules.hr.status + "? Explain using real data.")} />
        <ModuleCard title="Finance" health={context.modules.finance} askHref={askHref("Why is Finance " + context.modules.finance.status + "? Explain using real data.")} />
        <ModuleCard title="Admin" health={context.modules.admin} askHref={askHref("Why is Administration " + context.modules.admin.status + "? Explain using real data.")} />
        <ModuleCard title="Production" health={context.modules.production} askHref={askHref("Why is Production " + context.modules.production.status + "? Explain using real data.")} />
      </div>

      <p className="text-xs text-muted-foreground">Generated {new Date(context.generated_at).toLocaleString()}</p>
    </div>
  );
}
