import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDepartments, useDepartmentMutations } from "@/features/company/settings/useDepartments";
import { useEmployees } from "@/features/hr/hooks";
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
import { Building2 } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Department } from "@/types/database";

export default function HrDepartmentsPage() {
  const { company } = useCompany();
  const { data: departments, isLoading } = useDepartments(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, update, remove } = useDepartmentMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [managerId, setManagerId] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const openCreate = () => {
    setEditing(null); setName(""); setCode(""); setManagerId(""); setParentDepartmentId(""); setStatus("ACTIVE");
    setOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept); setName(dept.name); setCode(dept.code ?? "");
    setManagerId(dept.manager_id ?? ""); setParentDepartmentId(dept.parent_department_id ?? ""); setStatus(dept.status);
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id, name: name.trim(), description: editing.description,
          code: code || null, managerId: managerId || null, parentDepartmentId: parentDepartmentId || null, status,
        });
        toast.success("Department updated");
      } else {
        await create.mutateAsync({
          name: name.trim(), description: null, code: code || null,
          managerId: managerId || null, parentDepartmentId: parentDepartmentId || null,
        });
        toast.success("Department created");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save department");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Department deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground">Organizational structure, with managers and hierarchy</p>
        </div>
        <Can permission={[PERMISSIONS.HR_DEPARTMENTS_CREATE, PERMISSIONS.ADMIN_DEPARTMENTS_MANAGE]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}>+ New department</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit department" : "New department"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Parent department</Label>
                  <Select value={parentDepartmentId} onValueChange={setParentDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="Top-level" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).filter((d) => d.id !== editing?.id).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                    <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
        ) : !departments || departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Parent</TableHead><TableHead>Manager</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.parent_department_id ? (deptMap.get(d.parent_department_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.manager_id ? (empMap.get(d.manager_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.status}</TableCell>
                  <TableCell>
                    <Can permission={[PERMISSIONS.HR_DEPARTMENTS_UPDATE, PERMISSIONS.HR_DEPARTMENTS_DELETE, PERMISSIONS.ADMIN_DEPARTMENTS_MANAGE]}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(d)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(d)}>Delete</DropdownMenuItem>
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
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Employees and positions in this department will be unassigned from it. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
