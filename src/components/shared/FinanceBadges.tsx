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

// One shared tone map across every Finance status enum -- they reuse the
// same vocabulary (DRAFT/APPROVED/PAID/VOID/...) so a single generic badge
// covers journals, bills, invoices, expenses, payroll runs, and periods.
const STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  SUBMITTED: "warn",
  MANAGER_APPROVED: "warn",
  FINANCE_REVIEW: "warn",
  UNDER_REVIEW: "warn",
  PROCESSING: "warn",
  REVIEW: "warn",
  APPROVED: "success",
  POSTED: "success",
  SENT: "info",
  ACTIVE: "success",
  OPEN: "success",
  PARTIALLY_PAID: "warn",
  PAID: "success",
  CLOSED: "neutral",
  LOCKED: "accent",
  OVERDUE: "danger",
  REJECTED: "danger",
  MISMATCH: "danger",
  MATCHED: "success",
  NOT_APPLICABLE: "neutral",
  REVERSED: "accent",
  VOID: "danger",
  CANCELLED: "neutral",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  COMPLETED: "success",
  IN_PROGRESS: "warn",
};

export function FinanceStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[STATUS_TONE[status] ?? "neutral"])}>{status.replace(/_/g, " ")}</span>;
}

const AGING_BUCKET_TONE: Record<string, string> = {
  Current: "success",
  "1-30": "warn",
  "31-60": "warn",
  "61-90": "danger",
  "90+": "danger",
};

export function AgingBucketBadge({ bucket }: { bucket: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[AGING_BUCKET_TONE[bucket] ?? "neutral"])}>{bucket}</span>;
}
