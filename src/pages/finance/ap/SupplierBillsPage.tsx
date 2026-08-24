import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Receipt, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useSupplierBills, useSupplierBillMutations } from "@/features/finance/hooks";
import { useSuppliers } from "@/features/it/inventory/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function SupplierBillsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const [status, setStatus] = useState("");
  const { data: bills, isLoading } = useSupplierBills(company?.id, status ? { status } : {});
  const { data: suppliers } = useSuppliers(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { create } = useSupplierBillMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !currencySettings) return;
    try {
      const bill = await create.mutateAsync({
        companyId: company.id, supplierId, billDate, dueDate, currencyId: currencySettings.base_currency_id,
      });
      toast.success(`${bill.bill_number} created`);
      setOpen(false);
      window.location.href = `/c/${companySlug}/finance/ap/bills/${bill.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bill");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills?.length ?? 0} supplier bills</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Can permission={PERMISSIONS.FINANCE_AP_CREATE}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New bill</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New supplier bill</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Supplier</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Bill date</Label><Input type="date" required value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={!supplierId || create.isPending}>{create.isPending ? "Creating…" : "Create bill"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !bills || bills.length === 0 ? (
          <EmptyState icon={Receipt} title="No bills yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Bill #</TableHead><TableHead>Supplier</TableHead><TableHead>Due date</TableHead><TableHead>Total</TableHead><TableHead>Outstanding</TableHead><TableHead>Match</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => {
                const supplier = (suppliers ?? []).find((s) => s.id === b.supplier_id);
                return (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/ap/bills/${b.id}`)}>
                    <TableCell><Link to={`/c/${companySlug}/finance/ap/bills/${b.id}`} className="font-medium text-foreground hover:underline">{b.bill_number}</Link></TableCell>
                    <TableCell>{supplier?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{b.due_date}</TableCell>
                    <TableCell><Money amount={b.total} currencyId={b.currency_id} /></TableCell>
                    <TableCell><Money amount={b.total - b.paid_amount} currencyId={b.currency_id} /></TableCell>
                    <TableCell><FinanceStatusBadge status={b.match_status} /></TableCell>
                    <TableCell><FinanceStatusBadge status={b.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
