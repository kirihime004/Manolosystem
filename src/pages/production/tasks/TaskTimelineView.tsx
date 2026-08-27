import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { statusChartColor } from "@/components/production/charts/ProductionCharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { CalendarRange } from "lucide-react";
import type { ProductionTask, ProductionShot, ProductionAsset } from "@/types/database";

type GroupBy = "link" | "assignee";

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function TaskTimelineView({
  tasks, employeeMap, shots, assets,
}: {
  tasks: ProductionTask[];
  employeeMap: Map<string, string>;
  shots: ProductionShot[];
  assets: ProductionAsset[];
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("link");
  const shotMap = new Map(shots.map((s) => [s.id, s.shot_code]));
  const assetMap = new Map(assets.map((a) => [a.id, a.name]));

  const linkLabel = (t: ProductionTask) => (t.shot_id ? shotMap.get(t.shot_id) : t.asset_id ? assetMap.get(t.asset_id) : null) ?? "Unlinked";
  const assigneeLabel = (t: ProductionTask) => (t.assigned_to ? employeeMap.get(t.assigned_to) : null) ?? "Unassigned";
  const groupLabel = groupBy === "link" ? linkLabel : assigneeLabel;

  const scheduled = tasks.filter((t) => t.start_date && t.due_date);
  const unscheduled = tasks.filter((t) => !t.start_date || !t.due_date);

  if (tasks.length === 0) {
    return <EmptyState icon={CalendarRange} title="No tasks yet" description="Create tasks from a shot or asset page." />;
  }

  const groups = new Map<string, ProductionTask[]>();
  for (const t of scheduled) {
    const key = groupLabel(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  let rangeStart = new Date();
  let rangeEnd = new Date();
  if (scheduled.length > 0) {
    rangeStart = scheduled.reduce((min, t) => (parseDate(t.start_date!) < min ? parseDate(t.start_date!) : min), parseDate(scheduled[0].start_date!));
    rangeEnd = scheduled.reduce((max, t) => (parseDate(t.due_date!) > max ? parseDate(t.due_date!) : max), parseDate(scheduled[0].due_date!));
    rangeStart = new Date(rangeStart.getTime() - 2 * 86400000);
    rangeEnd = new Date(rangeEnd.getTime() + 2 * 86400000);
  }
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const tickEvery = totalDays <= 21 ? 1 : totalDays <= 90 ? 7 : 14;
  const ticks: { leftPct: number; label: string }[] = [];
  for (let i = 0; i < totalDays; i += tickEvery) {
    const d = new Date(rangeStart.getTime() + i * 86400000);
    ticks.push({ leftPct: (i / totalDays) * 100, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Group by:</span>
        <Button size="sm" variant={groupBy === "link" ? "default" : "outline"} onClick={() => setGroupBy("link")}>Shot / Asset</Button>
        <Button size="sm" variant={groupBy === "assignee" ? "default" : "outline"} onClick={() => setGroupBy("assignee")}>Assignee</Button>
      </div>

      {scheduled.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No scheduled tasks" description="Set a start and due date on a task (via its Edit dialog) to place it on the timeline." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <div className="flex w-[420px] shrink-0 items-center gap-3 px-3 py-2">
              <span className="w-40">Task</span>
              <span className="w-28">Status</span>
              <span className="w-14 text-right">Bid</span>
              <span className="w-14 text-right">Logged</span>
            </div>
            <div className="relative min-w-[480px] flex-1 px-1 py-2">
              {ticks.map((tick) => (
                <span key={tick.leftPct} className="absolute top-2 -translate-x-1/2 whitespace-nowrap" style={{ left: `${tick.leftPct}%` }}>{tick.label}</span>
              ))}
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
            {[...groups.entries()].map(([label, groupTasks]) => (
              <div key={label}>
                <div className="border-b border-border bg-muted/10 px-3 py-1.5 text-xs font-semibold text-foreground">{label} ({groupTasks.length})</div>
                {groupTasks.map((t) => {
                  const start = parseDate(t.start_date!);
                  const end = parseDate(t.due_date!);
                  const offsetDays = daysBetween(rangeStart, start);
                  const spanDays = daysBetween(start, end) + 1;
                  const leftPct = (offsetDays / totalDays) * 100;
                  const widthPct = Math.max((spanDays / totalDays) * 100, 1.5);
                  return (
                    <div key={t.id} className="flex border-b border-border/60 last:border-0 hover:bg-muted/20">
                      <div className="flex w-[420px] shrink-0 items-center gap-3 px-3 py-2 text-xs">
                        <span className="w-40 truncate font-medium text-foreground" title={t.name}>{t.name}</span>
                        <span className="w-28"><ProductionStatusBadge status={t.status} /></span>
                        <span className="w-14 text-right tabular-nums text-muted-foreground">{t.estimated_hours != null ? `${t.estimated_hours}h` : "—"}</span>
                        <span className="w-14 text-right tabular-nums text-muted-foreground">{t.actual_hours != null ? `${t.actual_hours}h` : "—"}</span>
                      </div>
                      <div className="relative min-w-[480px] flex-1 px-1 py-2">
                        <div
                          className="absolute top-1.5 h-4 rounded"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: statusChartColor(t.status) }}
                          title={`${t.start_date} → ${t.due_date} (${spanDays}d)`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
            No dates set ({unscheduled.length}) — won't appear on the timeline until given a start and due date
          </div>
          {unscheduled.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs last:border-0">
              <span className="font-medium text-foreground">{t.name}</span>
              <span className="text-muted-foreground">{groupLabel(t)}</span>
              <ProductionStatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
