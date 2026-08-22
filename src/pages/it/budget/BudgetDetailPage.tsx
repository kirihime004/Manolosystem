import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useBudget,
  useBudgetCategories,
  useBudgetCategorySummaries,
  useBudgetTransactions,
  useBudgetMutations,
} from "@/features/it/procurement/hooks";
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
import { BudgetStatusBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function BudgetDetailPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { company } = useCompany();
  const { data: budget, isLoading } = useBudget(budgetId);
  const { data: categories } = useBudgetCategories(company?.id);
  const { data: categorySummaries } = useBudgetCategorySummaries(budgetId);
  const { data: transactions } = useBudgetTransactions(budgetId);
  const { update, setAllocation, createAdjustment } = useBudgetMutations(budgetId);

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocCategoryId, setAllocCategoryId] = useState("");
  const [allocAmount, setAllocAmount] = useState("");

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjType, setAdjType] = useState<"ADJUSTMENT" | "REFUND">("ADJUSTMENT");
  const [adjSign, setAdjSign] = useState<"1" | "-1">("1");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjCategoryId, setAdjCategoryId] = useState("none");
  const [adjDescription, setAdjDescription] = useState("");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!budget) return <ErrorScreen title="Budget not found" description="This budget does not exist or you do not have access to it." />;

  const allocatedCategoryIds = new Set((categorySummaries ?? []).map((c) => c.category_id));
  const unallocatedCategories = (categories ?? []).filter((c) => !allocatedCategoryIds.has(c.id));
  const unallocated = budget.total_budget - budget.allocated;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{budget.budget_name}</h1>
          <p className="text-sm text-muted-foreground">FY {budget.fiscal_year} · {new Date(budget.start_date).toLocaleDateString()} – {new Date(budget.end_date).toLocaleDateString()}</p>
        </div>
        <BudgetStatusBadge status={budget.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.total_budget} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Allocated</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.allocated} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Committed</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.committed} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Spent</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.spent} currencyId={budget.currency_id} /></p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-emerald-600">Available</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold"><Money amount={budget.available} currencyId={budget.currency_id} /></p></CardContent></Card>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Unallocated: <Money amount={unallocated} currencyId={budget.currency_id} /></p>
            <Can permission={PERMISSIONS.IT_BUDGET_UPDATE}>
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
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No categories allocated yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.IT_BUDGET_UPDATE}>
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

        <TabsContent value="details" className="pt-4">
          <Card className="max-w-lg">
            <CardContent className="space-y-4 pt-6">
              <DetailRow label="Fiscal year" value={budget.fiscal_year} />
              <DetailRow label="Start date" value={new Date(budget.start_date).toLocaleDateString()} />
              <DetailRow label="End date" value={new Date(budget.end_date).toLocaleDateString()} />
              <DetailRow label="Description" value={budget.description ?? "—"} />
              <Can permission={[PERMISSIONS.IT_BUDGET_UPDATE, PERMISSIONS.IT_BUDGET_CLOSE]} fallback={<DetailRow label="Status" value={<BudgetStatusBadge status={budget.status} />} />}>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Select
                    value={budget.status}
                    onValueChange={async (v) => {
                      try {
                        await update.mutateAsync({ id: budget.id, patch: { status: v } });
                        toast.success("Budget status updated");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to update status");
                      }
                    }}
                  >
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Can>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
