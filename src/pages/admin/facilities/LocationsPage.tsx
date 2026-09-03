import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useLocations, useLocationMutations } from "@/features/admin/hooks";
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
import type { AdminLocation } from "@/types/database";

const TYPES = ["HEAD_OFFICE", "BRANCH", "STUDIO", "WAREHOUSE", "REMOTE_OFFICE", "OTHER"];

export default function LocationsPage() {
  const { company } = useCompany();
  const { data: locations, isLoading } = useLocations(company?.id);
  const { create, update } = useLocationMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLocation | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("OTHER");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const openCreate = () => { setEditing(null); setName(""); setType("OTHER"); setAddress(""); setCity(""); setOpen(true); };
  const openEdit = (loc: AdminLocation) => { setEditing(loc); setName(loc.name); setType(loc.type); setAddress(loc.address ?? ""); setCity(loc.city ?? ""); setOpen(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { name, type, address, city } });
        toast.success("Location updated");
      } else {
        await create.mutateAsync({ companyId: company!.id, name, type, address, city });
        toast.success("Location created");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground">Company sites, branches, and studios</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_FACILITIES_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}>+ New location</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit location" : "New location"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Create location"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !locations || locations.length === 0 ? (
          <EmptyState icon={MapPin} title="No locations yet" description="Add your first company location." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>City</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium"><Link to={loc.id} className="hover:underline">{loc.name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{loc.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.city ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={loc.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_FACILITIES_UPDATE}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>Edit</Button>
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
