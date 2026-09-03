import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyMembers, useTicketMutations } from "@/features/it/tickets/hooks";
import { AssetPicker } from "@/features/it/tickets/components/AssetPicker";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TicketDetail } from "@/features/it/tickets/types";
import type { TicketPriority, TicketStatus } from "@/types/database";

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_VENDOR", "RESOLVED", "CLOSED", "CANCELLED",
];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function TicketSidebarActions({ ticket }: { ticket: TicketDetail }) {
  const { company } = useCompany();
  const { data: members } = useCompanyMembers(company?.id);
  const { assign, changeStatus, changePriority, updateAsset } = useTicketMutations(ticket.id);

  const runMutation = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-5">
      <Can permission={PERMISSIONS.IT_TICKETS_ASSIGN}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assigned technician</Label>
          <Select
            value={ticket.assigned_to ?? "unassigned"}
            onValueChange={(v) =>
              runMutation(
                () => assign.mutateAsync(v === "unassigned" ? null : v),
                "Assignment updated",
              )
            }
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Can>

      <Can permission={PERMISSIONS.IT_TICKETS_UPDATE}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Linked asset</Label>
          <AssetPicker
            companyId={company?.id}
            value={ticket.asset_id}
            initialAsset={ticket.asset ? { id: ticket.asset_id!, ...ticket.asset } : null}
            onChange={(assetId) =>
              runMutation(() => updateAsset.mutateAsync(assetId), assetId ? "Asset linked" : "Asset unlinked")
            }
          />
        </div>
      </Can>

      <Can permission={PERMISSIONS.IT_TICKETS_UPDATE}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <Select
            value={ticket.priority}
            onValueChange={(v) => runMutation(() => changePriority.mutateAsync(v), "Priority updated")}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Can>

      <Can
        permission={[
          PERMISSIONS.IT_TICKETS_UPDATE,
          PERMISSIONS.IT_TICKETS_RESOLVE,
          PERMISSIONS.IT_TICKETS_CLOSE,
        ]}
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={ticket.status}
            onValueChange={(v) => runMutation(() => changeStatus.mutateAsync(v), "Status updated")}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Can>

      <div className="flex flex-col gap-2 pt-1">
        <Can permission={PERMISSIONS.IT_TICKETS_RESOLVE}>
          {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runMutation(() => changeStatus.mutateAsync("RESOLVED"), "Ticket resolved")}
            >
              Mark Resolved
            </Button>
          )}
        </Can>
        <Can permission={PERMISSIONS.IT_TICKETS_CLOSE}>
          {ticket.status !== "CLOSED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runMutation(() => changeStatus.mutateAsync("CLOSED"), "Ticket closed")}
            >
              Close Ticket
            </Button>
          )}
        </Can>
      </div>
    </div>
  );
}
