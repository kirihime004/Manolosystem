import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useTasks, useAllWorkEarnings, useWorkAdjustments, useProductionWorkMutations } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";
import type { ProductionWorkEarning } from "@/types/database";

// Corrections layered on top of an already-decided earning -- never edits
// the original amount, just adds a signed adjustment on record. Only
// available once an earning has actually been approved (create_production_
// work_adjustment() itself enforces that server-side); the queue that
// decides SUBMITTED work lives separately at ApprovedWorkQueuePage.
const VIEWABLE_STATUSES = ["APPROVED", "PAYABLE", "SENT_TO_FINANCE", "IN_PAYROLL", "PAID"];

export default function AllWorkEarningsPage() {
  const { company } = useCompany();
  const { data: earnings, isLoading } = useAllWorkEarnings(company?.id, VIEWABLE_STATUSES);
  const { data: employees } = useEmployees(company?.id);
  const { data: tasks } = useTasks(company?.id);

  const [adjustTarget, setAdjustTarget] = useState<ProductionWorkEarning | null>(null);

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Work Earnings</h1>
        <p className="text-sm text-muted-foreground">Every decided piece of production work, with its full amount and adjustment history</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !earnings || earnings.length === 0 ? (
          <EmptyState icon={Wallet} title="No decided work yet" description="Approved production work will show up here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Employee</TableHead><TableHead>Task</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Approved</TableHead><TableHead className="w-24" /></TableRow>
            </TableHeader>
            <TableBody>
              {earnings.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{employeeMap.get(e.employee_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{taskMap.get(e.task_id) ?? "—"}</TableCell>
                  <TableCell><Money amount={e.approved_amount ?? e.requested_amount} currencyId={e.currency_id} /></TableCell>
                  <TableCell><ProductionStatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{e.approved_at ? new Date(e.approved_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setAdjustTarget(e)}>Details</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AdjustmentDialog
        earning={adjustTarget}
        employeeName={adjustTarget ? employeeMap.get(adjustTarget.employee_id) : undefined}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
      />
    </div>
  );
}

function AdjustmentDialog({ earning, employeeName, onOpenChange }: { earning: ProductionWorkEarning | null; employeeName: string | undefined; onOpenChange: (open: boolean) => void }) {
  const { data: adjustments } = useWorkAdjustments(earning?.id);
  const { createAdjustment } = useProductionWorkMutations(earning?.company_id);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = async () => {
    if (!earning || !amount || !reason.trim()) return;
    try {
      await createAdjustment.mutateAsync({ workEarningId: earning.id, adjustmentAmount: Number(amount), reason });
      toast.success("Adjustment recorded");
      setAmount(""); setReason("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record adjustment"));
    }
  };

  return (
    <Dialog open={!!earning} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{employeeName ?? "Earning"} — adjustment history</DialogTitle></DialogHeader>
        {earning && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Approved amount</span>
              <span className="font-medium text-foreground"><Money amount={earning.approved_amount ?? earning.requested_amount} currencyId={earning.currency_id} /></span>
            </div>

            {(adjustments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No adjustments recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {(adjustments ?? []).map((a) => (
                  <li key={a.id} className="rounded-md border border-border p-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground"><Money amount={a.adjustment_amount} currencyId={earning.currency_id} /></span>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
                  </li>
                ))}
              </ul>
            )}

            <Can permission={PERMISSIONS.PRODUCTION_WORK_ADJUST}>
              <div className="space-y-2 border-t border-border pt-3">
                <Label>Add adjustment</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" placeholder="Amount (+ or −)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
                </div>
                <Textarea rows={2} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </Can>
          </div>
        )}
        <DialogFooter>
          <Can permission={PERMISSIONS.PRODUCTION_WORK_ADJUST}>
            <Button onClick={handleAdd} disabled={createAdjustment.isPending || !amount || !reason.trim()}>
              {createAdjustment.isPending ? "Saving…" : "Record adjustment"}
            </Button>
          </Can>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
