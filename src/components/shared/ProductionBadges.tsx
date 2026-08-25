import { cn } from "@/lib/utils";

const badgeClass = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const TONE_STYLES: Record<string, string> = {
  neutral: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
};

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn(badgeClass, TONE_STYLES[tone] ?? TONE_STYLES.neutral)}>{children}</span>;
}

const STATUS_TONE: Record<string, string> = {
  NOT_STARTED: "neutral", READY: "info", IN_PROGRESS: "info", PENDING_REVIEW: "warn",
  CHANGES_REQUESTED: "danger", APPROVED: "success", COMPLETED: "success", ON_HOLD: "neutral",
  OMITTED: "neutral", PLANNING: "info", CANCELLED: "neutral", ARCHIVED: "neutral",
  UPCOMING: "info", AT_RISK: "warn", LATE: "danger", DELIVERED: "success", REJECTED: "danger",
  PENDING: "warn", DRAFT: "neutral",
};

export function ProductionStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

const RISK_TONE: Record<string, string> = { ON_TRACK: "success", AT_RISK: "warn", LATE: "danger" };

export function ProductionRiskBadge({ risk }: { risk: string }) {
  return <Badge tone={RISK_TONE[risk] ?? "neutral"}>{risk.replace(/_/g, " ")}</Badge>;
}

const PRIORITY_TONE: Record<string, string> = { LOW: "neutral", MEDIUM: "info", HIGH: "warn", URGENT: "danger" };

export function ProductionPriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{priority}</Badge>;
}
