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

// Employment status is company-configurable, not a fixed enum -- tone is
// derived from is_active_employment rather than a hard-coded status list.
export function EmploymentStatusBadge({ label, isActive }: { label: string; isActive: boolean }) {
  return <Badge tone={isActive ? "success" : "neutral"}>{label}</Badge>;
}

const REQUEST_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral", SUBMITTED: "info", UNDER_REVIEW: "warn",
  APPROVED: "success", REJECTED: "danger", COMPLETED: "success", CANCELLED: "neutral",
};

export function LeaveRequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={REQUEST_STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
export function OvertimeRequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={REQUEST_STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
export function HrRequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={REQUEST_STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
export function TimesheetStatusBadge({ status }: { status: string }) {
  return <Badge tone={REQUEST_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const APPROVAL_DECISION_TONE: Record<string, string> = { PENDING: "warn", APPROVED: "success", REJECTED: "danger" };
export function ApprovalDecisionBadge({ decision }: { decision: string }) {
  return <Badge tone={APPROVAL_DECISION_TONE[decision] ?? "neutral"}>{decision}</Badge>;
}

const CONTRACT_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral", ACTIVE: "success", EXPIRING: "warn", EXPIRED: "danger", RENEWED: "accent", TERMINATED: "neutral",
};
export function ContractStatusBadge({ status }: { status: string }) {
  return <Badge tone={CONTRACT_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const TASK_STATUS_TONE: Record<string, string> = {
  PENDING: "neutral", IN_PROGRESS: "info", COMPLETED: "success", BLOCKED: "danger", CANCELLED: "neutral",
};
export function TaskStatusBadge({ status }: { status: string }) {
  return <Badge tone={TASK_STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

const ATTENDANCE_STATUS_TONE: Record<string, string> = {
  PRESENT: "success", ABSENT: "danger", LATE: "warn", HALF_DAY: "warn",
  ON_LEAVE: "info", HOLIDAY: "accent", REMOTE: "info", REST_DAY: "neutral",
};
export function AttendanceStatusBadge({ status }: { status: string }) {
  return <Badge tone={ATTENDANCE_STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

const PAYROLL_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral", OPEN: "info", PROCESSING: "warn", REVIEW: "warn", APPROVED: "success", PAID: "success", CLOSED: "neutral",
};
export function PayrollPeriodStatusBadge({ status }: { status: string }) {
  return <Badge tone={PAYROLL_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}
