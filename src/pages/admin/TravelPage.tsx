import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plane } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useTravelRequests, useTravelRequestMutations } from "@/features/admin/hooks";
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
import type { TravelRequest } from "@/types/database";

const NEXT_LABEL: Record<string, string> = {
  SUBMITTED: "Manager approve", MANAGER_APPROVED: "Admin review", ADMIN_REVIEW: "Finance review", FINANCE_REVIEW: "Give final approval",
};

export default function TravelPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: requests, isLoading } = useTravelRequests(company?.id);
  const mutations = useTravelRequestMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [travelType, setTravelType] = useState("DOMESTIC");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) return;
    try {
      const req = await mutations.create.mutateAsync({
        companyId: company!.id, employeeId: myEmployee.id, purpose, destination, travelType, departureDate, returnDate,
      });
      await mutations.submit.mutateAsync(req.id);
      toast.success(`${req.request_number} submitted`);
      setOpen(false); setDestination(""); setPurpose(""); setDepartureDate(""); setReturnDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit travel request");
    }
  };

  const handleAdvance = async (r: TravelRequest) => {
    try {
      await mutations.advance.mutateAsync(r.id);
      toast.success("Travel request advanced");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Travel</h1>
          <p className="text-sm text-muted-foreground">Company travel coordination and approvals</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!myEmployee}>+ New travel request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New travel request</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5"><Label>Destination</Label><Input required value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Purpose</Label><Input required value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={travelType} onValueChange={setTravelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DOMESTIC">Domestic</SelectItem><SelectItem value="INTERNATIONAL">International</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Departure</Label><Input type="date" required value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Return</Label><Input type="date" required value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={mutations.create.isPending}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <EmptyState icon={Plane} title="No travel requests yet" description="Submit your first travel request." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Destination</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                  <TableCell className="font-medium">{r.destination}</TableCell>
                  <TableCell className="text-muted-foreground">{r.departure_date} – {r.return_date}</TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_TRAVEL_APPROVE}>
                      {NEXT_LABEL[r.status] && <Button variant="ghost" size="sm" onClick={() => handleAdvance(r)}>{NEXT_LABEL[r.status]}</Button>}
                    </Can>
                    <Can permission={PERMISSIONS.ADMIN_TRAVEL_MANAGE}>
                      {r.status === "APPROVED" && <Button variant="ghost" size="sm" onClick={() => mutations.book.mutate({ id: r.id, details: {} })}>Mark booked</Button>}
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
