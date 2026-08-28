import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Send, PackageCheck, Receipt } from "lucide-react";
import { usePurchaseOrder, usePurchaseOrderMutations } from "@/features/it/procurement/hooks";
import { useSupplierBillMutations } from "@/features/finance/hooks";
import { useCompany } from "@/lib/tenant/useCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { PurchaseOrderStatusBadge, ApprovalDecisionBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  const { companySlug, poId } = useParams<{ companySlug: string; poId: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { data: po, isLoading } = usePurchaseOrder(poId);
  const { decideApproval, updateStatus, receiveDelivery } = usePurchaseOrderMutations(poId);
  const { createFromPurchaseOrder } = useSupplierBillMutations(company?.id);

  const [decisionOpen, setDecisionOpen] = useState<{ approvalId: string; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [comments, setComments] = useState("");

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const [billOpen, setBillOpen] = useState(false);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!po) return <ErrorScreen title="Purchase order not found" description="This purchase order does not exist or you do not have access to it." />;

  const config = PROCUREMENT_MODULE_CONFIG[po.module_key];
  const nextApproval = po.approvals.find((a) => a.decision === "PENDING" && !po.approvals.some((o) => o.sequence < a.sequence && o.decision === "PENDING"));
  const openItems = po.items.filter((i) => i.remaining_quantity > 0);

  const handleDecision = async () => {
    if (!decisionOpen) return;
    try {
      await decideApproval.mutateAsync({ approvalId: decisionOpen.approvalId, decision: decisionOpen.decision, comments: comments || null });
      toast.success(decisionOpen.decision === "APPROVED" ? "PO approved" : "PO rejected");
      setDecisionOpen(null);
      setComments("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
    }
  };

  const handleSend = async () => {
    try {
      await updateStatus.mutateAsync({ poId: po.id, status: "SENT_TO_SUPPLIER" });
      toast.success("Sent to supplier");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleCreateBill = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !po) return;
    try {
      const billId = await createFromPurchaseOrder.mutateAsync({ companyId: company.id, purchaseOrderId: po.id, billDate, dueDate });
      toast.success("Draft bill created from received quantities — review before submitting for approval");
      setBillOpen(false);
      navigate(`/c/${companySlug}/finance/ap/bills/${billId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bill");
    }
  };

  const handleReceive = async (e: FormEvent) => {
    e.preventDefault();
    const items = openItems
      .map((i) => ({ purchaseOrderItemId: i.id, quantityReceived: Number(quantities[i.id] || 0) }))
      .filter((i) => i.quantityReceived > 0);
    if (items.length === 0) {
      toast.error("Enter a quantity for at least one item");
      return;
    }
    try {
      await receiveDelivery.mutateAsync({ purchaseOrderId: po.id, trackingNumber: tracking || null, notes: receiveNotes || null, items });
      toast.success("Delivery recorded — inventory assets created");
      setReceiveOpen(false);
      setTracking(""); setReceiveNotes(""); setQuantities({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record delivery");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-muted-foreground">{po.po_number}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{po.supplier?.name ?? "Purchase order"}</h1>
            <PurchaseOrderStatusBadge status={po.status} />
          </div>
          {po.purchaseRequest && (
            <Link to={`/c/${companySlug}/${config.basePath}/requests/${po.purchaseRequest.id}`} className="mt-1 inline-block text-xs text-primary hover:underline">
              From {po.purchaseRequest.request_number}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextApproval && (
            <Can permission={config.approvePoPermission}>
              <Button variant="outline" onClick={() => setDecisionOpen({ approvalId: nextApproval.id, decision: "APPROVED" })}><CheckCircle2 className="h-3.5 w-3.5" />Approve</Button>
              <Button variant="outline" onClick={() => setDecisionOpen({ approvalId: nextApproval.id, decision: "REJECTED" })}><XCircle className="h-3.5 w-3.5" />Reject</Button>
            </Can>
          )}
          {po.status === "APPROVED" && (
            <Can permission={config.updatePermission}>
              <Button variant="outline" onClick={handleSend} disabled={updateStatus.isPending}><Send className="h-3.5 w-3.5" />Send to supplier</Button>
            </Can>
          )}
          {openItems.length > 0 && ["SENT_TO_SUPPLIER", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <Can permission={config.receivePermission}>
              <Button onClick={() => setReceiveOpen(true)}><PackageCheck className="h-3.5 w-3.5" />Receive delivery</Button>
            </Can>
          )}
          {["RECEIVED", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <Can permission={PERMISSIONS.FINANCE_AP_CREATE}>
              <Button variant="outline" onClick={() => setBillOpen(true)}><Receipt className="h-3.5 w-3.5" />Create bill from PO</Button>
            </Can>
          )}
        </div>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Order items</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Received</TableHead><TableHead>Remaining</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {po.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.description}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell><Money amount={i.unit_price} currencyId={po.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground">{i.received_quantity}</TableCell>
                        <TableCell className={i.remaining_quantity > 0 ? "font-medium text-amber-600" : "text-muted-foreground"}>{i.remaining_quantity}</TableCell>
                        <TableCell className="font-medium"><Money amount={i.line_total} currencyId={po.currency_id} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-4" />
                <div className="flex justify-end text-sm font-semibold">Total: <Money amount={po.total} currencyId={po.currency_id} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent>
                <DetailRow label="PO date" value={new Date(po.po_date).toLocaleDateString()} />
                <DetailRow label="Expected delivery" value={po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "—"} />
                <DetailRow label="Payment terms" value={po.payment_terms ?? "—"} />
                <DetailRow label="Shipping terms" value={po.shipping_terms ?? "—"} />
                {po.base_currency_total != null && (
                  <>
                    <Separator className="my-2" />
                    <DetailRow label="Exchange rate" value={po.exchange_rate ?? "—"} />
                    <DetailRow label="Base amount" value={<Money amount={po.base_currency_total} currencyId={po.base_currency_id} />} />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {po.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval required for this order.</p>
              ) : (
                <ol className="space-y-4">
                  {po.approvals.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">Level {a.sequence} — {a.required_permission}</p>
                        {a.approver && <p className="text-xs text-muted-foreground">{a.approver.first_name} {a.approver.last_name}</p>}
                        {a.decided_at && <p className="text-xs text-muted-foreground">{new Date(a.decided_at).toLocaleString()}</p>}
                      </div>
                      <ApprovalDecisionBadge decision={a.decision} />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {po.deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {po.deliveries.map((d) => (
                    <div key={d.id} className="rounded-md border border-border p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium">{d.delivery_number}</span>
                        <span className="text-xs text-muted-foreground">{new Date(d.delivery_date).toLocaleDateString()}</span>
                      </div>
                      {d.tracking_number && <p className="mt-1 text-xs text-muted-foreground">Tracking: {d.tracking_number}</p>}
                      {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!decisionOpen} onOpenChange={(o) => !o && setDecisionOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decisionOpen?.decision === "APPROVED" ? "Approve purchase order" : "Reject purchase order"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Comments</Label><Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></div>
          <DialogFooter>
            <Button onClick={handleDecision} disabled={decideApproval.isPending} variant={decisionOpen?.decision === "REJECTED" ? "destructive" : "default"}>
              {decideApproval.isPending ? "Saving…" : decisionOpen?.decision === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receive delivery</DialogTitle></DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <p className="text-xs text-muted-foreground">Receiving hardware creates one inventory asset per unit; software creates a single licensed asset.</p>
            <div className="space-y-2">
              {openItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{i.description}</p>
                    <p className="text-xs text-muted-foreground">{i.remaining_quantity} remaining of {i.quantity}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={i.remaining_quantity}
                    className="w-24"
                    value={quantities[i.id] ?? ""}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [i.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5"><Label>Tracking number</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={receiveDelivery.isPending}>{receiveDelivery.isPending ? "Saving…" : "Confirm receipt"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create bill from purchase order</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateBill} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Creates a draft bill pre-filled with whatever's been received but not already billed on this PO. Review it against the supplier's real invoice before submitting for approval.
            </p>
            <div className="space-y-1.5"><Label>Bill date</Label><Input type="date" required value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={createFromPurchaseOrder.isPending}>{createFromPurchaseOrder.isPending ? "Creating…" : "Create draft bill"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
