const TONE_HEX: Record<string, string> = {
  neutral: "#71717a",
  info: "#3b82f6",
  warn: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
  accent: "#6366f1",
};

const STATUS_TONE: Record<string, string> = {
  NOT_STARTED: "neutral", READY: "info", IN_PROGRESS: "info", PENDING_REVIEW: "warn",
  CHANGES_REQUESTED: "danger", APPROVED: "success", COMPLETED: "success", ON_HOLD: "neutral",
  OMITTED: "neutral", ARCHIVED: "neutral",
};

export function statusChartColor(status: string): string {
  return TONE_HEX[STATUS_TONE[status] ?? "neutral"];
}

// A coarser 4-bucket grouping of the shared task/shot status ladder, used
// wherever a page wants a simple Completed/In Progress/Review/Not Started
// donut instead of exposing every raw status value.
export type TaskStatusBucket = "COMPLETED" | "IN_PROGRESS" | "REVIEW" | "NOT_STARTED";

const TASK_STATUS_BUCKET: Record<string, TaskStatusBucket> = {
  COMPLETED: "COMPLETED", APPROVED: "COMPLETED",
  PENDING_REVIEW: "REVIEW", CHANGES_REQUESTED: "REVIEW",
  NOT_STARTED: "NOT_STARTED", ON_HOLD: "NOT_STARTED", OMITTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS", READY: "IN_PROGRESS",
};

export const TASK_BUCKET_LABEL: Record<TaskStatusBucket, string> = {
  COMPLETED: "Completed", IN_PROGRESS: "In Progress", REVIEW: "Review", NOT_STARTED: "Not Started",
};

export const TASK_BUCKET_COLOR: Record<TaskStatusBucket, string> = {
  COMPLETED: TONE_HEX.success, IN_PROGRESS: TONE_HEX.info, REVIEW: TONE_HEX.warn, NOT_STARTED: TONE_HEX.neutral,
};

export function bucketTaskStatusCounts(rows: { status: string; count: number }[]): { label: string; value: number; color: string }[] {
  const totals: Record<TaskStatusBucket, number> = { COMPLETED: 0, IN_PROGRESS: 0, REVIEW: 0, NOT_STARTED: 0 };
  for (const r of rows) totals[TASK_STATUS_BUCKET[r.status] ?? "NOT_STARTED"] += r.count;
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  if (grandTotal === 0) return [];
  return (["COMPLETED", "IN_PROGRESS", "REVIEW", "NOT_STARTED"] as const).map((b) => ({ label: TASK_BUCKET_LABEL[b], value: totals[b], color: TASK_BUCKET_COLOR[b] }));
}

// A small "+12% / -4% / no change" indicator used next to stat-card values
// throughout Production's analytics pages.
export function DeltaIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return <span className="flex items-center gap-1 text-xs text-muted-foreground">— no change</span>;
    return <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">↑ new</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="flex items-center gap-1 text-xs text-muted-foreground">— 0%</span>;
  const up = pct > 0;
  return (
    <span className={`flex items-center gap-1 text-xs ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? "↑" : "↓"} {up ? "+" : ""}{pct}%
    </span>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ---------------------------------------------------------------------
// Donut chart -- one ring built from stacked stroke-dasharray arcs, plus a
// text legend (label / count / % of total) since a bare ring can't carry
// that detail on its own.
// ---------------------------------------------------------------------
export function DonutChart({ data, size = 168 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth={16} />
        {total === 0
          ? null
          : data.map((d) => {
              const fraction = d.value / total;
              const dash = fraction * circumference;
              const el = (
                <circle
                  key={d.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={16}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsetSoFar}
                  strokeLinecap="butt"
                />
              );
              offsetSoFar += dash;
              return el;
            })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Total: {total}</p>
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="truncate text-foreground">{humanize(d.label)}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{d.value}</span>
          </div>
        ))}
        {data.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Stacked bar chart -- one column per category, segments stacked by a
// shared series list (so every column uses the same color per series).
// ---------------------------------------------------------------------
export function StackedBarChart({
  categories, series, height = 220,
}: {
  categories: { label: string; segments: { key: string; value: number; color: string }[] }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  const maxTotal = Math.max(1, ...categories.map((c) => c.segments.reduce((s, seg) => s + seg.value, 0)));

  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ height }}>
        {categories.map((c) => {
          const columnTotal = c.segments.reduce((s, seg) => s + seg.value, 0);
          return (
            <div key={c.label} className="flex h-full min-w-[36px] flex-1 flex-col items-center justify-end gap-1">
              <div className="flex w-full flex-1 flex-col-reverse justify-start overflow-hidden rounded-t-sm">
                {c.segments.map((seg) =>
                  seg.value === 0 ? null : (
                    <div
                      key={seg.key}
                      title={`${seg.key}: ${seg.value}`}
                      style={{ height: `${(seg.value / maxTotal) * 100}%`, backgroundColor: seg.color }}
                    />
                  ),
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{columnTotal}</span>
              <span className="max-w-[48px] truncate text-[10px] text-muted-foreground" title={c.label}>{c.label}</span>
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Grouped bar chart -- side-by-side series per category (e.g. planned vs
// actual hours per department), as opposed to StackedBarChart's segments.
// ---------------------------------------------------------------------
export function GroupedBarChart({
  categories, series, height = 220,
}: {
  categories: { label: string; values: number[] }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...categories.flatMap((c) => c.values));

  return (
    <div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2" style={{ height }}>
        {categories.map((c) => (
          <div key={c.label} className="flex h-full min-w-[64px] flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              {series.map((s, i) => (
                <div key={s.key} className="flex h-full w-4 flex-col-reverse justify-start" title={`${s.label}: ${c.values[i] ?? 0}`}>
                  <div className="rounded-t-sm" style={{ height: `${((c.values[i] ?? 0) / max) * 100}%`, backgroundColor: s.color }} />
                </div>
              ))}
            </div>
            <span className="max-w-[80px] truncate text-[10px] text-muted-foreground" title={c.label}>{c.label}</span>
          </div>
        ))}
        {categories.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Project timeline -- one track per project, a light "planned" bar (start
// to target end) with a darker "actual" bar overlaid (start to actual end,
// or to today if still open), plus a dashed "today" marker and a risk dot.
// ---------------------------------------------------------------------
export function ProjectTimelineChart({
  rows, rangeStart, rangeEnd,
}: {
  rows: { key: string; label: string; start: string; plannedEnd: string | null; actualEnd: string | null; risk: string }[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  const span = Math.max(1, end - start);
  const pct = (d: string) => Math.min(100, Math.max(0, ((new Date(d).getTime() - start) / span) * 100));
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayPct = pct(todayIso);
  const todayInRange = new Date(todayIso).getTime() >= start && new Date(todayIso).getTime() <= end;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-muted-foreground/30" />Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-red-400" />Today</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE_HEX.success }} />On Track</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE_HEX.warn }} />At Risk</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE_HEX.danger }} />Late</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const plannedStartPct = pct(r.start);
          const plannedEndPct = r.plannedEnd ? pct(r.plannedEnd) : plannedStartPct;
          const actualEndPct = r.actualEnd
            ? pct(r.actualEnd)
            : r.plannedEnd && Date.now() < new Date(r.plannedEnd).getTime()
              ? todayPct
              : plannedEndPct;
          const riskColor = r.risk === "LATE" ? TONE_HEX.danger : r.risk === "AT_RISK" ? TONE_HEX.warn : TONE_HEX.success;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-foreground" title={r.label}>{r.label}</span>
              <div className="relative h-5 flex-1 rounded bg-muted/20">
                {todayInRange && <div className="absolute top-0 z-10 h-full w-px bg-red-400" style={{ left: `${todayPct}%` }} />}
                <div className="absolute top-0.5 h-1.5 rounded-sm bg-muted-foreground/30" style={{ left: `${plannedStartPct}%`, width: `${Math.max(1, plannedEndPct - plannedStartPct)}%` }} />
                <div className="absolute bottom-0.5 h-1.5 rounded-sm" style={{ left: `${plannedStartPct}%`, width: `${Math.max(1, actualEndPct - plannedStartPct)}%`, backgroundColor: "#3b82f6" }} />
              </div>
              <span className="w-28 shrink-0 text-[10px] text-muted-foreground">{fmt(r.start)}{r.plannedEnd ? ` - ${fmt(r.plannedEnd)}` : ""}</span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: riskColor }} title={humanize(r.risk)} />
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No projects in this range.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Phase timeline -- like ProjectTimelineChart, but one track per task-type
// "phase" within a single project, plus a shared ruler of milestone
// diamonds along the top so the reader can see which phase a milestone
// landed in.
// ---------------------------------------------------------------------
export function PhaseTimelineChart({
  phases, milestones, rangeStart, rangeEnd,
}: {
  phases: { key: string; label: string; plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null; progressPct: number }[];
  milestones: { key: string; label: string; date: string; done: boolean }[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  const span = Math.max(1, end - start);
  const pct = (d: string) => Math.min(100, Math.max(0, ((new Date(d).getTime() - start) / span) * 100));
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayPct = pct(todayIso);
  const todayInRange = new Date(todayIso).getTime() >= start && new Date(todayIso).getTime() <= end;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-4 pb-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-muted-foreground/30" />Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-red-400" />Today</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rotate-45" style={{ backgroundColor: TONE_HEX.accent }} />Milestone</span>
      </div>

      {milestones.length > 0 && (
        <div className="relative ml-28 mr-28 h-5">
          {milestones.map((m) => (
            <div key={m.key} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(m.date)}%` }} title={`${m.label} — ${fmt(m.date)}`}>
              <span className="inline-block h-2 w-2 rotate-45" style={{ backgroundColor: m.done ? TONE_HEX.success : TONE_HEX.accent }} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {phases.map((p) => {
          const plannedStartPct = p.plannedStart ? pct(p.plannedStart) : 0;
          const plannedEndPct = p.plannedEnd ? pct(p.plannedEnd) : plannedStartPct;
          const actualEndPct = p.actualEnd
            ? pct(p.actualEnd)
            : p.plannedEnd && Date.now() < new Date(p.plannedEnd).getTime()
              ? todayPct
              : plannedEndPct;
          return (
            <div key={p.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-foreground" title={p.label}>{p.label}</span>
              <div className="relative h-5 flex-1 rounded bg-muted/20">
                {todayInRange && <div className="absolute top-0 z-10 h-full w-px bg-red-400" style={{ left: `${todayPct}%` }} />}
                <div className="absolute top-0.5 h-1.5 rounded-sm bg-muted-foreground/30" style={{ left: `${plannedStartPct}%`, width: `${Math.max(1, plannedEndPct - plannedStartPct)}%` }} />
                <div className="absolute bottom-0.5 h-1.5 rounded-sm" style={{ left: `${plannedStartPct}%`, width: `${Math.max(1, actualEndPct - plannedStartPct)}%`, backgroundColor: "#3b82f6" }} />
              </div>
              <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{p.progressPct}%</span>
            </div>
          );
        })}
        {phases.length === 0 && <p className="text-xs text-muted-foreground">No scheduled tasks yet.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Horizontal bar chart -- for ranked lists like "versions per shot".
// ---------------------------------------------------------------------
export function HorizontalBarChart({ data, color = "#3b82f6" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 truncate font-mono text-muted-foreground" title={d.label}>{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted/40">
            <div className="flex h-full items-center rounded px-1.5 text-[10px] font-medium text-white" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}>
              {d.value}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
    </div>
  );
}
