import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProjects, useProjectMutations } from "@/features/production/hooks";
import { useEmployees } from "@/features/hr/hooks";
import { useCustomers } from "@/features/finance/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const PROJECT_TYPES = ["FEATURE_FILM", "SERIES", "SHORT", "COMMERCIAL", "GAME_CINEMATIC", "OTHER"];

export default function ProjectsListPage() {
  const { company } = useCompany();
  const { data: projects, isLoading } = useProjects(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: customers } = useCustomers(company?.id);
  const { create } = useProjectMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("SERIES");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [directorId, setDirectorId] = useState("");
  const [producerId, setProducerId] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        companyId: company!.id, name, projectType, description: description || null,
        clientId: clientId || null, directorId: directorId || null, producerId: producerId || null,
      });
      toast.success("Project created");
      setOpen(false); setName(""); setDescription(""); setClientId(""); setDirectorId(""); setProducerId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">Shows, features, shorts, and commercials in production</p>
        </div>
        <Can permission={PERMISSIONS.PRODUCTION_PROJECTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Client (optional)</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Director</Label>
                    <Select value={directorId} onValueChange={setDirectorId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Producer</Label>
                    <Select value={producerId} onValueChange={setProducerId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !projects || projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to start building out its pipeline." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Client</TableHead><TableHead>Director</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs"><Link to={p.id} className="hover:underline">{p.project_code}</Link></TableCell>
                  <TableCell className="font-medium"><Link to={p.id} className="hover:underline">{p.name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{p.project_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{p.client_id ? customerMap.get(p.client_id) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.director_id ? employeeMap.get(p.director_id) ?? "—" : "—"}</TableCell>
                  <TableCell><ProductionStatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
