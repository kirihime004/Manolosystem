import { CheckCircle2, UserPlus, Ticket as TicketIcon, ArrowRightCircle, type LucideIcon } from "lucide-react";
import type { TicketDetail } from "@/features/it/tickets/types";

interface FeedEntry {
  id: string;
  at: string;
  icon: LucideIcon;
  label: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketActivityFeed({ ticket }: { ticket: TicketDetail }) {
  const entries: FeedEntry[] = [
    ...ticket.statusHistory.map((h) => ({
      id: `status-${h.id}`,
      at: h.created_at,
      icon: h.new_status === "RESOLVED" || h.new_status === "CLOSED" ? CheckCircle2 : ArrowRightCircle,
      label: h.old_status ? `Status changed: ${h.old_status} → ${h.new_status}` : `Ticket created (${h.new_status})`,
    })),
    ...ticket.assignments.map((a) => ({
      id: `assign-${a.id}`,
      at: a.created_at,
      icon: UserPlus,
      label: a.assigned_to ? "Ticket assigned" : "Ticket unassigned",
    })),
    ...ticket.attachments.map((a) => ({
      id: `attachment-${a.id}`,
      at: a.created_at,
      icon: TicketIcon,
      label: `Attachment uploaded: ${a.file_name}`,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <entry.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-foreground">{entry.label}</p>
            <p className="text-xs text-muted-foreground">{formatTime(entry.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
