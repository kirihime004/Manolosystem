import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Receipt, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useExpenses, useExpenseMutations } from "@/features/finance/hooks";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CATEGORIES = ["TRAVEL", "MEALS", "TRANSPORTATION", "TRAINING", "OFFICE", "CLIENT", "PRODUCTION", "IT", "OTHER"];

export default function ExpensesPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const [status, setStatus] = useState("");
  const canViewAll = hasPermission(PERMISSIONS.FINANCE_EXPENSES_VIEW);
  const { data: expenses, isLoading } = useExpenses(company?.id, {
    ...(status ? { status } : {}),
    ...(canViewAll ? {} : { employeeId: myEmployee?.id }),
  });
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { create } = useExpenseMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !currencySettings || !myEmployee) return;
    try {
      const exp = await create.mutateAsync({
        companyId: company.id, employeeId: myEmployee.id, expenseDate, category, description: description.trim(),
        amount: Number(amount), currencyId: currencySettings.base_currency_id,
      });
      toast.success(`${exp.expense_number} created`);
      setOpen(false);
      setDescription(""); setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create expense claim");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses?.length ?? 0} claims</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Can permission={PERMISSIONS.FINANCE_EXPENSES_CREATE}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button disabled={!myEmployee}><Plus className="h-4 w-4" />New claim</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New expense claim</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label><Textarea required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create claim"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !expenses || expenses.length === 0 ? (
          <EmptyState icon={Receipt} title="No expense claims yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Claim #</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/expenses/${exp.id}`)}>
                  <TableCell><Link to={`/c/${companySlug}/finance/expenses/${exp.id}`} className="font-medium text-foreground hover:underline">{exp.expense_number}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{exp.category.replace(/_/g, " ")}</TableCell>
                  <TableCell className="max-w-xs truncate">{exp.description}</TableCell>
                  <TableCell className="text-muted-foreground">{exp.expense_date}</TableCell>
                  <TableCell><Money amount={exp.amount} currencyId={exp.currency_id} /></TableCell>
                  <TableCell><FinanceStatusBadge status={exp.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
