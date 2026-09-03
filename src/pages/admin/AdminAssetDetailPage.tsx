import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import {
  useAdminAsset, useAdminAssetMutations, useMaintenanceRecordsByAsset,
  useAdminDocuments, useAdminDocumentMutations,
} from "@/features/admin/hooks";
import { getAdminDocumentUrl } from "@/features/admin/adminDocumentsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DEFECTIVE", "NON_FUNCTIONAL"];

export default function AdminAssetDetailPage() {
  const { companySlug, assetId } = useParams<{ companySlug: string; assetId: string }>();
  const { company } = useCompany();
  const { data: asset, isLoading } = useAdminAsset(assetId);
  const { data: employees } = useEmployees(company?.id);
  const { data: maintenance } = useMaintenanceRecordsByAsset(assetId);
  const { data: documents } = useAdminDocuments(company?.id, "ADMIN_ASSET", assetId);
  const { update, reassign, dispose } = useAdminAssetMutations(company?.id, assetId);
  const { upload, remove } = useAdminDocumentMutations(company?.id, "ADMIN_ASSET", assetId);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!asset) return <ErrorScreen title="Asset not found" description="This asset does not exist or you do not have access." />;

  const openEdit = () => {
    setEditName(asset.name);
    setEditCategory(asset.category ?? "");
    setEditBrand(asset.brand ?? "");
    setEditModel(asset.model ?? "");
    setEditSerial(asset.serial_number ?? "");
    setEditCondition(asset.condition ?? "");
    setEditNotes(asset.notes ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await update.mutateAsync({
        id: asset.id,
        patch: { name: editName, category: editCategory || undefined, brand: editBrand || undefined, model: editModel || undefined, serialNumber: editSerial || undefined, condition: editCondition || undefined, notes: editNotes || undefined },
      });
      toast.success("Asset updated");
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await reassign.mutateAsync({ assetId: asset.id, assignedTo: employeeId || null });
      toast.success(employeeId ? "Asset assigned" : "Asset unassigned");
      setAssignOpen(false); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign asset");
    }
  };

  const handleDispose = async () => {
    try {
      await dispose.mutateAsync({ assetId: asset.id, status: "DISPOSED" });
      toast.success("Asset disposed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispose asset");
    }
  };

  const handleUploadDoc = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !docFile || !docTitle.trim() || !assetId) return;
    try {
      await upload.mutateAsync({ companyId: company.id, resourceType: "ADMIN_ASSET", resourceId: assetId, documentType: "OTHER", title: docTitle, file: docFile });
      toast.success("Document uploaded");
      setDocOpen(false); setDocTitle(""); setDocFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    }
  };

  const handleOpenDoc = async (storagePath: string) => {
    try {
      const url = await getAdminDocumentUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  const handleDeleteDoc = async (id: string, storagePath: string) => {
    try {
      await remove.mutateAsync({ id, storagePath });
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const disposed = ["DISPOSED", "RETIRED", "LOST", "DAMAGED"].includes(asset.status);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.asset_code}{asset.category ? ` · ${asset.category}` : ""}</p>
        </div>
        <AdminStatusBadge status={asset.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Brand</p><p className="font-medium text-foreground">{asset.brand ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Model</p><p className="font-medium text-foreground">{asset.model ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Serial number</p><p className="font-medium text-foreground">{asset.serial_number ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Condition</p><p className="font-medium text-foreground">{asset.condition?.replace(/_/g, " ") ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Purchase date</p><p className="font-medium text-foreground">{asset.purchase_date ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Purchase price</p><p className="font-medium text-foreground">{asset.purchase_price ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Warranty</p><p className="font-medium text-foreground">{asset.warranty_start && asset.warranty_end ? `${asset.warranty_start} – ${asset.warranty_end}` : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Assigned to</p><p className="font-medium text-foreground">{asset.assigned_to ? employeeMap.get(asset.assigned_to) ?? "—" : "Unassigned"}</p></div>
          {asset.purchase_order_id && (
            <div>
              <p className="text-xs text-muted-foreground">Purchase order</p>
              <Link to={`/c/${companySlug}/it/procurement/orders/${asset.purchase_order_id}`} className="font-medium text-primary hover:underline">View order</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Can permission={PERMISSIONS.ADMIN_ASSETS_UPDATE}>
          <Button size="sm" variant="outline" onClick={openEdit}>Edit</Button>
        </Can>
        <Can permission={PERMISSIONS.ADMIN_ASSETS_ASSIGN}>
          <Button size="sm" variant="outline" onClick={() => { setEmployeeId(asset.assigned_to ?? ""); setAssignOpen(true); }}>
            {asset.assigned_to ? "Reassign" : "Assign"}
          </Button>
        </Can>
        <Can permission={PERMISSIONS.ADMIN_ASSETS_DISPOSE}>
          {!disposed && <Button size="sm" variant="outline" onClick={handleDispose} disabled={dispose.isPending}>Dispose</Button>}
        </Can>
      </div>

      <Tabs defaultValue="maintenance">
        <TabsList>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {!maintenance || maintenance.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No maintenance records for this asset yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Issue</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {maintenance.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.maintenance_number}</TableCell>
                      <TableCell className="max-w-xs truncate">{m.issue}</TableCell>
                      <TableCell><AdminPriorityBadge priority={m.priority} /></TableCell>
                      <TableCell><AdminStatusBadge status={m.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-3 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.ADMIN_DOCUMENTS_UPLOAD}>
              <Dialog open={docOpen} onOpenChange={setDocOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">+ Upload document</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
                  <form onSubmit={handleUploadDoc} className="space-y-3">
                    <div className="space-y-1.5"><Label>Title</Label><Input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>File</Label><Input type="file" required onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></div>
                    <DialogFooter><Button type="submit" disabled={upload.isPending || !docFile || !docTitle.trim()}>{upload.isPending ? "Uploading…" : "Upload"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            {!documents || documents.length === 0 ? (
              <EmptyState icon={FileText} title="No documents yet" />
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.document_type.replace(/_/g, " ")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDoc(d.storage_path)}>Open</Button>
                      <Can permission={PERMISSIONS.ADMIN_DOCUMENTS_DELETE}>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(d.id, d.storage_path)}>Delete</Button>
                      </Can>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label><Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Serial number</Label><Input value={editSerial} onChange={(e) => setEditSerial(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Brand</Label><Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Model</Label><Input value={editModel} onChange={(e) => setEditModel(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={editCondition} onValueChange={setEditCondition}>
                <SelectTrigger><SelectValue placeholder="Unset" /></SelectTrigger>
                <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleEdit} disabled={update.isPending || !editName.trim()}>{update.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {asset.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={reassign.isPending}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
