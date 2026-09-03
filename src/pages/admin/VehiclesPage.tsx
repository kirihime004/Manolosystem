import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useVehicles, useVehicleMutations } from "@/features/admin/hooks";
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
import type { Vehicle } from "@/types/database";

const VEHICLE_TYPES = ["COMPANY_CAR", "VAN", "TRUCK", "MOTORCYCLE", "PRODUCTION_TRANSPORT", "SERVICE_VEHICLE", "OTHER"];

export default function VehiclesPage() {
  const { company } = useCompany();
  const { data: vehicles, isLoading } = useVehicles(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, assign, return: returnVehicle } = useVehicleMutations(company?.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleType, setVehicleType] = useState("COMPANY_CAR");

  const [assignTarget, setAssignTarget] = useState<Vehicle | null>(null);
  const [employeeId, setEmployeeId] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, plateNumber, make: make || null, model: model || null, vehicleType });
      toast.success("Vehicle added");
      setCreateOpen(false); setPlateNumber(""); setMake(""); setModel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add vehicle");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !employeeId) return;
    try {
      await assign.mutateAsync({ vehicleId: assignTarget.id, employeeId });
      toast.success("Vehicle assigned");
      setAssignTarget(null); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign vehicle");
    }
  };

  const handleReturn = async (vehicleId: string) => {
    try {
      await returnVehicle.mutateAsync({ vehicleId });
      toast.success("Vehicle returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return vehicle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Company fleet management</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_VEHICLES_MANAGE}>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button>+ New vehicle</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a vehicle</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Plate number</Label><Input required value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Make</Label><Input value={make} onChange={(e) => setMake(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VEHICLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Add vehicle</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !vehicles || vehicles.length === 0 ? (
          <EmptyState icon={Car} title="No vehicles yet" description="Add your first company vehicle." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Plate</TableHead><TableHead>Make / Model</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Driver</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs"><Link to={v.id} className="hover:underline">{v.plate_number}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.vehicle_type.replace(/_/g, " ")}</TableCell>
                  <TableCell><AdminStatusBadge status={v.status} /></TableCell>
                  <TableCell>{v.assigned_driver ? employeeMap.get(v.assigned_driver) ?? "—" : "—"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_VEHICLES_ASSIGN}>
                      {v.assigned_driver ? (
                        <Button variant="ghost" size="sm" onClick={() => handleReturn(v.id)}>Return</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setAssignTarget(v)}>Assign</Button>
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
          <DialogHeader><DialogTitle>Assign {assignTarget?.plate_number}</DialogTitle></DialogHeader>
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Driver</Label>
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
