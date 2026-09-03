import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Upload, FileText, AlertTriangle, Wrench, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyMembers } from "@/features/it/tickets/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useAsset, useAssetMutations, useRepairMutations, useDisposalMutations } from "@/features/it/inventory/hooks";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AssetStatusBadge, AssetConditionBadge, LifecycleStageBadge, RepairStatusBadge } from "@/components/shared/AssetBadges";
import { TicketStatusBadge } from "@/components/shared/TicketBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function fullName(p?: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return null;
  const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return n || null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function AssetDetailPage() {
  const { companySlug, assetCode } = useParams<{ companySlug: string; assetCode: string }>();
  const { company } = useCompany();
  const { data: asset, isLoading } = useAsset(company?.id, assetCode);
  const { data: members } = useCompanyMembers(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { update, reassign, markDefective } = useAssetMutations(assetCode);
  const { create: createRepair, update: updateRepair } = useRepairMutations();
  const { create: createDisposal } = useDisposalMutations();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");

  const [reassignOpen, setReassignOpen] = useState(false);
  const [defectiveOpen, setDefectiveOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<{ name: string; path: string }[]>([]);

  const [assignTo, setAssignTo] = useState("none");
  const [assignDept, setAssignDept] = useState("none");
  const [assignLocation, setAssignLocation] = useState("");
  const [assignReason, setAssignReason] = useState("");

  const [defReason, setDefReason] = useState("");
  const [defDescription, setDefDescription] = useState("");
  const [defAction, setDefAction] = useState("ASSESS");

  const [repairProblem, setRepairProblem] = useState("");
  const [repairVendor, setRepairVendor] = useState("");
  const [repairExpected, setRepairExpected] = useState("");

  const [disposalReason, setDisposalReason] = useState("BEYOND_USEFUL_LIFE");
  const [disposalMethod, setDisposalMethod] = useState("RECYCLED");
  const [disposalNotes, setDisposalNotes] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!asset) {
    return <ErrorScreen title="Asset not found" description="This asset does not exist or you do not have access to it." />;
  }

  const openEdit = () => {
    setEditName(asset.name);
    setEditCategory(asset.category ?? "");
    setEditSerialNumber(asset.serial_number ?? "");
    setEditCondition(asset.condition ?? "");
    setEditNotes(asset.notes ?? "");
    setEditBrand(asset.hardware?.brand ?? "");
    setEditModel(asset.hardware?.model ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await update.mutateAsync({
        assetId: asset.id,
        patch: {
          name: editName, category: editCategory || null, serialNumber: editSerialNumber || null,
          condition: editCondition || null, notes: editNotes || null,
          ...(asset.hardware ? { brand: editBrand || null, model: editModel || null } : {}),
        },
      });
      toast.success("Asset updated");
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset");
    }
  };

  const openReassign = () => {
    setAssignTo(asset.assigned_to ?? "none");
    setAssignDept(asset.department_id ?? "none");
    setAssignLocation(asset.location ?? "");
    setAssignReason("");
    setReassignOpen(true);
  };

  const handleReassign = async () => {
    try {
      await reassign.mutateAsync({
        assetId: asset.id,
        assignedTo: assignTo === "none" ? null : assignTo,
        departmentId: assignDept === "none" ? null : assignDept,
        location: assignLocation || null,
        reason: assignReason || null,
      });
      toast.success("Assignment updated");
      setReassignOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update assignment");
    }
  };

  const handleMarkDefective = async () => {
    try {
      await markDefective.mutateAsync({ assetId: asset.id, reason: defReason, description: defDescription, recommendedAction: defAction });
      toast.success("Asset marked defective");
      setDefectiveOpen(false);
      setDefReason("");
      setDefDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update asset");
    }
  };

  const handleCreateRepair = async () => {
    try {
      await createRepair.mutateAsync({
        companyId: company!.id,
        assetId: asset.id,
        problemDescription: repairProblem,
        repairVendor: repairVendor || null,
        expectedCompletionDate: repairExpected || null,
      });
      toast.success("Repair record created — asset moved to Repair");
      setRepairOpen(false);
      setRepairProblem("");
      setRepairVendor("");
      setRepairExpected("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create repair record");
    }
  };

  const handleCompleteRepair = async (repairId: string) => {
    try {
      await updateRepair.mutateAsync({ repairId, patch: { repairStatus: "COMPLETED" } });
      toast.success("Repair marked completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update repair");
    }
  };

  const handleDispose = async () => {
    try {
      await createDisposal.mutateAsync({
        assetId: asset.id,
        disposalReason,
        disposalMethod,
        notes: disposalNotes || null,
      });
      toast.success("Asset disposed");
      setDisposeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispose asset");
    }
  };

  const handleUpload = async (file: File) => {
    if (!company) return;
    setUploading(true);
    const path = `${company.id}/${asset.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("asset-attachments").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDocuments((prev) => [...prev, { name: file.name, path }]);
    toast.success("Document uploaded");
  };

  const activeRepair = asset.repairs.find((r) => r.repair_status !== "COMPLETED" && r.repair_status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">{asset.asset_code}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{asset.name}</h1>
            <AssetStatusBadge status={asset.status} />
            {asset.condition && <AssetConditionBadge condition={asset.condition} />}
            {asset.hardware && <LifecycleStageBadge stage={asset.hardware.lifecycle_stage} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission={PERMISSIONS.IT_INVENTORY_UPDATE}>
            <Button variant="outline" size="sm" onClick={openEdit}>Edit</Button>
          </Can>
          <Can permission={PERMISSIONS.IT_INVENTORY_ASSIGN}>
            <Button variant="outline" size="sm" onClick={openReassign}>Reassign</Button>
          </Can>
          <Can permission={PERMISSIONS.IT_INVENTORY_UPDATE}>
            {asset.status !== "DEFECTIVE" && asset.status !== "DISPOSED" && (
              <Button variant="outline" size="sm" onClick={() => setDefectiveOpen(true)}>
                <AlertTriangle className="h-3.5 w-3.5" />Mark defective
              </Button>
            )}
          </Can>
          <Can permission={PERMISSIONS.IT_INVENTORY_REPAIR}>
            {!activeRepair && asset.status !== "DISPOSED" && (
              <Button variant="outline" size="sm" onClick={() => setRepairOpen(true)}>
                <Wrench className="h-3.5 w-3.5" />Send for repair
              </Button>
            )}
          </Can>
          <Can permission={PERMISSIONS.IT_INVENTORY_DISPOSE}>
            {asset.status !== "DISPOSED" && (
              <Button variant="outline" size="sm" onClick={() => setDisposeOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />Dispose
              </Button>
            )}
          </Can>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="repair">Repair</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Asset details</CardTitle></CardHeader>
              <CardContent>
                <DetailRow label="Asset type" value={asset.asset_type} />
                <DetailRow label="Category" value={asset.category ?? "—"} />
                <DetailRow label="Serial number" value={asset.serial_number ?? "—"} />
                <DetailRow label="Asset tag" value={asset.asset_tag ?? "—"} />
                {asset.hardware && (
                  <>
                    <Separator className="my-2" />
                    <DetailRow label="Brand" value={asset.hardware.brand ?? "—"} />
                    <DetailRow label="Model" value={asset.hardware.model ?? "—"} />
                    <DetailRow label="Hostname" value={asset.hardware.hostname ?? "—"} />
                    <DetailRow label="IP address" value={asset.hardware.ip_address ?? "—"} />
                    <DetailRow label="MAC address" value={asset.hardware.mac_address ?? "—"} />
                  </>
                )}
                {asset.software && (
                  <>
                    <Separator className="my-2" />
                    <DetailRow label="Vendor" value={asset.software.vendor ?? "—"} />
                    <DetailRow label="Version" value={asset.software.version ?? "—"} />
                    <DetailRow label="Licenses" value={asset.software.number_of_licenses != null ? String(asset.software.number_of_licenses) : "—"} />
                    {asset.software.software_type === "SUBSCRIPTION" && (
                      <>
                        <DetailRow label="Renewal date" value={asset.software.renewal_date ? new Date(asset.software.renewal_date).toLocaleDateString() : "—"} />
                        <DetailRow label="Billing cycle" value={asset.software.billing_cycle ?? "—"} />
                        <DetailRow label="Seats" value={asset.software.seats_total != null ? `${asset.software.seats_used ?? 0} / ${asset.software.seats_total} used` : "—"} />
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Purchase &amp; warranty</CardTitle></CardHeader>
              <CardContent>
                <DetailRow label="Purchase date" value={asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "—"} />
                <DetailRow label="Purchase price" value={asset.purchase_price != null ? `${asset.currency} ${asset.purchase_price.toLocaleString()}` : "—"} />
                <DetailRow label="Supplier" value={asset.supplierName ?? "—"} />
                <DetailRow label="Invoice number" value={asset.invoice_number ?? "—"} />
                {asset.hardware && (
                  <>
                    <Separator className="my-2" />
                    <DetailRow label="Warranty end" value={asset.hardware.warranty_end ? new Date(asset.hardware.warranty_end).toLocaleDateString() : "—"} />
                    <DetailRow label="Lifecycle" value={`${asset.hardware.lifecycle_years} years`} />
                    <DetailRow label="End of life" value={asset.hardware.end_of_life_date ? new Date(asset.hardware.end_of_life_date).toLocaleDateString() : "—"} />
                  </>
                )}
                <Separator className="my-2" />
                <DetailRow label="Notes" value={asset.notes ?? "—"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignment" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-sm">Current assignment</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Assigned to" value={fullName(asset.assignee) ?? "Unassigned"} />
              <DetailRow label="Department" value={asset.departmentName ?? "—"} />
              <DetailRow label="Location" value={asset.location ?? "—"} />
              <Can permission={PERMISSIONS.IT_INVENTORY_ASSIGN}>
                <Button className="mt-4" size="sm" onClick={openReassign}>Change assignment</Button>
              </Can>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {asset.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <ol className="space-y-4">
                  {asset.history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium text-foreground">{h.event_type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                        {h.reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {h.reason}</p>}
                        {h.notes && <p className="mt-0.5 text-xs text-muted-foreground">{h.notes}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repair" className="pt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              {asset.repairs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No repair records.</p>
              ) : (
                asset.repairs.map((r) => (
                  <div key={r.id} className="rounded-md border border-border p-3.5">
                    <div className="flex items-center justify-between">
                      <RepairStatusBadge status={r.repair_status} />
                      <span className="text-xs text-muted-foreground">{new Date(r.reported_date).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{r.problem_description}</p>
                    {r.repair_vendor && <p className="mt-1 text-xs text-muted-foreground">Vendor: {r.repair_vendor}</p>}
                    {r.expected_completion_date && <p className="text-xs text-muted-foreground">Expected: {new Date(r.expected_completion_date).toLocaleDateString()}</p>}
                    {r.actual_completion_date && <p className="text-xs text-muted-foreground">Completed: {new Date(r.actual_completion_date).toLocaleDateString()}</p>}
                    <Can permission={PERMISSIONS.IT_INVENTORY_REPAIR}>
                      {r.repair_status !== "COMPLETED" && r.repair_status !== "CANCELLED" && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => handleCompleteRepair(r.id)}>Mark completed</Button>
                      )}
                    </Can>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded this session.</p>
              ) : (
                documents.map((d) => (
                  <div key={d.path} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {d.name}
                  </div>
                ))
              )}
              <Can permission={PERMISSIONS.IT_INVENTORY_UPDATE}>
                <div>
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />{uploading ? "Uploading…" : "Upload document"}
                  </Button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </div>
              </Can>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {asset.relatedTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets reference this asset.</p>
              ) : (
                <div className="space-y-2">
                  {asset.relatedTickets.map((t) => (
                    <Link key={t.id} to={`/c/${companySlug}/it/tickets/${t.id}`} className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent">
                      <div>
                        <p className="font-medium text-foreground">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">{t.ticket_number}</p>
                      </div>
                      <TicketStatusBadge status={t.status as never} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label><Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Serial number</Label><Input value={editSerialNumber} onChange={(e) => setEditSerialNumber(e.target.value)} /></div>
            </div>
            {asset.hardware && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Brand</Label><Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Model</Label><Input value={editModel} onChange={(e) => setEditModel(e.target.value)} /></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={editCondition} onValueChange={setEditCondition}>
                <SelectTrigger><SelectValue placeholder="Unset" /></SelectTrigger>
                <SelectContent>
                  {["NEW", "GOOD", "FAIR", "POOR", "DEFECTIVE", "NON_FUNCTIONAL"].map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={update.isPending || !editName.trim()}>{update.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={assignDept} onValueChange={setAssignDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={assignLocation} onChange={(e) => setAssignLocation(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Reason (optional)</Label><Textarea rows={2} value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="e.g. Employee transfer" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleReassign} disabled={reassign.isPending}>{reassign.isPending ? "Saving…" : "Save assignment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark defective dialog */}
      <Dialog open={defectiveOpen} onOpenChange={setDefectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark asset defective</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Reason</Label><Input required value={defReason} onChange={(e) => setDefReason(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={defDescription} onChange={(e) => setDefDescription(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Recommended action</Label>
              <Select value={defAction} onValueChange={setDefAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REPAIR">Repair</SelectItem>
                  <SelectItem value="REPLACE">Replace</SelectItem>
                  <SelectItem value="DISPOSE">Dispose</SelectItem>
                  <SelectItem value="ASSESS">Assess</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleMarkDefective} disabled={markDefective.isPending || !defReason}>
              {markDefective.isPending ? "Saving…" : "Mark defective"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair dialog */}
      <Dialog open={repairOpen} onOpenChange={setRepairOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send for repair</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Problem description</Label><Textarea required rows={3} value={repairProblem} onChange={(e) => setRepairProblem(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Repair vendor</Label><Input value={repairVendor} onChange={(e) => setRepairVendor(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Expected completion date</Label><Input type="date" value={repairExpected} onChange={(e) => setRepairExpected(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateRepair} disabled={createRepair.isPending || !repairProblem}>
              {createRepair.isPending ? "Saving…" : "Create repair record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose dialog */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispose asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This marks {asset.asset_code} as disposed. It stays in the system permanently with its full history.</p>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={disposalReason} onValueChange={setDisposalReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEYOND_USEFUL_LIFE">Beyond useful life</SelectItem>
                  <SelectItem value="DEFECTIVE">Defective</SelectItem>
                  <SelectItem value="NON_REPAIRABLE">Non-repairable</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="OBSOLETE">Obsolete</SelectItem>
                  <SelectItem value="UPGRADE">Upgrade</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECYCLED">Recycled</SelectItem>
                  <SelectItem value="DESTROYED">Destroyed</SelectItem>
                  <SelectItem value="RETURNED_TO_VENDOR">Returned to vendor</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                  <SelectItem value="DONATED">Donated</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={disposalNotes} onChange={(e) => setDisposalNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDispose} disabled={createDisposal.isPending}>
              {createDisposal.isPending ? "Disposing…" : "Confirm disposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
