import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useSupplierDetail, useSupplierMutations } from "@/features/it/procurement/hooks";
import { getSupplierDeleteBlockers } from "@/features/it/procurement/procurementApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { PurchaseOrderStatusBadge, PurchaseRequestStatusBadge, SupplierStatusBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { companySlug, supplierId } = useParams<{ companySlug: string; supplierId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useSupplierDetail(supplierId);
  const { update, remove } = useSupplierMutations();

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBlockers, setDeleteBlockers] = useState<{ purchaseOrders: number; quotations: number; bills: number } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!data) return <ErrorScreen title="Supplier not found" description="This supplier does not exist or you do not have access to it." />;

  const { supplier, purchaseRequests, purchaseOrders, performance } = data;

  const startEdit = () => {
    setStatus(supplier.status);
    setNotes(supplier.notes ?? "");
    setEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: supplier.id, patch: { status, notes } });
      toast.success("Supplier updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update supplier");
    }
  };

  const handleDeleteClick = async () => {
    setCheckingDelete(true);
    try {
      const { quotations, bills } = await getSupplierDeleteBlockers(supplier.id);
      setDeleteBlockers({ purchaseOrders: purchaseOrders.length, quotations, bills });
      setDeleteOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to check supplier's order history"));
    } finally {
      setCheckingDelete(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await remove.mutateAsync(supplier.id);
      toast.success("Supplier deleted");
      navigate(`/c/${companySlug}/it/procurement/suppliers`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete supplier"));
    }
  };

  const canDelete = deleteBlockers ? deleteBlockers.purchaseOrders + deleteBlockers.quotations + deleteBlockers.bills === 0 : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">{supplier.contact_person ?? "No contact person on file"}</p>
        </div>
        <div className="flex items-center gap-2">
          <SupplierStatusBadge status={supplier.status} />
          <Can permission={PERMISSIONS.IT_SUPPLIERS_UPDATE}>
            <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
          </Can>
          <Can permission={[PERMISSIONS.IT_SUPPLIERS_DELETE, PERMISSIONS.ADMIN_SUPPLIERS_DELETE]}>
            <Button variant="destructive" size="sm" onClick={handleDeleteClick} disabled={checkingDelete}>
              {checkingDelete ? "Checking…" : "Delete"}
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Orders</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{performance.numberOfOrders}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Purchased</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{purchaseOrders[0] ? <Money amount={performance.totalSpending} currencyId={purchaseOrders[0].base_currency_id ?? purchaseOrders[0].currency_id} /> : "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Outstanding</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{performance.outstandingOrders}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Cancelled</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{performance.cancelledOrders}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="requests">Purchase Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          {editing ? (
            <Card className="max-w-lg">
              <CardContent className="pt-6">
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="max-w-lg">
              <CardContent className="pt-6">
                <DetailRow label="Contact person" value={supplier.contact_person ?? "—"} />
                <DetailRow label="Email" value={supplier.email ?? "—"} />
                <DetailRow label="Phone" value={supplier.phone ?? "—"} />
                <DetailRow label="Address" value={supplier.address ?? "—"} />
                <DetailRow label="Website" value={supplier.website ?? "—"} />
                <DetailRow label="Tax / business number" value={supplier.tax_number ?? "—"} />
                <DetailRow label="Payment terms" value={supplier.payment_terms ?? "—"} />
                <DetailRow label="Notes" value={supplier.notes ?? "—"} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {purchaseOrders.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No purchase orders yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>PO Number</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell><Link to={`/c/${companySlug}/it/procurement/orders/${po.id}`} className="font-mono text-xs font-medium hover:underline">{po.po_number}</Link></TableCell>
                      <TableCell><Money amount={po.total} currencyId={po.currency_id} /></TableCell>
                      <TableCell><PurchaseOrderStatusBadge status={po.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(po.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {purchaseRequests.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No linked purchase requests yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {purchaseRequests.map((pr) => (
                    <TableRow key={pr.id}>
                      <TableCell><Link to={`/c/${companySlug}/it/procurement/requests/${pr.id}`} className="font-mono text-xs font-medium hover:underline">{pr.request_number}</Link></TableCell>
                      <TableCell><PurchaseRequestStatusBadge status={pr.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(pr.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteBlockers(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canDelete ? `Delete "${supplier.name}"?` : `Can't delete "${supplier.name}"`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canDelete
                ? "This permanently deletes the supplier. This cannot be undone."
                : `This supplier has order history on record (${[
                    deleteBlockers && deleteBlockers.purchaseOrders > 0 ? `${deleteBlockers.purchaseOrders} purchase order${deleteBlockers.purchaseOrders === 1 ? "" : "s"}` : null,
                    deleteBlockers && deleteBlockers.quotations > 0 ? `${deleteBlockers.quotations} quotation${deleteBlockers.quotations === 1 ? "" : "s"}` : null,
                    deleteBlockers && deleteBlockers.bills > 0 ? `${deleteBlockers.bills} bill${deleteBlockers.bills === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(", ")}) and can't be deleted. Set its status to Inactive instead.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{canDelete ? "Cancel" : "Close"}</AlertDialogCancel>
            {canDelete && <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
