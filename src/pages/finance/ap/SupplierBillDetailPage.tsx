import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useSupplierBill, useSupplierBillItems, useSupplierBillApprovals, useSupplierPayments,
  useSupplierBillMutations, useCashAccounts, useChartOfAccounts,
} from "@/features/finance/hooks";
import { useSuppliers } from "@/features/it/inventory/hooks";
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

export default function SupplierBillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const { company, hasPermission } = useCompany();
  const { data: bill, isLoading } = useSupplierBill(billId);
  const { data: items } = useSupplierBillItems(billId);
  const { data: approvals } = useSupplierBillApprovals(billId);
  const { data: payments } = useSupplierPayments(billId);
  const { data: suppliers } = useSuppliers(company?.id);
  const { data: cashAccounts } = useCashAccounts(company?.id);
  const { data: accounts } = useChartOfAccounts(company?.id);
  const { addItem, deleteItem, submit, decideApproval, voidBill, recordPayment } = useSupplierBillMutations(company?.id);

  const [itemOpen, setItemOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [tax, setTax] = useState("0");
  const [accountId, setAccountId] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [cashAccountId, setCashAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  if (isLoading || !bill) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const supplier = (suppliers ?? []).find((s) => s.id === bill.supplier_id);
  const outstanding = bill.total - bill.paid_amount;

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!billId) return;
    try {
      await addItem.mutateAsync({
        supplierBillId: billId, description, quantity: Number(quantity), unitPrice: Number(unitPrice),
        tax: Number(tax), accountId: accountId || null,
      });
      setItemOpen(false);
      setDescription(""); setQuantity("1"); setUnitPrice(""); setTax("0"); setAccountId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!billId) return;
    try {
      await recordPayment.mutateAsync({ supplierBillId: billId, cashAccountId, amount: Number(payAmount) });
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
            <h1 className="text-2xl font-semibold text-foreground">{bill.bill_number}</h1>
            <FinanceStatusBadge status={bill.status} />
            <FinanceStatusBadge status={bill.match_status} />
          </div>
          <p className="text-sm text-muted-foreground">{supplier?.name} · Due {bill.due_date}</p>
        </div>
        <div className="flex gap-2">
          {bill.status === "DRAFT" && (
            <Can permission={PERMISSIONS.FINANCE_AP_CREATE}>
              <Button onClick={() => runAction(() => submit.mutateAsync(bill.id), "Submitted for approval")}>Submit for approval</Button>
            </Can>
          )}
          {(bill.status === "APPROVED" || bill.status === "PARTIALLY_PAID") && (
            <Can permission={PERMISSIONS.FINANCE_AP_PAY}>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button>Record payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record payment for {bill.bill_number}</DialogTitle></DialogHeader>
                  <form onSubmit={handlePay} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Cash / bank account</Label>
                      <Select value={cashAccountId} onValueChange={setCashAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>{(cashAccounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount (outstanding: <Money amount={outstanding} currencyId={bill.currency_id} />)</Label>
                      <Input type="number" step="0.01" required max={outstanding} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    </div>
                    <DialogFooter><Button type="submit" disabled={!cashAccountId || recordPayment.isPending}>{recordPayment.isPending ? "Recording…" : "Record payment"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          )}
          {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(bill.status) && (
            <Can permission={PERMISSIONS.FINANCE_AP_APPROVE}>
              <Button variant="ghost" onClick={() => runAction(() => voidBill.mutateAsync({ id: bill.id }), "Voided")}>Void</Button>
            </Can>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          {bill.status === "DRAFT" && (
            <Can permission={PERMISSIONS.FINANCE_AP_CREATE}>
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
                      <Label>Expense account</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue placeholder="Default (Other Expenses)" /></SelectTrigger>
                        <SelectContent>{(accounts ?? []).filter((a) => !a.is_header && ["EXPENSE", "COGS", "ASSET"].includes(a.account_type)).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
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
                  <TableCell><Money amount={i.unit_price} currencyId={bill.currency_id} /></TableCell>
                  <TableCell><Money amount={i.tax} currencyId={bill.currency_id} /></TableCell>
                  <TableCell className="font-medium"><Money amount={i.line_total} currencyId={bill.currency_id} /></TableCell>
                  <TableCell>
                    {bill.status === "DRAFT" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate({ id: i.id, billId: bill.id })}>
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
              <p className="text-muted-foreground">Subtotal: <Money amount={bill.subtotal} currencyId={bill.currency_id} /></p>
              <p className="text-muted-foreground">Tax: <Money amount={bill.tax} currencyId={bill.currency_id} /></p>
              <p className="font-semibold text-foreground">Total: <Money amount={bill.total} currencyId={bill.currency_id} /></p>
              <p className="text-muted-foreground">Paid: <Money amount={bill.paid_amount} currencyId={bill.currency_id} /></p>
            </div>
          </div>
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
                          <Button size="sm" variant="outline" onClick={() => decideApproval.mutate({ approvalId: a.id, billId: bill.id, decision: "APPROVED" })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => decideApproval.mutate({ approvalId: a.id, billId: bill.id, decision: "REJECTED" })}>Reject</Button>
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
                    <TableCell><Money amount={p.amount} currencyId={p.currency_id} /></TableCell>
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
