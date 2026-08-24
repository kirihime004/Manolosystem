import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCustomerInvoices, useCustomerInvoiceMutations, useCustomers } from "@/features/finance/hooks";
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

export default function CustomerInvoicesPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const [status, setStatus] = useState("");
  const { data: invoices, isLoading } = useCustomerInvoices(company?.id, status ? { status } : {});
  const { data: customers } = useCustomers(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { create } = useCustomerInvoiceMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !currencySettings) return;
    try {
      const inv = await create.mutateAsync({
        companyId: company.id, customerId, invoiceDate, dueDate, currencyId: currencySettings.base_currency_id,
      });
      toast.success(`${inv.invoice_number} created`);
      setOpen(false);
      window.location.href = `/c/${companySlug}/finance/ar/invoices/${inv.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices?.length ?? 0} customer invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Can permission={PERMISSIONS.FINANCE_AR_CREATE}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New invoice</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New customer invoice</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Invoice date</Label><Input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={!customerId || create.isPending}>{create.isPending ? "Creating…" : "Create invoice"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Due date</TableHead><TableHead>Total</TableHead><TableHead>Outstanding</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const customer = (customers ?? []).find((c) => c.id === inv.customer_id);
                return (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/ar/invoices/${inv.id}`)}>
                    <TableCell><Link to={`/c/${companySlug}/finance/ar/invoices/${inv.id}`} className="font-medium text-foreground hover:underline">{inv.invoice_number}</Link></TableCell>
                    <TableCell>{customer?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.due_date}</TableCell>
                    <TableCell><Money amount={inv.total} currencyId={inv.currency_id} /></TableCell>
                    <TableCell><Money amount={inv.total - inv.paid_amount} currencyId={inv.currency_id} /></TableCell>
                    <TableCell><FinanceStatusBadge status={inv.status} /></TableCell>
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
