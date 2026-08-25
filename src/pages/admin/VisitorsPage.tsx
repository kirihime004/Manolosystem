import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { useVisitors, useVisitorMutations } from "@/features/admin/hooks";
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

const TYPES = ["CLIENT", "VENDOR", "CANDIDATE", "PARTNER", "GUEST", "DELIVERY", "OTHER"];

export default function VisitorsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: visitors, isLoading } = useVisitors(company?.id);
  const { create, checkIn, checkOut } = useVisitorMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [visitorType, setVisitorType] = useState("GUEST");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) return;
    try {
      await create.mutateAsync({ companyId: company!.id, name, organization: organization || null, visitorType, hostEmployeeId: myEmployee.id, visitDate });
      toast.success("Visitor registered");
      setOpen(false); setName(""); setOrganization("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register visitor");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Visitors</h1>
          <p className="text-sm text-muted-foreground">Expected guests and check-in/out</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_VISITORS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={!myEmployee}>+ Register visitor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register a visitor</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Organization</Label><Input value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={visitorType} onValueChange={setVisitorType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Visit date</Label><Input type="date" required value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Register</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !visitors || visitors.length === 0 ? (
          <EmptyState icon={Users} title="No visitors yet" description="Register your first visitor." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Organization</TableHead><TableHead>Host</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {visitors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.organization ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{employeeMap.get(v.host_employee_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.visit_date}</TableCell>
                  <TableCell><AdminStatusBadge status={v.status} /></TableCell>
                  <TableCell>
                    <Can permission={[PERMISSIONS.ADMIN_VISITORS_CHECKIN, PERMISSIONS.ADMIN_VISITORS_CHECKOUT]}>
                      {v.status === "EXPECTED" && <Button variant="ghost" size="sm" onClick={() => checkIn.mutate({ id: v.id })}>Check in</Button>}
                      {v.status === "CHECKED_IN" && <Button variant="ghost" size="sm" onClick={() => checkOut.mutate({ id: v.id })}>Check out</Button>}
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
