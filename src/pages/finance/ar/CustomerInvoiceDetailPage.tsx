import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useCustomerInvoice, useCustomerInvoiceItems, useCustomerInvoicePayments,
  useCustomerInvoiceMutations, useCustomers, useCashAccounts, useChartOfAccounts,
} from "@/features/finance/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function CustomerInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { company } = useCompany();
  const { data: inv, isLoading } = useCustomerInvoice(invoiceId);
  const { data: items } = useCustomerInvoiceItems(invoiceId);
  const { data: payments } = useCustomerInvoicePayments(invoiceId);
  const { data: customers } = useCustomers(company?.id);
  const { data: cashAccounts } = useCashAccounts(company?.id);
  const { data: accounts } = useChartOfAccounts(company?.id);
  const { addItem, deleteItem, send, voidInvoice, recordPayment } = useCustomerInvoiceMutations(company?.id);

  const [itemOpen, setItemOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [tax, setTax] = useState("0");
  const [revenueAccountId, setRevenueAccountId] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [cashAccountId, setCashAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  if (isLoading || !inv) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const customer = (customers ?? []).find((c) => c.id === inv.customer_id);
  const outstanding = inv.total - inv.paid_amount;

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return;
    try {
      await addItem.mutateAsync({
        customerInvoiceId: invoiceId, description, quantity: Number(quantity), unitPrice: Number(unitPrice),
        tax: Number(tax), revenueAccountId: revenueAccountId || null,
      });
      setItemOpen(false);
      setDescription(""); setQuantity("1"); setUnitPrice(""); setTax("0"); setRevenueAccountId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return;
    try {
      await recordPayment.mutateAsync({ customerInvoiceId: invoiceId, cashAccountId, amount: Number(payAmount) });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const runAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{inv.invoice_number}</h1>
            <FinanceStatusBadge status={inv.status} />
          </div>
          <p className="text-sm text-muted-foreground">{customer?.name} · Due {inv.due_date}</p>
        </div>
        <div className="flex gap-2">
          {inv.status === "DRAFT" && (
            <Can permission={PERMISSIONS.FINANCE_AR_APPROVE}>
              <Button onClick={() => runAction(() => send.mutateAsync(inv.id), "Invoice sent")}>Send invoice</Button>
            </Can>
          )}
          {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && (
            <Can permission={PERMISSIONS.FINANCE_AR_RECEIVE_PAYMENT}>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button>Record payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record payment for {inv.invoice_number}</DialogTitle></DialogHeader>
                  <form onSubmit={handlePay} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Cash / bank account</Label>
                      <Select value={cashAccountId} onValueChange={setCashAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>{(cashAccounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount (outstanding: <Money amount={outstanding} currencyId={inv.currency_id} />)</Label>
                      <Input type="number" step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Overpayments are allowed and tracked as customer credit.</p>
                    </div>
                    <DialogFooter><Button type="submit" disabled={!cashAccountId || recordPayment.isPending}>{recordPayment.isPending ? "Recording…" : "Record payment"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          )}
          {["SENT", "OVERDUE"].includes(inv.status) && inv.paid_amount === 0 && (
            <Can permission={PERMISSIONS.FINANCE_AR_APPROVE}>
              <Button variant="ghost" onClick={() => runAction(() => voidInvoice.mutateAsync({ id: inv.id, reason: "Voided from detail page" }), "Voided")}>Void</Button>
            </Can>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          {inv.status === "DRAFT" && (
            <Can permission={PERMISSIONS.FINANCE_AR_CREATE}>
              <Dialog open={itemOpen} onOpenChange={setItemOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />Add item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add item</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <div className="space-y-1.5"><Label>Description</Label><Input required value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="0.01" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Unit price</Label><Input type="number" step="0.01" required value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Tax</Label><Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Revenue account</Label>
                      <Select value={revenueAccountId} onValueChange={setRevenueAccountId}>
                        <SelectTrigger><SelectValue placeholder="Default (Other Revenue)" /></SelectTrigger>
                        <SelectContent>{(accounts ?? []).filter((a) => !a.is_header && a.account_type === "REVENUE").map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={addItem.isPending}>{addItem.isPending ? "Adding…" : "Add item"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit price</TableHead><TableHead>Tax</TableHead><TableHead>Line total</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {(items ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.description}</TableCell>
                  <TableCell>{i.quantity}</TableCell>
                  <TableCell><Money amount={i.unit_price} currencyId={inv.currency_id} /></TableCell>
                  <TableCell><Money amount={i.tax} currencyId={inv.currency_id} /></TableCell>
                  <TableCell className="font-medium"><Money amount={i.line_total} currencyId={inv.currency_id} /></TableCell>
                  <TableCell>
                    {inv.status === "DRAFT" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate({ id: i.id, invoiceId: inv.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex justify-end text-sm">
            <div className="space-y-1 text-right">
              <p className="text-muted-foreground">Subtotal: <Money amount={inv.subtotal} currencyId={inv.currency_id} /></p>
              <p className="text-muted-foreground">Tax: <Money amount={inv.tax} currencyId={inv.currency_id} /></p>
              <p className="font-semibold text-foreground">Total: <Money amount={inv.total} currencyId={inv.currency_id} /></p>
              <p className="text-muted-foreground">Paid: <Money amount={inv.paid_amount} currencyId={inv.currency_id} /></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {payments && payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_number}</TableCell>
                    <TableCell className="text-muted-foreground">{p.payment_date}</TableCell>
                    <TableCell>{p.payment_method.replace(/_/g, " ")}</TableCell>
                    <TableCell><Money amount={p.amount} currencyId={p.currency_id} />{p.is_overpayment && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">overpayment</span>}</TableCell>
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
