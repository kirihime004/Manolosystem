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
