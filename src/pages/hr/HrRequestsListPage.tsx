import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useHrRequests, useHrRequestMutations, useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { HrRequestStatusBadge } from "@/components/shared/HrBadges";

const REQUEST_TYPES = [
  "EMPLOYMENT_CERTIFICATE", "SALARY_CERTIFICATE", "LEAVE_REQUEST", "ATTENDANCE_CORRECTION",
  "DOCUMENT_REQUEST", "INFORMATION_UPDATE", "EMPLOYMENT_VERIFICATION", "OTHER",
];

export default function HrRequestsListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: requests, isLoading } = useHrRequests(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, transition } = useHrRequestMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("OTHER");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record is linked to your account"); return; }
    try {
      const req = await create.mutateAsync({ employeeId: myEmployee.id, requestType: requestType as never, subject, description: description || null });
      await transition.mutateAsync({ id: req.id, newStatus: "SUBMITTED" });
      toast.success(`${req.request_number} submitted`);
      setOpen(false); setSubject(""); setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employee Requests</h1>
          <p className="text-sm text-muted-foreground">Certificates, verification letters, and other HR requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New HR request</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Subject</Label><Input required value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending || !myEmployee}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Employee</TableHead><TableHead>Subject</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/hr/requests/${r.id}`)}>
                  <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                  <TableCell>{empMap.get(r.employee_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{r.request_type.replace(/_/g, " ")}</TableCell>
                  <TableCell><HrRequestStatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
