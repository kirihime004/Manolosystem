import { cn } from "@/lib/utils";
import type { AssetCondition, AssetStatus, IpStatus, RepairStatus } from "@/types/database";

const STATUS_STYLES: Record<AssetStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  UNASSIGNED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  REPAIR: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  DEFECTIVE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  LOST: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  DISPOSED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  RETIRED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  RESERVED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  EXPIRED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  CANCELLED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  SUSPENDED: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLES[status])}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const CONDITION_STYLES: Record<AssetCondition, string> = {
  NEW: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  GOOD: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  FAIR: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  POOR: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  DEFECTIVE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  NON_FUNCTIONAL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function AssetConditionBadge({ condition }: { condition: AssetCondition }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", CONDITION_STYLES[condition])}>
      {condition.replace(/_/g, " ")}
    </span>
  );
}

const LIFECYCLE_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  NEARING_EOL: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  END_OF_LIFE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  DISPOSED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  RETIRED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  LOST: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  NEARING_EOL: "Nearing end of life",
  END_OF_LIFE: "Over 5 years — replacement review required",
  DISPOSED: "Disposed",
  RETIRED: "Retired",
  LOST: "Lost",
};

export function LifecycleStageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", LIFECYCLE_STYLES[stage] ?? LIFECYCLE_STYLES.ACTIVE)}>
      {LIFECYCLE_LABELS[stage] ?? stage}
    </span>
  );
}

const IP_STATUS_STYLES: Record<IpStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  INACTIVE: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  UNKNOWN: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  RESERVED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  CONFLICT: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function IpStatusBadge({ status }: { status: IpStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", IP_STATUS_STYLES[status])}>
      {status}
    </span>
  );
}

const REPAIR_STATUS_STYLES: Record<RepairStatus, string> = {
  REQUESTED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  IN_REPAIR: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  WAITING_FOR_PARTS: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function RepairStatusBadge({ status }: { status: RepairStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", REPAIR_STATUS_STYLES[status])}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
