import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDepartments, useDepartmentMutations } from "@/features/company/settings/useDepartments";
import { useEmployees } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2 } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function HrDepartmentsPage() {
  const { company } = useCompany();
  const { data: departments, isLoading } = useDepartments(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create } = useDepartmentMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [managerId, setManagerId] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        name: name.trim(), description: null, code: code || null,
        managerId: managerId || null, parentDepartmentId: parentDepartmentId || null,
      });
      toast.success("Department created");
      setOpen(false); setName(""); setCode(""); setManagerId(""); setParentDepartmentId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create department");
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
            <DialogTrigger asChild><Button>+ New department</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Parent department</Label>
                  <Select value={parentDepartmentId} onValueChange={setParentDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="Top-level" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                    <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
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
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Parent</TableHead><TableHead>Manager</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.parent_department_id ? (deptMap.get(d.parent_department_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.manager_id ? (empMap.get(d.manager_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
