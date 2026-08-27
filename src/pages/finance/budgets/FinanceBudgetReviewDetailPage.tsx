import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useBudget, useBudgetLines, useBudgetHistory, useBudgetCategories, useBudgetMutations,
} from "@/features/it/procurement/hooks";
import { BUDGET_MODULE_CONFIG } from "@/features/it/procurement/budgetModuleConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { BudgetStatusBadge } from "@/components/shared/ProcurementBadges";

export default function FinanceBudgetReviewDetailPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { company } = useCompany();
  const { data: budget, isLoading } = useBudget(budgetId);
  const { data: lines } = useBudgetLines(budgetId);
  const { data: history } = useBudgetHistory(budgetId);
  const { data: categories } = useBudgetCategories(company?.id);
  const { beginReview, approve, returnForRevision, reject } = useBudgetMutations(budgetId);

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [approveComments, setApproveComments] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!budget) return <ErrorScreen title="Budget not found" description="This budget does not exist or you do not have access to it." />;

  const config = BUDGET_MODULE_CONFIG[budget.module_key];
  const requestedTotal = (lines ?? []).reduce((sum, l) => sum + l.requested_amount, 0);
  const overrideTotal = (lines ?? []).reduce((sum, l) => {
    const raw = overrides[l.id];
    return sum + (raw !== undefined && raw !== "" ? Number(raw) : l.requested_amount);
  }, 0);
  const canDecide = budget.status === "FINANCE_REVIEW" || budget.status === "SUBMITTED_TO_FINANCE";

  const handleBeginReview = async () => {
    if (!budgetId) return;
    try {
      await beginReview.mutateAsync(budgetId);
      toast.success("Marked as under review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start review");
    }
  };

  const handleApprove = async () => {
    if (!budgetId) return;
    const hasOverrides = Object.values(overrides).some((v) => v !== "");
    try {
      await approve.mutateAsync({
        budgetId,
        lineApprovals: hasOverrides
          ? (lines ?? []).map((l) => ({ budgetLineId: l.id, approvedAmount: overrides[l.id] !== undefined && overrides[l.id] !== "" ? Number(overrides[l.id]) : l.requested_amount }))
          : undefined,
        comments: approveComments || null,
      });
      toast.success(`Approved for ${overrideTotal}`);
      setApproveComments("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve budget");
    }
  };

  const handleReturn = async () => {
    if (!budgetId) return;
    try {
      await returnForRevision.mutateAsync({ budgetId, reason: returnReason });
      toast.success("Returned to the department for revision");
      setReturnOpen(false);
      setReturnReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return budget");
    }
  };

  const handleReject = async () => {
    if (!budgetId) return;
    try {
      await reject.mutateAsync({ budgetId, reason: rejectReason });
      toast.success("Budget rejected");
      setRejectOpen(false);
      setRejectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject budget");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{budget.budget_name}</h1>
          <p className="text-sm text-muted-foreground">
            {config.label} · {budget.budget_code ?? "—"} · FY {budget.fiscal_year}
          </p>
        </div>
        <BudgetStatusBadge status={budget.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Requested</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={requestedTotal} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Committed</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.committed} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Spent</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.spent} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">If approved as-is</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={overrideTotal} currencyId={budget.currency_id} /></p></CardContent></Card>
      </div>

      {budget.status === "SUBMITTED_TO_FINANCE" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <Button size="sm" onClick={handleBeginReview} disabled={beginReview.isPending}>Start review</Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4"><p className="text-sm font-semibold text-foreground">Budget lines — adjust approved amounts if needed</p></div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Requested</TableHead><TableHead>Approved amount</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {(lines ?? []).map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.description}</TableCell>
                <TableCell className="text-muted-foreground">{categories?.find((c) => c.id === l.category_id)?.name ?? "—"}</TableCell>
                <TableCell><Money amount={l.requested_amount} currencyId={budget.currency_id} /></TableCell>
                <TableCell>
                  <Input
                    type="number" step="0.01" className="w-32" disabled={!canDecide}
                    placeholder={String(l.requested_amount)}
                    value={overrides[l.id] ?? ""}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  />
                </TableCell>
              </TableRow>
            ))}
            {(!lines || lines.length === 0) && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No line items.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canDecide && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex-1 space-y-1.5 min-w-[240px]">
            <Label>Comments (optional)</Label>
            <Textarea rows={2} value={approveComments} onChange={(e) => setApproveComments(e.target.value)} />
          </div>
          <Button onClick={handleApprove} disabled={approve.isPending}>{approve.isPending ? "Approving…" : "Approve"}</Button>
          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <Button variant="outline" onClick={() => setReturnOpen(true)}>Return for revision</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>Return for revision</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={3} required value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. Please reduce software spending by 200,000." /></div>
                <DialogFooter><Button onClick={handleReturn} disabled={returnForRevision.isPending || !returnReason.trim()}>{returnForRevision.isPending ? "Returning…" : "Return"}</Button></DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <Button variant="destructive" onClick={() => setRejectOpen(true)}>Reject</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>Reject this budget</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={3} required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div>
                <DialogFooter><Button variant="destructive" onClick={handleReject} disabled={reject.isPending || !rejectReason.trim()}>{reject.isPending ? "Rejecting…" : "Reject"}</Button></DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4"><p className="text-sm font-semibold text-foreground">History</p></div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>When</TableHead><TableHead>Event</TableHead><TableHead>Notes</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {(history ?? []).map((h) => (
              <TableRow key={h.id}>
                <TableCell className="text-muted-foreground text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{h.event_type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-muted-foreground">{h.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
            {(!history || history.length === 0) && (
              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No history yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
