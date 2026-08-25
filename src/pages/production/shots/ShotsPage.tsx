import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Film } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProjects, useSequences, useShots, useShotMutations } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge, ProductionRiskBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function ShotsPage() {
  const { company } = useCompany();
  const { data: projects } = useProjects(company?.id);
  const [projectId, setProjectId] = useState<string>("");
  const activeProjectId = projectId || projects?.[0]?.id;

  const { data: sequences } = useSequences(activeProjectId);
  const [sequenceId, setSequenceId] = useState<string>("");
  const { data: shots, isLoading } = useShots(activeProjectId, sequenceId || undefined);
  const { create } = useShotMutations(activeProjectId);

  const [open, setOpen] = useState(false);
  const [shotNumber, setShotNumber] = useState("10");
  const [createSequenceId, setCreateSequenceId] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createSequenceId || !activeProjectId) return;
    try {
      await create.mutateAsync({ companyId: company!.id, projectId: activeProjectId, sequenceId: createSequenceId, shotNumber: Number(shotNumber) });
      toast.success("Shot created");
      setOpen(false); setShotNumber("10");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create shot"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shots</h1>
          <p className="text-sm text-muted-foreground">The shot grid</p>
        </div>
        <Can permission={PERMISSIONS.PRODUCTION_SHOTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={!activeProjectId}>+ New shot</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New shot</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Sequence</Label>
                  <Select value={createSequenceId} onValueChange={setCreateSequenceId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{(sequences ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.sequence_code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Shot number</Label><Input type="number" min={1} required value={shotNumber} onChange={(e) => setShotNumber(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending || !createSequenceId}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={activeProjectId ?? ""} onValueChange={(v) => { setProjectId(v); setSequenceId(""); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select a project…" /></SelectTrigger>
          <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sequenceId || "__all__"} onValueChange={(v) => setSequenceId(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All sequences" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All sequences</SelectItem>
            {(sequences ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.sequence_code}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {!activeProjectId ? (
          <EmptyState icon={Film} title="No projects yet" description="Create a project first." />
        ) : isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !shots || shots.length === 0 ? (
          <EmptyState icon={Film} title="No shots yet" description="Add a shot to start tracking its tasks and versions." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Shot</TableHead><TableHead>Description</TableHead><TableHead>Frames</TableHead><TableHead>Status</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader>
            <TableBody>
              {shots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs"><Link to={s.id} className="hover:underline">{s.shot_code}</Link></TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{s.description ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.frame_start}{s.frame_end ? `–${s.frame_end}` : ""}</TableCell>
                  <TableCell><ProductionStatusBadge status={s.status} /></TableCell>
                  <TableCell><ProductionRiskBadge risk={s.risk_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
