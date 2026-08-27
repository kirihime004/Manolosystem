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

const PR_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warn",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  CONVERTED_TO_PO: "accent",
};

export function PurchaseRequestStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[PR_STATUS_TONE[status] ?? "neutral"])}>{status.replace(/_/g, " ")}</span>;
}

const PO_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  APPROVED: "success",
  SENT_TO_SUPPLIER: "info",
  ACKNOWLEDGED: "info",
  PARTIALLY_RECEIVED: "warn",
  RECEIVED: "success",
  CANCELLED: "danger",
  CLOSED: "neutral",
};

export function PurchaseOrderStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[PO_STATUS_TONE[status] ?? "neutral"])}>{status.replace(/_/g, " ")}</span>;
}

const QUOTATION_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral",
  RECEIVED: "info",
  UNDER_REVIEW: "warn",
  SELECTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
};

export function QuotationStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[QUOTATION_STATUS_TONE[status] ?? "neutral"])}>{status.replace(/_/g, " ")}</span>;
}

const APPROVAL_DECISION_TONE: Record<string, string> = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
};

export function ApprovalDecisionBadge({ decision }: { decision: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[APPROVAL_DECISION_TONE[decision] ?? "neutral"])}>{decision}</span>;
}

const BUDGET_STATUS_TONE: Record<string, string> = {
  DRAFT: "neutral",
  DEPARTMENT_REVIEW: "neutral",
  SUBMITTED_TO_FINANCE: "info",
  FINANCE_REVIEW: "info",
  RETURNED_FOR_REVISION: "warn",
  APPROVED: "success",
  ACTIVE: "success",
  CLOSED: "neutral",
  REJECTED: "danger",
  CANCELLED: "neutral",
  ARCHIVED: "neutral",
};

export function BudgetStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[BUDGET_STATUS_TONE[status] ?? "neutral"])}>{status}</span>;
}

const SUPPLIER_STATUS_TONE: Record<string, string> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  BLACKLISTED: "danger",
};

export function SupplierStatusBadge({ status }: { status: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[SUPPLIER_STATUS_TONE[status] ?? "neutral"])}>{status}</span>;
}

const PRIORITY_TONE: Record<string, string> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warn",
  URGENT: "danger",
};

export function RequestPriorityBadge({ priority }: { priority: string }) {
  return <span className={cn(badgeClass, TONE_STYLES[PRIORITY_TONE[priority] ?? "neutral"])}>{priority}</span>;
}
