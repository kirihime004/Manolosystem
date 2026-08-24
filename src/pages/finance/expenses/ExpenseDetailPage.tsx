import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useExpense, useExpenseApprovals, useExpenseMutations, useCashAccounts } from "@/features/finance/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CATEGORIES = ["TRAVEL", "MEALS", "TRANSPORTATION", "TRAINING", "OFFICE", "CLIENT", "PRODUCTION", "IT", "OTHER"];

export default function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const { company, hasPermission } = useCompany();
  const { data: exp, isLoading } = useExpense(expenseId);
  const { data: approvals } = useExpenseApprovals(expenseId);
  const { data: cashAccounts } = useCashAccounts(company?.id);
  const { submit, decideApproval, cancel, pay, update, remove } = useExpenseMutations(company?.id);

  const [payOpen, setPayOpen] = useState(false);
  const [cashAccountId, setCashAccountId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("OTHER");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  if (isLoading || !exp) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const runAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handlePay = async () => {
    if (!expenseId) return;
    try {
      await pay.mutateAsync({ id: expenseId, cashAccountId });
      toast.success("Expense paid");
      setPayOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pay expense");
    }
  };

  const openEdit = () => {
    setEditCategory(exp.category);
    setEditDescription(exp.description);
    setEditAmount(String(exp.amount));
    setEditOpen(true);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: exp.id, patch: { category: editCategory, description: editDescription, amount: Number(editAmount) } });
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update expense claim");
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(exp.id);
      toast.success("Expense claim deleted");
      navigate(`/c/${companySlug}/finance/expenses`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense claim");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{exp.expense_number}</h1>
            <FinanceStatusBadge status={exp.status} />
          </div>
          <p className="text-sm text-muted-foreground">{exp.category.replace(/_/g, " ")} · {exp.expense_date}</p>
        </div>
        <div className="flex gap-2">
          {exp.status === "DRAFT" && (
            <>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild><Button variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5" />Edit</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit expense claim</DialogTitle></DialogHeader>
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Description</Label><Textarea required rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" required value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button onClick={() => runAction(() => submit.mutateAsync(exp.id), "Submitted for approval")}>Submit</Button>
              <Button variant="ghost" onClick={() => runAction(() => cancel.mutateAsync(exp.id), "Cancelled")}>Cancel</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost">Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {exp.expense_number}?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes the draft claim. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {exp.status === "APPROVED" && (
            <Can permission={PERMISSIONS.FINANCE_EXPENSES_PAY}>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button>Pay</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Pay {exp.expense_number}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Select value={cashAccountId} onValueChange={setCashAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select cash/bank account" /></SelectTrigger>
                      <SelectContent>{(cashAccounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <DialogFooter><Button disabled={!cashAccountId || pay.isPending} onClick={handlePay}>{pay.isPending ? "Paying…" : "Pay"}</Button></DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </Can>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Description</span><span>{exp.description}</span></div>
          <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Amount</span><Money amount={exp.amount} currencyId={exp.currency_id} /></div>
        </CardContent>
      </Card>

      {approvals && approvals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Approvals</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Required permission</TableHead><TableHead>Decision</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
              <TableBody>
                {approvals.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.sequence}</TableCell>
                    <TableCell className="text-muted-foreground">{a.required_permission}</TableCell>
                    <TableCell><FinanceStatusBadge status={a.decision} /></TableCell>
                    <TableCell>
                      {a.decision === "PENDING" && hasPermission(a.required_permission) && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => decideApproval.mutate({ approvalId: a.id, expenseId: exp.id, decision: "APPROVED" })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => decideApproval.mutate({ approvalId: a.id, expenseId: exp.id, decision: "REJECTED" })}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
