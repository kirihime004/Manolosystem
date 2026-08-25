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

// One shared tone map covers every Admin status enum -- they're all drawn
// from the same small vocabulary (draft/pending tones neutral-to-warn,
// terminal-good states green, terminal-bad states red).
const STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral", SUBMITTED: "info", UNDER_REVIEW: "warn", PENDING_APPROVAL: "warn", PENDING: "warn",
  MANAGER_APPROVED: "info", ADMIN_REVIEW: "warn", FINANCE_REVIEW: "warn",
  APPROVED: "success", REJECTED: "danger", ASSIGNED: "info", IN_PROGRESS: "info",
  WAITING: "warn", WAITING_PARTS: "warn", COMPLETED: "success", CANCELLED: "neutral", CLOSED: "neutral",
  BOOKED: "info", REQUESTED: "info", CONFIRMED: "success", REPORTED: "warn", ASSESSED: "warn", SCHEDULED: "info",
  ISSUED: "success", ACTIVE: "success", INACTIVE: "neutral", EXPIRING: "warn", EXPIRED: "danger", RENEWED: "success",
  TERMINATED: "neutral", AVAILABLE: "success", OCCUPIED: "info", MAINTENANCE: "warn", RESERVED: "info",
  UNAVAILABLE: "neutral", DAMAGED: "danger", LOST: "danger", DISPOSED: "neutral", RETIRED: "neutral",
  ACCIDENT: "danger", REPAIR: "warn", EXPECTED: "info", CHECKED_IN: "success", CHECKED_OUT: "neutral",
  NO_SHOW: "danger", PUBLISHED: "success", RETRACTED: "neutral", RECEIVED: "info", IN_TRANSIT: "info",
  READY_FOR_PICKUP: "info", DELIVERED: "success", RETURNED: "neutral", PLANNING: "info", BLOCKED: "danger",
  ARCHIVED: "neutral", MATCHED: "success", MISMATCH: "warn",
};

export function AdminStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

const PRIORITY_TONE: Record<string, string> = { LOW: "neutral", MEDIUM: "info", HIGH: "warn", URGENT: "danger" };

export function AdminPriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{priority}</Badge>;
}
