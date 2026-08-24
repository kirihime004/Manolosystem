import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePositions, usePositionMutations } from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Briefcase } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Position } from "@/types/database";

export default function PositionsPage() {
  const { company } = useCompany();
  const { data: positions, isLoading } = usePositions(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { create, update, remove } = usePositionMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const openCreate = () => {
    setEditing(null); setTitle(""); setDepartmentId(""); setLevel(""); setStatus("ACTIVE");
    setOpen(true);
  };

  const openEdit = (p: Position) => {
    setEditing(p); setTitle(p.title); setDepartmentId(p.department_id ?? "");
    setLevel(p.level != null ? String(p.level) : ""); setStatus(p.status);
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { title: title.trim(), department_id: departmentId || null, level: level ? Number(level) : null, status },
        });
        toast.success("Position updated");
      } else {
        await create.mutateAsync({ companyId: company.id, title: title.trim(), departmentId: departmentId || null, level: level ? Number(level) : null });
        toast.success("Position created");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save position");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Position deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete position");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Positions</h1>
          <p className="text-sm text-muted-foreground">Job titles employees can be assigned to</p>
        </div>
        <Can permission={PERMISSIONS.HR_POSITIONS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}>+ New position</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit position" : "New position"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Level</Label><Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} /></div>
                {editing && (
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "INACTIVE")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
                <DialogFooter><Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Create"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !positions || positions.length === 0 ? (
          <EmptyState icon={Briefcase} title="No positions yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Department</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{p.department_id ? (deptMap.get(p.department_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.level ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.status}</TableCell>
                  <TableCell>
                    <Can permission={[PERMISSIONS.HR_POSITIONS_UPDATE, PERMISSIONS.HR_POSITIONS_DELETE]}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>Delete</DropdownMenuItem>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>Employees in this position will be unassigned from it. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
