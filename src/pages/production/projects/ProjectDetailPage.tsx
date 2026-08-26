import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useProject, useProjectMutations, useShows, useEpisodes, useSequences, useHierarchyMutations,
  useProjectMembers, useProjectMemberMutations, useMilestones, useMilestoneMutations,
  useDeliverables, useDeliverableMutations, useProductionBudgetSummary,
} from "@/features/production/hooks";
import { useEmployees } from "@/features/hr/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionEpisode, ProductionMilestone, ProductionDeliverable, ProductionSequence, ProductionShow } from "@/types/database";

const EPISODE_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "ON_HOLD"];
const SEQUENCE_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"];

// Delete on shows/episodes/sequences/milestones is gated by
// PRODUCTION.PROJECTS.MANAGE at the database level (RLS), which is a
// distinct, usually-higher-tier permission from each entity's own
// *_UPDATE permission that gates Edit -- so the two need independent
// permission checks here, not one shared wrapper, or a role with update
// but not project-manage would see a Delete option that silently fails
// under RLS when clicked.
function RowActions({ canEdit, canDelete, onEdit, onDelete }: { canEdit: boolean; canDelete: boolean; onEdit?: () => void; onDelete: () => void }) {
  if (!canEdit && !canDelete) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
        {canDelete && <DropdownMenuItem variant="destructive" onClick={onDelete}>Delete</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { company, hasPermission } = useCompany();
  const { data: project, isLoading } = useProject(projectId);
  const { update, remove: removeProject } = useProjectMutations(company?.id);
  const { data: employees } = useEmployees(company?.id);

  const { data: shows } = useShows(projectId);
  const { data: episodes } = useEpisodes(projectId);
  const { data: sequences } = useSequences(projectId);
  const hierarchy = useHierarchyMutations(projectId);

  const { data: members } = useProjectMembers(projectId);
  const memberMutations = useProjectMemberMutations(projectId);

  const { data: milestones } = useMilestones(projectId);
  const milestoneMutations = useMilestoneMutations(projectId);

  const { data: deliverables } = useDeliverables(projectId);
  const deliverableMutations = useDeliverableMutations(projectId);

  const { data: budgetSummary } = useProductionBudgetSummary(projectId);

  // Overview: edit + delete project
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  // Shows
  const [showOpen, setShowOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<ProductionShow | null>(null);
  const [showName, setShowName] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [deleteShowTarget, setDeleteShowTarget] = useState<ProductionShow | null>(null);

  // Episodes
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<ProductionEpisode | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState("1");
  const [episodeName, setEpisodeName] = useState("");
  const [episodeStatus, setEpisodeStatus] = useState("PLANNING");
  const [deleteEpisodeTarget, setDeleteEpisodeTarget] = useState<ProductionEpisode | null>(null);

  // Sequences
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<ProductionSequence | null>(null);
  const [sequenceNumber, setSequenceNumber] = useState("10");
  const [sequenceEpisodeId, setSequenceEpisodeId] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [sequenceStatus, setSequenceStatus] = useState("PLANNING");
  const [deleteSequenceTarget, setDeleteSequenceTarget] = useState<ProductionSequence | null>(null);

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState("");
  const [memberRole, setMemberRole] = useState("ARTIST");

  // Milestones
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProductionMilestone | null>(null);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<ProductionMilestone | null>(null);

  // Deliverables
  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<ProductionDeliverable | null>(null);
  const [deliverableName, setDeliverableName] = useState("");
  const [deliverableDue, setDeliverableDue] = useState("");
  const [deleteDeliverableTarget, setDeleteDeliverableTarget] = useState<ProductionDeliverable | null>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!project) return <ErrorScreen title="Project not found" description="This project does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const openEditProject = () => {
    setProjectName(project.name);
    setProjectDescription(project.description ?? "");
    setEditProjectOpen(true);
  };
  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: project.id, patch: { name: projectName, description: projectDescription || null } });
      toast.success("Project updated");
      setEditProjectOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update project"); }
  };
  const handleDeleteProject = async () => {
    try {
      await removeProject.mutateAsync(project.id);
      toast.success("Project deleted");
      navigate("..");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete project"); }
  };

  const openCreateShow = () => { setEditingShow(null); setShowName(""); setShowDescription(""); setShowOpen(true); };
  const openEditShow = (s: ProductionShow) => { setEditingShow(s); setShowName(s.name); setShowDescription(s.description ?? ""); setShowOpen(true); };
  const handleSaveShow = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingShow) {
        await hierarchy.updateShow.mutateAsync({ id: editingShow.id, patch: { name: showName, description: showDescription || null } });
        toast.success("Show updated");
      } else {
        await hierarchy.createShow.mutateAsync({ companyId: company!.id, projectId: project.id, name: showName, description: showDescription || null });
        toast.success("Show created");
      }
      setShowOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save show"); }
  };
  const handleDeleteShow = async () => {
    if (!deleteShowTarget) return;
    try {
      await hierarchy.deleteShow.mutateAsync(deleteShowTarget.id);
      toast.success("Show deleted");
      setDeleteShowTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete show"); }
  };

  const openCreateEpisode = () => { setEditingEpisode(null); setEpisodeNumber("1"); setEpisodeName(""); setEpisodeStatus("PLANNING"); setEpisodeOpen(true); };
  const openEditEpisode = (ep: ProductionEpisode) => { setEditingEpisode(ep); setEpisodeName(ep.name ?? ""); setEpisodeStatus(ep.status); setEpisodeOpen(true); };
  const handleSaveEpisode = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingEpisode) {
        await hierarchy.updateEpisode.mutateAsync({ id: editingEpisode.id, patch: { name: episodeName || null, status: episodeStatus } });
        toast.success("Episode updated");
      } else {
        await hierarchy.createEpisode.mutateAsync({ companyId: company!.id, projectId: project.id, episodeNumber: Number(episodeNumber) });
        toast.success("Episode created");
      }
      setEpisodeOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save episode"); }
  };
  const handleDeleteEpisode = async () => {
    if (!deleteEpisodeTarget) return;
    try {
      await hierarchy.deleteEpisode.mutateAsync(deleteEpisodeTarget.id);
      toast.success("Episode deleted");
      setDeleteEpisodeTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete episode"); }
  };

  const openCreateSequence = () => { setEditingSequence(null); setSequenceNumber("10"); setSequenceEpisodeId(""); setSequenceName(""); setSequenceStatus("PLANNING"); setSequenceOpen(true); };
  const openEditSequence = (s: ProductionSequence) => { setEditingSequence(s); setSequenceName(s.name ?? ""); setSequenceStatus(s.status); setSequenceOpen(true); };
  const handleSaveSequence = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSequence) {
        await hierarchy.updateSequence.mutateAsync({ id: editingSequence.id, patch: { name: sequenceName || null, status: sequenceStatus } });
        toast.success("Sequence updated");
      } else {
        await hierarchy.createSequence.mutateAsync({ companyId: company!.id, projectId: project.id, episodeId: sequenceEpisodeId || null, sequenceNumber: Number(sequenceNumber) });
        toast.success("Sequence created");
      }
      setSequenceOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save sequence"); }
  };
  const handleDeleteSequence = async () => {
    if (!deleteSequenceTarget) return;
    try {
      await hierarchy.deleteSequence.mutateAsync(deleteSequenceTarget.id);
      toast.success("Sequence deleted");
      setDeleteSequenceTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete sequence"); }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberEmployeeId) return;
    try {
      await memberMutations.add.mutateAsync({ companyId: company!.id, projectId: project.id, employeeId: memberEmployeeId, projectRole: memberRole });
      toast.success("Member added");
      setMemberOpen(false); setMemberEmployeeId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add member"); }
  };

  const openCreateMilestone = () => { setEditingMilestone(null); setMilestoneName(""); setMilestoneDue(""); setMilestoneOpen(true); };
  const openEditMilestone = (m: ProductionMilestone) => { setEditingMilestone(m); setMilestoneName(m.name); setMilestoneDue(m.due_date); setMilestoneOpen(true); };
  const handleSaveMilestone = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingMilestone) {
        await milestoneMutations.update.mutateAsync({ id: editingMilestone.id, patch: { name: milestoneName, dueDate: milestoneDue } });
        toast.success("Milestone updated");
      } else {
        await milestoneMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: milestoneName, dueDate: milestoneDue });
        toast.success("Milestone created");
      }
      setMilestoneOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save milestone"); }
  };
  const handleDeleteMilestone = async () => {
    if (!deleteMilestoneTarget) return;
    try {
      await milestoneMutations.remove.mutateAsync(deleteMilestoneTarget.id);
      toast.success("Milestone deleted");
      setDeleteMilestoneTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete milestone"); }
  };

  const openCreateDeliverable = () => { setEditingDeliverable(null); setDeliverableName(""); setDeliverableDue(""); setDeliverableOpen(true); };
  const openEditDeliverable = (d: ProductionDeliverable) => { setEditingDeliverable(d); setDeliverableName(d.name); setDeliverableDue(d.due_date ?? ""); setDeliverableOpen(true); };
  const handleSaveDeliverable = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingDeliverable) {
        await deliverableMutations.update.mutateAsync({ id: editingDeliverable.id, patch: { name: deliverableName, dueDate: deliverableDue || null } });
        toast.success("Deliverable updated");
      } else {
        await deliverableMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: deliverableName, dueDate: deliverableDue || null });
        toast.success("Deliverable created");
      }
      setDeliverableOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save deliverable"); }
  };
  const handleDeleteDeliverable = async () => {
    if (!deleteDeliverableTarget) return;
    try {
      await deliverableMutations.remove.mutateAsync(deleteDeliverableTarget.id);
      toast.success("Deliverable deleted");
      setDeleteDeliverableTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete deliverable"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{project.project_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.project_type.replace(/_/g, " ")}{project.director_id ? ` · Directed by ${employeeMap.get(project.director_id) ?? "—"}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ProductionStatusBadge status={project.status} />
          <RowActions
            canEdit={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_UPDATE)}
            canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
            onEdit={openEditProject}
            onDelete={() => setDeleteProjectOpen(true)}
          />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">Episodes & Sequences</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {project.description && <p className="text-sm text-foreground">{project.description}</p>}
              <Can permission={PERMISSIONS.PRODUCTION_PROJECTS_UPDATE}>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={project.status} onValueChange={(v) => update.mutate({ id: project.id, patch: { status: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={project.client_portal_enabled} onCheckedChange={(checked) => update.mutate({ id: project.id, patch: { clientPortalEnabled: checked } })} disabled={!project.client_id} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Client portal access</p>
                    <p className="text-xs text-muted-foreground">{project.client_id ? "Lets the linked client see shots and versions marked client-visible." : "Assign a client to this project first."}</p>
                  </div>
                </div>
              </Can>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-6 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Shows</h3>
              <Can permission={PERMISSIONS.PRODUCTION_SHOWS_CREATE}>
                <Button size="sm" variant="outline" onClick={openCreateShow}>+ Show</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(shows ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.description ?? "—"}</TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_SHOWS_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditShow(s)}
                          onDelete={() => setDeleteShowTarget(s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!shows || shows.length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No shows yet — optional unless this project has multiple shows.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Episodes</h3>
              <Can permission={PERMISSIONS.PRODUCTION_EPISODES_CREATE}>
                <Button size="sm" variant="outline" onClick={openCreateEpisode}>+ Episode</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(episodes ?? []).map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell className="font-mono text-xs">{ep.episode_code}</TableCell>
                      <TableCell>{ep.name ?? "—"}</TableCell>
                      <TableCell><ProductionStatusBadge status={ep.status} /></TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_EPISODES_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditEpisode(ep)}
                          onDelete={() => setDeleteEpisodeTarget(ep)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!episodes || episodes.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No episodes yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Sequences</h3>
              <Can permission={PERMISSIONS.PRODUCTION_SEQUENCES_CREATE}>
                <Button size="sm" onClick={openCreateSequence}>+ Sequence</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Sequence</TableHead><TableHead>Episode</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(sequences ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.sequence_code}</TableCell>
                      <TableCell className="text-muted-foreground">{s.episode_id ? episodes?.find((e) => e.id === s.episode_id)?.episode_code ?? "—" : "—"}</TableCell>
                      <TableCell>{s.name ?? "—"}</TableCell>
                      <TableCell><ProductionStatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_SEQUENCES_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditSequence(s)}
                          onDelete={() => setDeleteSequenceTarget(s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!sequences || sequences.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No sequences yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_MEMBERS_MANAGE}>
              <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogTrigger asChild><Button size="sm">+ Add member</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add project member</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Employee</Label>
                      <Select value={memberEmployeeId} onValueChange={setMemberEmployeeId}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={memberRole} onValueChange={setMemberRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["DIRECTOR", "PRODUCER", "SUPERVISOR", "ARTIST", "COORDINATOR", "CLIENT_LIAISON"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={memberMutations.add.isPending}>Add</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{employeeMap.get(m.employee_id) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.project_role}</TableCell>
                    <TableCell>
                      <Can permission={PERMISSIONS.PRODUCTION_MEMBERS_MANAGE}>
                        <Button variant="ghost" size="sm" onClick={() => memberMutations.remove.mutate(m.id)}>Remove</Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
                {(!members || members.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No members yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_MILESTONES_CREATE}>
              <Button size="sm" onClick={openCreateMilestone}>+ Milestone</Button>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {(milestones ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.milestone_code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.due_date}</TableCell>
                    <TableCell><ProductionStatusBadge status={m.status} /></TableCell>
                    <TableCell>
                      <RowActions
                        canEdit={hasPermission(PERMISSIONS.PRODUCTION_MILESTONES_UPDATE)}
                        canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                        onEdit={() => openEditMilestone(m)}
                        onDelete={() => setDeleteMilestoneTarget(m)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(!milestones || milestones.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No milestones yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_DELIVERABLES_CREATE}>
              <Button size="sm" onClick={openCreateDeliverable}>+ Deliverable</Button>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {(deliverables ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.deliverable_code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.due_date ?? "—"}</TableCell>
                    <TableCell><ProductionStatusBadge status={d.status} /></TableCell>
                    <TableCell>
                      <RowActions
                        canEdit={hasPermission(PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE)}
                        canDelete={hasPermission(PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE)}
                        onEdit={() => openEditDeliverable(d)}
                        onDelete={() => setDeleteDeliverableTarget(d)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(!deliverables || deliverables.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No deliverables yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6">
              {!project.budget_id ? (
                <p className="text-sm text-muted-foreground">No budget linked to this project yet. Link one from Finance &gt; Budgets.</p>
              ) : budgetSummary ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold text-foreground">{budgetSummary.total_budget} {budgetSummary.currency_code}</p></div>
                  <div><p className="text-xs text-muted-foreground">Allocated</p><p className="text-lg font-semibold text-foreground">{budgetSummary.allocated}</p></div>
                  <div><p className="text-xs text-muted-foreground">Spent</p><p className="text-lg font-semibold text-foreground">{budgetSummary.spent}</p></div>
                  <div><p className="text-xs text-muted-foreground">Remaining</p><p className="text-lg font-semibold text-foreground">{budgetSummary.remaining}</p></div>
                </div>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- Edit / Create dialogs ---- */}

      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveProject} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>Save changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingShow ? "Edit show" : "New show"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShow} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={showName} onChange={(e) => setShowName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={showDescription} onChange={(e) => setShowDescription(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={hierarchy.createShow.isPending || hierarchy.updateShow.isPending}>{editingShow ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={episodeOpen} onOpenChange={setEpisodeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEpisode ? "Edit episode" : "New episode"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEpisode} className="space-y-3">
            {!editingEpisode && (
              <div className="space-y-1.5"><Label>Episode number</Label><Input type="number" min={1} required value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} /></div>
            )}
            {editingEpisode && (
              <>
                <div className="space-y-1.5"><Label>Name</Label><Input value={episodeName} onChange={(e) => setEpisodeName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={episodeStatus} onValueChange={setEpisodeStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EPISODE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter><Button type="submit" disabled={hierarchy.createEpisode.isPending || hierarchy.updateEpisode.isPending}>{editingEpisode ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sequenceOpen} onOpenChange={setSequenceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSequence ? "Edit sequence" : "New sequence"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSequence} className="space-y-3">
            {!editingSequence && (
              <>
                <div className="space-y-1.5">
                  <Label>Episode (optional)</Label>
                  <Select value={sequenceEpisodeId} onValueChange={setSequenceEpisodeId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(episodes ?? []).map((ep) => <SelectItem key={ep.id} value={ep.id}>{ep.episode_code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Sequence number</Label><Input type="number" min={1} required value={sequenceNumber} onChange={(e) => setSequenceNumber(e.target.value)} /></div>
              </>
            )}
            {editingSequence && (
              <>
                <div className="space-y-1.5"><Label>Name</Label><Input value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={sequenceStatus} onValueChange={setSequenceStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEQUENCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter><Button type="submit" disabled={hierarchy.createSequence.isPending || hierarchy.updateSequence.isPending}>{editingSequence ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMilestone ? "Edit milestone" : "New milestone"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveMilestone} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={milestoneMutations.create.isPending || milestoneMutations.update.isPending}>{editingMilestone ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deliverableOpen} onOpenChange={setDeliverableOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDeliverable ? "Edit deliverable" : "New deliverable"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveDeliverable} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={deliverableName} onChange={(e) => setDeliverableName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={deliverableDue} onChange={(e) => setDeliverableDue(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={deliverableMutations.create.isPending || deliverableMutations.update.isPending}>{editingDeliverable ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirmations ---- */}

      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and everything under it — shows, episodes, sequences, shots, assets, tasks, versions, milestones, and deliverables. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>Delete project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteShowTarget} onOpenChange={(open) => !open && setDeleteShowTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteShowTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShow}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEpisodeTarget} onOpenChange={(open) => !open && setDeleteEpisodeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteEpisodeTarget?.episode_code}?</AlertDialogTitle>
            <AlertDialogDescription>Any sequences and shots under this episode will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEpisode}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSequenceTarget} onOpenChange={(open) => !open && setDeleteSequenceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteSequenceTarget?.sequence_code}?</AlertDialogTitle>
            <AlertDialogDescription>Any shots under this sequence will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSequence}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMilestoneTarget} onOpenChange={(open) => !open && setDeleteMilestoneTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteMilestoneTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMilestone}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDeliverableTarget} onOpenChange={(open) => !open && setDeleteDeliverableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteDeliverableTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDeliverable}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
