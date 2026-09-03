import { Fragment, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { useSuppliers } from "@/features/it/inventory/hooks";
import { usePurchaseRequest, usePurchaseRequestMutations, useQuotationMutations, usePurchaseOrderMutations, useCurrencies, useBudget, useQuotationItems } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { PurchaseRequestStatusBadge, RequestPriorityBadge, ApprovalDecisionBadge, QuotationStatusBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function QuotationItemsRow({ quotationId, currencyId }: { quotationId: string; currencyId: string | null }) {
  const { data: items, isLoading } = useQuotationItems(quotationId);
  return (
    <TableRow>
      <TableCell />
      <TableCell colSpan={6} className="bg-muted/30">
        {isLoading ? (
          <p className="py-2 text-xs text-muted-foreground">Loading line items…</p>
        ) : !items || items.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No line items on record for this quotation.</p>
        ) : (
          <div className="space-y-1 py-1">
            {items.map((li) => (
              <div key={li.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{li.description} <span className="text-muted-foreground">× {li.quantity}</span></span>
                <span className="flex gap-3 text-muted-foreground">
                  <Money amount={li.unit_price} currencyId={currencyId} /> ea · <span className="font-medium text-foreground"><Money amount={li.line_total} currencyId={currencyId} /></span>
                </span>
              </div>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function PurchaseRequestDetailPage() {
  const { companySlug, requestId } = useParams<{ companySlug: string; requestId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pr, isLoading } = usePurchaseRequest(requestId);
  const { data: linkedBudget } = useBudget(pr?.budget_id ?? undefined);
  const { data: suppliers } = useSuppliers(pr?.company_id);
  const { data: currencies } = useCurrencies();
  const { submit, decideApproval } = usePurchaseRequestMutations(requestId);
  const { create: createQuotation, select: selectQuotation } = useQuotationMutations(requestId);
  const { createFromPR } = usePurchaseOrderMutations();

  const [decisionOpen, setDecisionOpen] = useState<{ approvalId: string; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [comments, setComments] = useState("");

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState("");
  const [quoteItemPrices, setQuoteItemPrices] = useState<Record<string, string>>({});
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState("");
  const [quoteWarranty, setQuoteWarranty] = useState("");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const [expandedQuotationId, setExpandedQuotationId] = useState<string | null>(null);

  const [selectReasonOpen, setSelectReasonOpen] = useState<string | null>(null);
  const [selectReason, setSelectReason] = useState("");

  const [poOpen, setPoOpen] = useState(false);
  const [poPaymentTerms, setPoPaymentTerms] = useState("");
  const [poShippingTerms, setPoShippingTerms] = useState("");
  const [poExpectedDate, setPoExpectedDate] = useState("");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!pr) return <ErrorScreen title="Request not found" description="This purchase request does not exist or you do not have access to it." />;

  const config = PROCUREMENT_MODULE_CONFIG[pr.module_key];
  const isOwner = pr.requester_id === user?.id;
  const canSubmit = isOwner && pr.status === "DRAFT";
  const nextApproval = pr.approvals.find((a) => a.decision === "PENDING" && !pr.approvals.some((o) => o.sequence < a.sequence && o.decision === "PENDING"));
  const selectedQuotation = pr.quotations.find((q) => q.status === "SELECTED");

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync(requestId!);
      toast.success("Submitted for approval");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    }
  };

  const handleDecision = async () => {
    if (!decisionOpen) return;
    try {
      await decideApproval.mutateAsync({ approvalId: decisionOpen.approvalId, decision: decisionOpen.decision, comments: comments || null });
      toast.success(decisionOpen.decision === "APPROVED" ? "Approved" : "Rejected");
      setDecisionOpen(null);
      setComments("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
    }
  };

  const handleCreateQuotation = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestId) return;
    try {
      await createQuotation.mutateAsync({
        purchaseRequestId: requestId,
        supplierId: quoteSupplierId,
        currencyId: pr.currency_id,
        items: pr.items.map((i) => ({ purchaseRequestItemId: i.id, description: i.description, quantity: i.quantity, unitPrice: Number(quoteItemPrices[i.id]) || 0 })),
        deliveryTimeDays: quoteDeliveryDays ? Number(quoteDeliveryDays) : null,
        warrantyTerms: quoteWarranty || null,
        paymentTerms: quotePaymentTerms || null,
        notes: quoteNotes || null,
      });
      toast.success("Quotation added");
      setQuoteOpen(false);
      setQuoteSupplierId(""); setQuoteItemPrices({}); setQuoteDeliveryDays(""); setQuoteWarranty(""); setQuotePaymentTerms(""); setQuoteNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add quotation");
    }
  };

  const handleSelectQuotation = async () => {
    if (!selectReasonOpen) return;
    try {
      await selectQuotation.mutateAsync({ quotationId: selectReasonOpen, reason: selectReason || null });
      toast.success("Supplier selected");
      setSelectReasonOpen(null);
      setSelectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select quotation");
    }
  };

  const handleCreatePO = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const poId = await createFromPR.mutateAsync({
        purchaseRequestId: pr.id,
        paymentTerms: poPaymentTerms || null,
        shippingTerms: poShippingTerms || null,
        expectedDeliveryDate: poExpectedDate || null,
      });
      toast.success("Purchase order created");
      navigate(`/c/${companySlug}/${config.basePath}/orders/${poId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create purchase order");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-muted-foreground">{pr.request_number}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{pr.reason || "Purchase request"}</h1>
            <PurchaseRequestStatusBadge status={pr.status} />
            <RequestPriorityBadge priority={pr.priority} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Can permission={config.submitPermission}>
              <Button onClick={handleSubmit} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit for approval"}</Button>
            </Can>
          )}
          {nextApproval && (
            <Can permission={config.approvePermission}>
              <Button variant="outline" onClick={() => setDecisionOpen({ approvalId: nextApproval.id, decision: "APPROVED" })}>
                <CheckCircle2 className="h-3.5 w-3.5" />Approve
              </Button>
              <Button variant="outline" onClick={() => setDecisionOpen({ approvalId: nextApproval.id, decision: "REJECTED" })}>
                <XCircle className="h-3.5 w-3.5" />Reject
              </Button>
            </Can>
          )}
          {pr.status === "APPROVED" && selectedQuotation && (
            <Can permission={config.createPoPermission}>
              <Button onClick={() => setPoOpen(true)}>Create purchase order</Button>
            </Can>
          )}
        </div>
      </div>

      {nextApproval && linkedBudget && !["APPROVED", "ACTIVE"].includes(linkedBudget.status) && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">Linked budget isn't approved yet</p>
          <p className="mt-1 text-muted-foreground">
            "{linkedBudget.budget_name}" is currently <span className="font-medium">{linkedBudget.status.replace(/_/g, " ")}</span> — this request cannot be fully approved until Finance approves that budget.
          </p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Items</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pr.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.description}</TableCell>
                        <TableCell className="text-muted-foreground">{i.asset_type ?? "—"}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell><Money amount={i.estimated_unit_price} currencyId={pr.currency_id} /></TableCell>
                        <TableCell className="font-medium"><Money amount={i.estimated_total} currencyId={pr.currency_id} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-4" />
                <div className="flex justify-end text-sm font-semibold">
                  Estimated total: <Money amount={pr.estimated_total} currencyId={pr.currency_id} />
                </div>
                {pr.description && <p className="mt-4 text-sm text-muted-foreground">{pr.description}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent>
                <DetailRow label="Requester" value={pr.requester ? `${pr.requester.first_name ?? ""} ${pr.requester.last_name ?? ""}`.trim() : "—"} />
                <DetailRow label="Request date" value={new Date(pr.request_date).toLocaleDateString()} />
                <DetailRow label="Required date" value={pr.required_date ? new Date(pr.required_date).toLocaleDateString() : "—"} />
                <DetailRow label="Currency" value={currencies?.find((c) => c.id === pr.currency_id)?.code ?? "—"} />
                {pr.base_currency_amount != null && (
                  <>
                    <Separator className="my-2" />
                    <DetailRow label="Exchange rate" value={pr.exchange_rate ?? "—"} />
                    <DetailRow label="Base amount" value={<Money amount={pr.base_currency_amount} currencyId={pr.base_currency_id} />} />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {pr.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval steps recorded yet — submit the request to start the approval chain.</p>
              ) : (
                <ol className="space-y-4">
                  {pr.approvals.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">Level {a.sequence} — {a.required_permission}</p>
                        {a.approver && <p className="text-xs text-muted-foreground">{a.approver.first_name} {a.approver.last_name}</p>}
                        {a.decided_at && <p className="text-xs text-muted-foreground">{new Date(a.decided_at).toLocaleString()}</p>}
                        {a.comments && <p className="mt-1 text-xs text-muted-foreground">"{a.comments}"</p>}
                      </div>
                      <ApprovalDecisionBadge decision={a.decision} />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations" className="space-y-4 pt-4">
          {(pr.status === "SUBMITTED" || pr.status === "UNDER_REVIEW" || pr.status === "APPROVED") && (
            <Can permission={config.createPermission}>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setQuoteOpen(true)}><Plus className="h-3.5 w-3.5" />Add quotation</Button>
              </div>
            </Can>
          )}
          {pr.quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotations yet.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Supplier</TableHead><TableHead>Total</TableHead><TableHead>Delivery</TableHead><TableHead>Warranty</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {pr.quotations.map((q) => (
                    <Fragment key={q.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedQuotationId(expandedQuotationId === q.id ? null : q.id)}>
                        <TableCell>{expandedQuotationId === q.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}</TableCell>
                        <TableCell className="font-medium">{q.supplier?.name ?? "—"}</TableCell>
                        <TableCell><Money amount={q.total} currencyId={q.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground">{q.delivery_time_days ? `${q.delivery_time_days} days` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{q.warranty_terms ?? "—"}</TableCell>
                        <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {pr.status === "APPROVED" && q.status !== "SELECTED" && (
                            <Can permission={config.updatePermission}>
                              <Button size="sm" variant="outline" onClick={() => setSelectReasonOpen(q.id)}>Select</Button>
                            </Can>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedQuotationId === q.id && <QuotationItemsRow quotationId={q.id} currencyId={q.currency_id} />}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approval decision dialog */}
      <Dialog open={!!decisionOpen} onOpenChange={(o) => !o && setDecisionOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decisionOpen?.decision === "APPROVED" ? "Approve request" : "Reject request"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Comments</Label><Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></div>
          <DialogFooter>
            <Button onClick={handleDecision} disabled={decideApproval.isPending} variant={decisionOpen?.decision === "REJECTED" ? "destructive" : "default"}>
              {decideApproval.isPending ? "Saving…" : decisionOpen?.decision === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add quotation dialog */}
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add supplier quotation</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateQuotation} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={quoteSupplierId} onValueChange={setQuoteSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit prices</Label>
              <div className="space-y-2 rounded-md border border-border p-3">
                {pr.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{i.description} <span className="text-xs">× {i.quantity}</span></span>
                    <Input
                      type="number" step="0.01" required className="w-28" placeholder="0.00"
                      value={quoteItemPrices[i.id] ?? ""}
                      onChange={(e) => setQuoteItemPrices((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    />
                  </div>
                ))}
                <Separator />
                <div className="flex justify-end text-sm font-semibold">
                  Total: <Money amount={pr.items.reduce((sum, i) => sum + i.quantity * (Number(quoteItemPrices[i.id]) || 0), 0)} currencyId={pr.currency_id} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Delivery time (days)</Label><Input type="number" value={quoteDeliveryDays} onChange={(e) => setQuoteDeliveryDays(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Warranty</Label><Input value={quoteWarranty} onChange={(e) => setQuoteWarranty(e.target.value)} placeholder="e.g. 1 year" /></div>
            </div>
            <div className="space-y-1.5"><Label>Payment terms</Label><Input value={quotePaymentTerms} onChange={(e) => setQuotePaymentTerms(e.target.value)} placeholder="e.g. Net 30" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={createQuotation.isPending || !quoteSupplierId}>{createQuotation.isPending ? "Saving…" : "Add quotation"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Select quotation reason dialog */}
      <Dialog open={!!selectReasonOpen} onOpenChange={(o) => !o && setSelectReasonOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select this supplier</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Reason (optional)</Label><Textarea rows={2} value={selectReason} onChange={(e) => setSelectReason(e.target.value)} placeholder="e.g. Best price and warranty" /></div>
          <DialogFooter><Button onClick={handleSelectQuotation} disabled={selectQuotation.isPending}>{selectQuotation.isPending ? "Saving…" : "Confirm selection"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PO dialog */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create purchase order</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePO} className="space-y-4">
            <p className="text-sm text-muted-foreground">This converts {pr.request_number} into a PO using the selected quotation from {selectedQuotation?.supplier?.name}.</p>
            <div className="space-y-1.5"><Label>Payment terms</Label><Input value={poPaymentTerms} onChange={(e) => setPoPaymentTerms(e.target.value)} placeholder="e.g. Net 30" /></div>
            <div className="space-y-1.5"><Label>Shipping terms</Label><Input value={poShippingTerms} onChange={(e) => setPoShippingTerms(e.target.value)} placeholder="e.g. FOB Destination" /></div>
            <div className="space-y-1.5"><Label>Expected delivery date</Label><Input type="date" value={poExpectedDate} onChange={(e) => setPoExpectedDate(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={createFromPR.isPending}>{createFromPR.isPending ? "Creating…" : "Create purchase order"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
