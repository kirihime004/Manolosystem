import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/types/database";

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  ASSIGNED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  WAITING_FOR_USER: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  WAITING_FOR_VENDOR: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CLOSED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_USER: "Waiting for User",
  WAITING_FOR_VENDOR: "Waiting for Vendor",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  CRITICAL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
