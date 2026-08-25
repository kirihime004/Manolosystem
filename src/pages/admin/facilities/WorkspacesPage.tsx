import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Armchair } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useWorkspaces, useWorkspaceMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Workspace } from "@/types/database";

export default function WorkspacesPage() {
  const { company } = useCompany();
  const { data: workspaces, isLoading } = useWorkspaces(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, assign, release } = useWorkspaceMutations(company?.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [area, setArea] = useState("");
  const [deskNumber, setDeskNumber] = useState("");

  const [assignTarget, setAssignTarget] = useState<Workspace | null>(null);
  const [employeeId, setEmployeeId] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, area: area || null, deskNumber: deskNumber || null });
      toast.success("Workspace created");
      setCreateOpen(false); setArea(""); setDeskNumber("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !employeeId) return;
    try {
      await assign.mutateAsync({ workspaceId: assignTarget.id, employeeId });
      toast.success("Workspace assigned");
      setAssignTarget(null); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign workspace");
    }
  };

  const handleRelease = async (workspaceId: string) => {
    try {
      await release.mutateAsync({ workspaceId });
      toast.success("Workspace released");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to release workspace");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Desk allocation and workspace assignment</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_WORKSPACES_MANAGE}>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button>+ New workspace</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New workspace</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Area</Label><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Production Floor" /></div>
                <div className="space-y-1.5"><Label>Desk number</Label><Input value={deskNumber} onChange={(e) => setDeskNumber(e.target.value)} placeholder="e.g. D-205" /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create workspace</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !workspaces || workspaces.length === 0 ? (
          <EmptyState icon={Armchair} title="No workspaces yet" description="Add your first workspace." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Area</TableHead><TableHead>Desk</TableHead><TableHead>Status</TableHead><TableHead>Assigned to</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
            <TableBody>
              {workspaces.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.workspace_code}</TableCell>
                  <TableCell className="text-muted-foreground">{w.area ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{w.desk_number ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={w.status} /></TableCell>
                  <TableCell>{w.current_employee_id ? employeeMap.get(w.current_employee_id) ?? "—" : "—"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_WORKSPACES_MANAGE}>
                      {w.current_employee_id ? (
                        <Button variant="ghost" size="sm" onClick={() => handleRelease(w.id)}>Release</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setAssignTarget(w)}>Assign</Button>
                      )}
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
          <DialogHeader><DialogTitle>Assign {assignTarget?.workspace_code}</DialogTitle></DialogHeader>
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={assign.isPending || !employeeId}>Assign</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
