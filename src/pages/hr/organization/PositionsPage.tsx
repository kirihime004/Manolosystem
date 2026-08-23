import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePositions, usePositionMutations } from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Briefcase } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function PositionsPage() {
  const { company } = useCompany();
  const { data: positions, isLoading } = usePositions(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { create } = usePositionMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("");

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({ companyId: company.id, title: title.trim(), departmentId: departmentId || null, level: level ? Number(level) : null });
      toast.success("Position created");
      setOpen(false); setTitle(""); setDepartmentId(""); setLevel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create position");
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
            <DialogTrigger asChild><Button>+ New position</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New position</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Level</Label><Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
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
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Department</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{p.department_id ? (deptMap.get(p.department_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.level ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
