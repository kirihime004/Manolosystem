import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Armchair, MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useAdminAssets, useAdminAssetMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { AdminAsset } from "@/types/database";

export default function AdminAssetsPage() {
  const { company } = useCompany();
  const { data: assets, isLoading } = useAdminAssets(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, reassign, dispose } = useAdminAssetMutations(company?.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");

  const [assignTarget, setAssignTarget] = useState<AdminAsset | null>(null);
  const [employeeId, setEmployeeId] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, name, category: category || null, brand: brand || null });
      toast.success("Asset registered");
      setCreateOpen(false); setName(""); setCategory(""); setBrand("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register asset");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    try {
      await reassign.mutateAsync({ assetId: assignTarget.id, assignedTo: employeeId || null });
      toast.success(employeeId ? "Asset assigned" : "Asset unassigned");
      setAssignTarget(null); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign asset");
    }
  };

  const handleDispose = async (asset: AdminAsset) => {
    try {
      await dispose.mutateAsync({ assetId: asset.id, status: "DISPOSED" });
      toast.success("Asset disposed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispose asset");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administrative Assets</h1>
          <p className="text-sm text-muted-foreground">Furniture, appliances, and non-IT office equipment</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_ASSETS_CREATE}>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button>+ New asset</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register a new asset</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Chair" /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Furniture" /></div>
                <div className="space-y-1.5"><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Register asset</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !assets || assets.length === 0 ? (
          <EmptyState icon={Armchair} title="No assets yet" description="Register your first administrative asset." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Assigned to</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.category ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={a.status} /></TableCell>
                  <TableCell>{a.assigned_to ? employeeMap.get(a.assigned_to) ?? "—" : "—"}</TableCell>
                  <TableCell>
                    <Can permission={[PERMISSIONS.ADMIN_ASSETS_ASSIGN, PERMISSIONS.ADMIN_ASSETS_DISPOSE]}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setAssignTarget(a); setEmployeeId(a.assigned_to ?? ""); }}>Assign / Reassign</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => handleDispose(a)}>Dispose</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignTarget?.name}</DialogTitle></DialogHeader>
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
