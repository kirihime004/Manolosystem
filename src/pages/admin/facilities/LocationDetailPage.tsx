import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { useLocation, useBuildings, useBuildingMutations, useFloors, useFloorMutations } from "@/features/admin/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Building } from "@/types/database";

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const { data: location, isLoading } = useLocation(locationId);
  const { data: buildings } = useBuildings(locationId);
  const { create: createBuilding } = useBuildingMutations(locationId);

  const [buildingOpen, setBuildingOpen] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!location) return <ErrorScreen title="Location not found" description="This location does not exist or you do not have access." />;

  const handleCreateBuilding = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return;
    try {
      await createBuilding.mutateAsync({ locationId, name: buildingName });
      toast.success("Building added");
      setBuildingOpen(false); setBuildingName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add building");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{location.name}</h1>
          <p className="text-sm text-muted-foreground">
            {location.type.replace(/_/g, " ")}{location.city ? ` · ${location.city}` : ""}
          </p>
        </div>
        <AdminStatusBadge status={location.status} />
      </div>

      {location.address && <p className="text-sm text-muted-foreground">{location.address}</p>}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Buildings</h3>
          <Can permission={PERMISSIONS.ADMIN_FACILITIES_MANAGE}>
            <Dialog open={buildingOpen} onOpenChange={setBuildingOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">+ Building</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add building</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateBuilding} className="space-y-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={buildingName} onChange={(e) => setBuildingName(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={createBuilding.isPending}>Add building</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>

        {!buildings || buildings.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icon={Building2} title="No buildings yet" description="Add a building to start tracking floors." />
          </div>
        ) : (
          <div className="space-y-2">
            {buildings.map((b) => (
              <BuildingRow
                key={b.id}
                building={b}
                expanded={expandedBuildingId === b.id}
                onToggle={() => setExpandedBuildingId(expandedBuildingId === b.id ? null : b.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingRow({ building, expanded, onToggle }: { building: Building; expanded: boolean; onToggle: () => void }) {
  const { data: floors } = useFloors(expanded ? building.id : undefined);
  const { create: createFloor } = useFloorMutations(building.id);

  const [floorOpen, setFloorOpen] = useState(false);
  const [floorNumber, setFloorNumber] = useState("");
  const [floorName, setFloorName] = useState("");

  const handleCreateFloor = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createFloor.mutateAsync({ buildingId: building.id, floorNumber, floorName: floorName || null });
      toast.success("Floor added");
      setFloorOpen(false); setFloorNumber(""); setFloorName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add floor");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" className="flex w-full items-center justify-between p-3 text-left text-sm" onClick={onToggle}>
        <span className="flex items-center gap-2 font-medium text-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {building.name}
        </span>
        <span className="flex items-center gap-2">
          {building.floors && <span className="text-xs text-muted-foreground">{building.floors} floors planned</span>}
          <AdminStatusBadge status={building.status} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-3 pl-9">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Floors</p>
            <Can permission={PERMISSIONS.ADMIN_FACILITIES_MANAGE}>
              <Dialog open={floorOpen} onOpenChange={setFloorOpen}>
                <DialogTrigger asChild><Button size="sm" variant="ghost">+ Floor</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add floor to {building.name}</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateFloor} className="space-y-3">
                    <div className="space-y-1.5"><Label>Floor number</Label><Input required value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} placeholder="e.g. 3 or G" /></div>
                    <div className="space-y-1.5"><Label>Floor name (optional)</Label><Input value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="e.g. Animation Floor" /></div>
                    <DialogFooter><Button type="submit" disabled={createFloor.isPending}>Add floor</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          {!floors || floors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No floors added yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {floors.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">{f.floor_number}{f.floor_name ? ` — ${f.floor_name}` : ""}</span>
                  <AdminStatusBadge status={f.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
