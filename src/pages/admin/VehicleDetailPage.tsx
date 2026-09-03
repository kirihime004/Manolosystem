import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useVehicle, useVehicleAssignments, useVehicleMaintenance, useVehicleMutations } from "@/features/admin/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const MAINTENANCE_TYPES = ["OIL_CHANGE", "SERVICE", "REPAIR", "TIRE_REPLACEMENT", "INSPECTION", "REGISTRATION", "INSURANCE", "OTHER"];

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { company } = useCompany();
  const { data: vehicle, isLoading } = useVehicle(vehicleId);
  const { data: assignments } = useVehicleAssignments(vehicleId);
  const { data: maintenance } = useVehicleMaintenance(vehicleId);
  const { data: employees } = useEmployees(company?.id);
  const { assign, return: returnVehicle, addMaintenance } = useVehicleMutations(company?.id, vehicleId);

  const [assignOpen, setAssignOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const [maintOpen, setMaintOpen] = useState(false);
  const [maintType, setMaintType] = useState("SERVICE");
  const [serviceDate, setServiceDate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!vehicle) return <ErrorScreen title="Vehicle not found" description="This vehicle does not exist or you do not have access." />;

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !employeeId) return;
    try {
      await assign.mutateAsync({ vehicleId, employeeId });
      toast.success("Vehicle assigned");
      setAssignOpen(false); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign vehicle");
    }
  };

  const handleReturn = async () => {
    if (!vehicleId) return;
    try {
      await returnVehicle.mutateAsync({ vehicleId });
      toast.success("Vehicle returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return vehicle");
    }
  };

  const handleAddMaintenance = async (e: FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    try {
      await addMaintenance.mutateAsync({
        vehicleId, maintenanceType: maintType, serviceDate: serviceDate || undefined,
        cost: cost ? Number(cost) : null, notes: notes || null,
      });
      toast.success("Maintenance record added");
      setMaintOpen(false); setServiceDate(""); setCost(""); setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add maintenance record");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{vehicle.plate_number}</h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.vehicle_code} · {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"} · {vehicle.vehicle_type.replace(/_/g, " ")}
          </p>
        </div>
        <AdminStatusBadge status={vehicle.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Driver</p><p className="font-medium text-foreground">{vehicle.assigned_driver ? employeeMap.get(vehicle.assigned_driver) ?? "—" : "Unassigned"}</p></div>
          <div><p className="text-xs text-muted-foreground">Registration expiry</p><p className="font-medium text-foreground">{vehicle.registration_expiry ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Insurance expiry</p><p className="font-medium text-foreground">{vehicle.insurance_expiry ?? "—"}</p></div>
        </CardContent>
      </Card>

      <Can permission={PERMISSIONS.ADMIN_VEHICLES_ASSIGN}>
        <div className="flex gap-2">
          {vehicle.assigned_driver ? (
            <Button size="sm" variant="outline" onClick={handleReturn} disabled={returnVehicle.isPending}>Return vehicle</Button>
          ) : (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button size="sm">Assign driver</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign {vehicle.plate_number}</DialogTitle></DialogHeader>
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
          )}
        </div>
      </Can>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Assignment History</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Log</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {!assignments || assignments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No assignment history yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Driver</TableHead><TableHead>Assigned</TableHead><TableHead>Returned</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{employeeMap.get(a.employee_id) ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.assigned_date}</TableCell>
                      <TableCell className="text-muted-foreground">{a.returned_date ?? "—"}</TableCell>
                      <TableCell><AdminStatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="pt-4">
          <div className="space-y-3">
            <Can permission={PERMISSIONS.ADMIN_VEHICLES_MANAGE}>
              <div className="flex justify-end">
                <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="outline">+ Add maintenance</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add maintenance record</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddMaintenance} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={maintType} onValueChange={setMaintType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MAINTENANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>Service date</Label><Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Cost</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                      <DialogFooter><Button type="submit" disabled={addMaintenance.isPending}>Add record</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </Can>
            <div className="rounded-lg border border-border bg-card">
              {!maintenance || maintenance.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No maintenance records yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Mileage</TableHead><TableHead>Cost</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {maintenance.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.maintenance_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{m.service_date}</TableCell>
                        <TableCell className="text-muted-foreground">{m.mileage ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.cost ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
