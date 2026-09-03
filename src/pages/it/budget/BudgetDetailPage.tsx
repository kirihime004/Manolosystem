import { useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useBudget,
  useBudgetCategories,
  useBudgetCategorySummaries,
  useBudgetTransactions,
  useBudgetLines,
  useBudgetHistory,
  useBudgetMutations,
  useBudgetRevisions,
} from "@/features/it/procurement/hooks";
import { BUDGET_MODULE_CONFIG } from "@/features/it/procurement/budgetModuleConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { BudgetStatusBadge, ApprovalDecisionBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

const EDITABLE_STATUSES = ["DRAFT", "DEPARTMENT_REVIEW", "RETURNED_FOR_REVISION"];
const CANCELLABLE_STATUSES = ["DRAFT", "DEPARTMENT_REVIEW", "SUBMITTED_TO_FINANCE", "FINANCE_REVIEW", "RETURNED_FOR_REVISION"];

export default function BudgetDetailPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { company, hasPermission } = useCompany();
  const { data: budget, isLoading } = useBudget(budgetId);
  const { data: categories } = useBudgetCategories(company?.id);
  const { data: categorySummaries } = useBudgetCategorySummaries(budgetId);
  const { data: transactions } = useBudgetTransactions(budgetId);
  const { data: lines } = useBudgetLines(budgetId);
  const { data: history } = useBudgetHistory(budgetId);
  const { data: revisions } = useBudgetRevisions(budgetId);
  const {
    setAllocation, createAdjustment, createLine, deleteLine,
    submitToFinance, cancel, activate, close, requestIncrease, decideRevision,
  } = useBudgetMutations(budgetId);

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocCategoryId, setAllocCategoryId] = useState("");
  const [allocAmount, setAllocAmount] = useState("");

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjType, setAdjType] = useState<"ADJUSTMENT" | "REFUND">("ADJUSTMENT");
  const [adjSign, setAdjSign] = useState<"1" | "-1">("1");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjCategoryId, setAdjCategoryId] = useState("none");
  const [adjDescription, setAdjDescription] = useState("");

  const [lineOpen, setLineOpen] = useState(false);
  const [lineCategoryId, setLineCategoryId] = useState("none");
  const [lineDescription, setLineDescription] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitCost, setLineUnitCost] = useState("0");
  const [lineAmount, setLineAmount] = useState("");

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitComments, setSubmitComments] = useState("");

  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState("");
  const [increaseReason, setIncreaseReason] = useState("");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!budget) return <ErrorScreen title="Budget not found" description="This budget does not exist or you do not have access to it." />;

  const config = BUDGET_MODULE_CONFIG[budget.module_key];
  const allocatedCategoryIds = new Set((categorySummaries ?? []).map((c) => c.category_id));
  const unallocatedCategories = (categories ?? []).filter((c) => !allocatedCategoryIds.has(c.id));
  const unallocated = budget.total_budget - budget.allocated;
  const isEditable = EDITABLE_STATUSES.includes(budget.status);
  const canEdit = hasPermission(config.updatePermission) || hasPermission(config.createPermission);
  const requestedTotal = (lines ?? []).reduce((sum, l) => sum + l.requested_amount, 0);
  const approvedTotal = (lines ?? []).reduce((sum, l) => sum + (l.approved_amount ?? 0), 0);
  const anyApproved = (lines ?? []).some((l) => l.approved_amount != null);

  const handleAllocate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !budgetId) return;
    try {
      await setAllocation.mutateAsync({ companyId: company.id, budgetId, categoryId: allocCategoryId, allocatedAmount: Number(allocAmount) });
      toast.success("Allocation saved");
      setAllocOpen(false);
      setAllocCategoryId(""); setAllocAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save allocation");
    }
  };

  const handleAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    if (!budgetId) return;
    try {
      await createAdjustment.mutateAsync({
        budgetId,
        categoryId: adjCategoryId === "none" ? null : adjCategoryId,
        amount: Number(adjAmount),
        currencyId: budget.currency_id,
        type: adjType,
        sign: Number(adjSign) as 1 | -1,
        description: adjDescription || null,
      });
      toast.success("Recorded");
      setAdjOpen(false);
      setAdjAmount(""); setAdjDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record adjustment");
    }
  };

  const handleAddLine = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !budgetId) return;
    try {
      await createLine.mutateAsync({
        companyId: company.id, budgetId, moduleKey: budget.module_key,
        categoryId: lineCategoryId === "none" ? null : lineCategoryId,
        description: lineDescription.trim(), quantity: Number(lineQuantity), unitCost: Number(lineUnitCost),
        requestedAmount: Number(lineAmount), currencyId: budget.currency_id,
      });
      toast.success("Line added");
      setLineOpen(false);
      setLineCategoryId("none"); setLineDescription(""); setLineQuantity("1"); setLineUnitCost("0"); setLineAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add line");
    }
  };

  const handleDeleteLine = async (id: string) => {
    try {
      await deleteLine.mutateAsync(id);
      toast.success("Line removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove line");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!budgetId) return;
    try {
      await submitToFinance.mutateAsync({ budgetId, comments: submitComments || null });
      toast.success("Submitted to Finance for approval");
      setSubmitOpen(false);
      setSubmitComments("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit budget");
    }
  };

  const handleCancel = async () => {
    if (!budgetId) return;
    try {
      await cancel.mutateAsync({ budgetId });
      toast.success("Budget cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel budget");
    }
  };

  const handleActivate = async () => {
    if (!budgetId) return;
    try {
      await activate.mutateAsync(budgetId);
      toast.success("Budget activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate budget");
    }
  };

  const handleRequestIncrease = async (e: FormEvent) => {
    e.preventDefault();
    if (!budgetId) return;
    try {
      await requestIncrease.mutateAsync({ budgetId, additionalAmount: Number(increaseAmount), reason: increaseReason });
      toast.success("Increase requested — awaiting Finance approval");
      setIncreaseOpen(false);
      setIncreaseAmount(""); setIncreaseReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request increase");
    }
  };

  const handleDecideRevision = async (revisionId: string, decision: "APPROVED" | "REJECTED") => {
    try {
      await decideRevision.mutateAsync({ revisionId, decision });
      toast.success(decision === "APPROVED" ? "Increase approved" : "Increase rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{budget.budget_name}</h1>
          <p className="text-sm text-muted-foreground">
            {config.label} · {budget.budget_code ?? "—"} · FY {budget.fiscal_year} · {new Date(budget.start_date).toLocaleDateString()} – {new Date(budget.end_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BudgetStatusBadge status={budget.status} />
          {isEditable && canEdit && (
            <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
              <Button size="sm" onClick={() => setSubmitOpen(true)} disabled={(lines ?? []).length === 0}>Submit to Finance</Button>
              <DialogContent>
                <DialogHeader><DialogTitle>Submit for Finance approval</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Requesting <Money amount={requestedTotal} currencyId={budget.currency_id} /> across {(lines ?? []).length} line item(s). Lines cannot be edited once submitted.
                  </p>
                  <div className="space-y-1.5"><Label>Notes for Finance (optional)</Label><Textarea rows={2} value={submitComments} onChange={(e) => setSubmitComments(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={submitToFinance.isPending}>{submitToFinance.isPending ? "Submitting…" : "Submit"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {CANCELLABLE_STATUSES.includes(budget.status) && canEdit && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={cancel.isPending}>Cancel</Button>
          )}
          {budget.status === "APPROVED" && canEdit && (
            <Button size="sm" onClick={handleActivate} disabled={activate.isPending}>Activate</Button>
          )}
          {(budget.status === "APPROVED" || budget.status === "ACTIVE") && canEdit && (
            <Dialog open={increaseOpen} onOpenChange={setIncreaseOpen}>
              <Button size="sm" variant="outline" onClick={() => setIncreaseOpen(true)}>Request increase</Button>
              <DialogContent>
                <DialogHeader><DialogTitle>Request a budget increase</DialogTitle></DialogHeader>
                <form onSubmit={handleRequestIncrease} className="space-y-4">
                  <div className="space-y-1.5"><Label>Additional amount</Label><Input type="number" step="0.01" required value={increaseAmount} onChange={(e) => setIncreaseAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={2} required value={increaseReason} onChange={(e) => setIncreaseReason(e.target.value)} /></div>
                  <p className="text-xs text-muted-foreground">Requires Finance approval — the current approved amount stays in effect until then.</p>
                  <DialogFooter><Button type="submit" disabled={requestIncrease.isPending}>{requestIncrease.isPending ? "Requesting…" : "Request"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {budget.status === "RETURNED_FOR_REVISION" && budget.return_reason && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">Returned for revision</p>
          <p className="mt-1 text-muted-foreground">{budget.return_reason}</p>
        </div>
      )}
      {(budget.status === "REJECTED" || budget.status === "CANCELLED") && budget.return_reason && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm">
          <p className="font-medium text-red-700 dark:text-red-400">{budget.status === "REJECTED" ? "Rejected" : "Cancelled"}</p>
          <p className="mt-1 text-muted-foreground">{budget.return_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Requested</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{budget.total_requested != null ? <Money amount={budget.total_requested} currencyId={budget.currency_id} /> : "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Approved</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{budget.total_approved != null ? <Money amount={budget.total_approved} currencyId={budget.currency_id} /> : "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Committed</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.committed} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Spent</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.spent} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-emerald-600">Available</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.available} currencyId={budget.currency_id} /></p></CardContent></Card>
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="categories">Category Allocation</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Requested total: <Money amount={requestedTotal} currencyId={budget.currency_id} />
              {anyApproved && <> · Approved total: <Money amount={approvedTotal} currencyId={budget.currency_id} /></>}
            </p>
            {isEditable && canEdit && (
              <Dialog open={lineOpen} onOpenChange={setLineOpen}>
                <Button size="sm" onClick={() => setLineOpen(true)}><Plus className="h-3.5 w-3.5" />Add line</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add a budget line</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddLine} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={lineCategoryId} onValueChange={setLineCategoryId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Description</Label><Input required value={lineDescription} onChange={(e) => setLineDescription(e.target.value)} placeholder="e.g. Laptop replacements" /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="0.01" value={lineQuantity} onChange={(e) => setLineQuantity(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Unit cost</Label><Input type="number" step="0.01" value={lineUnitCost} onChange={(e) => setLineUnitCost(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Requested amount</Label><Input type="number" step="0.01" required value={lineAmount} onChange={(e) => setLineAmount(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button type="submit" disabled={createLine.isPending}>{createLine.isPending ? "Adding…" : "Add line"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead>
                  <TableHead>Unit cost</TableHead><TableHead>Requested</TableHead><TableHead>Approved</TableHead>
                  {isEditable && canEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lines ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.description}</TableCell>
                    <TableCell className="text-muted-foreground">{categories?.find((c) => c.id === l.category_id)?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.quantity}</TableCell>
                    <TableCell className="text-muted-foreground"><Money amount={l.unit_cost} currencyId={budget.currency_id} /></TableCell>
                    <TableCell><Money amount={l.requested_amount} currencyId={budget.currency_id} /></TableCell>
                    <TableCell className="font-medium">{l.approved_amount != null ? <Money amount={l.approved_amount} currencyId={budget.currency_id} /> : "—"}</TableCell>
                    {isEditable && canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLine(l.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!lines || lines.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No line items yet — add at least one before submitting to Finance.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Unallocated: <Money amount={unallocated} currencyId={budget.currency_id} /></p>
            <Can permission={config.updatePermission}>
              <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
                <Button size="sm" onClick={() => setAllocOpen(true)}><Plus className="h-3.5 w-3.5" />Allocate category</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Allocate budget to a category</DialogTitle></DialogHeader>
                  <form onSubmit={handleAllocate} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={allocCategoryId} onValueChange={setAllocCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Allocated amount</Label><Input type="number" step="0.01" required value={allocAmount} onChange={(e) => setAllocAmount(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={setAllocation.isPending || !allocCategoryId}>{setAllocation.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Category</TableHead><TableHead>Allocated</TableHead><TableHead>Committed</TableHead><TableHead>Spent</TableHead><TableHead>Available</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(categorySummaries ?? []).map((c) => (
                  <TableRow key={c.category_id}>
                    <TableCell className="font-medium">{c.category_name}</TableCell>
                    <TableCell><Money amount={c.allocated_amount} currencyId={budget.currency_id} /></TableCell>
                    <TableCell className="text-muted-foreground"><Money amount={c.committed} currencyId={budget.currency_id} /></TableCell>
                    <TableCell className="text-muted-foreground"><Money amount={c.spent} currencyId={budget.currency_id} /></TableCell>
                    <TableCell className="font-medium"><Money amount={c.available} currencyId={budget.currency_id} /></TableCell>
                  </TableRow>
                ))}
                {unallocatedCategories.length > 0 && categorySummaries && categorySummaries.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No categories allocated yet — this happens automatically when Finance approves the budget's lines.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={config.updatePermission}>
              <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
                <Button size="sm" variant="outline" onClick={() => setAdjOpen(true)}>Record adjustment</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record a budget adjustment</DialogTitle></DialogHeader>
                  <form onSubmit={handleAdjustment} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={adjType} onValueChange={(v) => setAdjType(v as "ADJUSTMENT" | "REFUND")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ADJUSTMENT">Adjustment</SelectItem><SelectItem value="REFUND">Refund</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {adjType === "ADJUSTMENT" && (
                        <div className="space-y-1.5">
                          <Label>Direction</Label>
                          <Select value={adjSign} onValueChange={(v) => setAdjSign(v as "1" | "-1")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">Increase spent</SelectItem><SelectItem value="-1">Decrease spent</SelectItem></SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" required value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Category (optional)</Label>
                      <Select value={adjCategoryId} onValueChange={setAdjCategoryId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={adjDescription} onChange={(e) => setAdjDescription(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={createAdjustment.isPending}>{createAdjustment.isPending ? "Saving…" : "Record"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(transactions ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{t.transaction_type}</TableCell>
                    <TableCell><Money amount={t.amount * t.adjustment_sign} currencyId={t.currency_id} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{t.reference_type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No transactions yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>When</TableHead><TableHead>Event</TableHead><TableHead>Status change</TableHead><TableHead>Amount</TableHead><TableHead>Notes</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(history ?? []).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-muted-foreground text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{h.event_type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{h.previous_status ?? "—"} → {h.new_status ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.amount != null ? <Money amount={h.amount} currencyId={budget.currency_id} /> : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!history || history.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No history yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="revisions" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {!revisions || revisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No increase requests on record.</p>
              ) : (
                <ol className="space-y-4">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          v{r.version} — <Money amount={r.previous_amount} currencyId={budget.currency_id} /> → <Money amount={r.new_amount} currencyId={budget.currency_id} />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">"{r.reason}"</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "PENDING" ? (
                          <Can permission={PERMISSIONS.BUDGET_FINANCE_APPROVE}>
                            <Button size="sm" variant="outline" onClick={() => handleDecideRevision(r.id, "APPROVED")} disabled={decideRevision.isPending}>Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDecideRevision(r.id, "REJECTED")} disabled={decideRevision.isPending}>Reject</Button>
                          </Can>
                        ) : (
                          <ApprovalDecisionBadge decision={r.status} />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="pt-4">
          <Card className="max-w-lg">
            <CardContent className="space-y-4 pt-6">
              <DetailRow label="Fiscal year" value={budget.fiscal_year} />
              <DetailRow label="Start date" value={new Date(budget.start_date).toLocaleDateString()} />
              <DetailRow label="End date" value={new Date(budget.end_date).toLocaleDateString()} />
              <DetailRow label="Description" value={budget.description ?? "—"} />
              <DetailRow label="Notes" value={budget.notes ?? "—"} />
              <DetailRow label="Status" value={<BudgetStatusBadge status={budget.status} />} />
              {budget.submitted_at && <DetailRow label="Submitted" value={new Date(budget.submitted_at).toLocaleString()} />}
              {budget.approved_at && <DetailRow label="Approved" value={new Date(budget.approved_at).toLocaleString()} />}
              {budget.rejected_at && <DetailRow label="Rejected" value={new Date(budget.rejected_at).toLocaleString()} />}
              <Can permission={[PERMISSIONS.IT_BUDGET_CLOSE, PERMISSIONS.BUDGET_FINANCE_APPROVE]}>
                {(budget.status === "ACTIVE" || budget.status === "APPROVED") && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={close.isPending}
                      onClick={async () => {
                        try {
                          await close.mutateAsync(budget.id);
                          toast.success("Budget closed");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to close budget");
                        }
                      }}
                    >
                      Close budget
                    </Button>
                  </div>
                )}
              </Can>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
