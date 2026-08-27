import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useTasks, usePendingWorkApprovals, useProductionWorkMutations } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { getErrorMessage } from "@/lib/errors";
import type { ProductionWorkEarning } from "@/types/database";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUIRED";

// Every production_work_approvals row still PENDING where the signed-in
// user is the named approver -- built server-side from approval_policies
// at submission time (submit_production_work()), so the chain length and
// who's on it is fully configurable, not hard-coded here.
export default function ApprovedWorkQueuePage() {
  const { company, hasPermission } = useCompany();
  const { data: allPending, isLoading } = usePendingWorkApprovals(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: tasks } = useTasks(company?.id);
  const { decide } = useProductionWorkMutations(company?.id);

  const [decisionTarget, setDecisionTarget] = useState<{ approvalId: string; decision: Decision; earning: ProductionWorkEarning } | null>(null);
  const [approvedQty, setApprovedQty] = useState("");
  const [comments, setComments] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.name]));

  // "Decidable by me right now": I hold the level's required permission,
  // and no earlier sequence for the same work item is still pending --
  // the exact same two gates decide_production_work() itself enforces
  // server-side.
  const approvals = (allPending ?? []).filter(
    (a) => hasPermission(a.required_permission) && !(allPending ?? []).some((o) => o.work_earning_id === a.work_earning_id && o.sequence < a.sequence),
  );

  const openDecision = (approvalId: string, decision: Decision, earning: ProductionWorkEarning) => {
    setDecisionTarget({ approvalId, decision, earning });
    setApprovedQty(String(earning.requested_quantity));
    setComments("");
  };

  const handleConfirm = async () => {
    if (!decisionTarget) return;
    try {
      await decide.mutateAsync({
        approvalId: decisionTarget.approvalId,
        decision: decisionTarget.decision,
        approvedQuantity: decisionTarget.decision === "APPROVED" ? Number(approvedQty) : null,
        comments: comments || null,
      });
      toast.success(
        decisionTarget.decision === "APPROVED" ? "Approved" : decisionTarget.decision === "REJECTED" ? "Rejected" : "Changes requested",
      );
      setDecisionTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record decision"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Approved Work</h1>
        <p className="text-sm text-muted-foreground">Submitted production work awaiting your approval decision</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !approvals || approvals.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing pending" description="No submitted work is waiting on your decision." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Employee</TableHead><TableHead>Task</TableHead><TableHead>Quantity</TableHead><TableHead>Requested amount</TableHead><TableHead>Submitted</TableHead><TableHead className="w-56" /></TableRow>
            </TableHeader>
            <TableBody>
              {approvals.filter((a) => a.work_earning).map((a) => {
                const earning = a.work_earning!;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{employeeMap.get(earning.employee_id) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{taskMap.get(earning.task_id) ?? "—"}</TableCell>
                    <TableCell>{earning.requested_quantity}</TableCell>
                    <TableCell><Money amount={earning.requested_amount} currencyId={earning.currency_id} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{earning.submitted_at ? new Date(earning.submitted_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openDecision(a.id, "APPROVED", earning)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => openDecision(a.id, "CHANGES_REQUIRED", earning)}>Changes</Button>
                        <Button size="sm" variant="destructive" onClick={() => openDecision(a.id, "REJECTED", earning)}>Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!decisionTarget} onOpenChange={(o) => !o && setDecisionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.decision === "APPROVED" ? "Approve work" : decisionTarget?.decision === "REJECTED" ? "Reject work" : "Request changes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {decisionTarget?.decision === "APPROVED" && (
              <div className="space-y-1.5">
                <Label>Approved quantity (requested: {decisionTarget.earning.requested_quantity})</Label>
                <Input type="number" min="0" max={decisionTarget.earning.requested_quantity} step="0.01" value={approvedQty} onChange={(e) => setApprovedQty(e.target.value)} />
                <p className="text-xs text-muted-foreground">Approving less than requested is a partial approval — both figures stay on record.</p>
              </div>
            )}
            <div className="space-y-1.5"><Label>Comments</Label><Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleConfirm}
              disabled={decide.isPending || (decisionTarget?.decision === "APPROVED" && (!approvedQty || Number(approvedQty) <= 0))}
              variant={decisionTarget?.decision === "REJECTED" ? "destructive" : "default"}
            >
              {decide.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
