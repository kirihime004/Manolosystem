import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { company } = useCompany();
  const { data: project, isLoading } = useProject(projectId);
  const { update } = useProjectMutations(company?.id);
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

  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [episodeNumber, setEpisodeNumber] = useState("1");
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [sequenceNumber, setSequenceNumber] = useState("10");
  const [sequenceEpisodeId, setSequenceEpisodeId] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState("");
  const [memberRole, setMemberRole] = useState("ARTIST");
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [deliverableName, setDeliverableName] = useState("");
  const [deliverableDue, setDeliverableDue] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!project) return <ErrorScreen title="Project not found" description="This project does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreateEpisode = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await hierarchy.createEpisode.mutateAsync({ companyId: company!.id, projectId: project.id, episodeNumber: Number(episodeNumber) });
      toast.success("Episode created");
      setEpisodeOpen(false); setEpisodeNumber("1");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create episode"); }
  };

  const handleCreateSequence = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await hierarchy.createSequence.mutateAsync({ companyId: company!.id, projectId: project.id, episodeId: sequenceEpisodeId || null, sequenceNumber: Number(sequenceNumber) });
      toast.success("Sequence created");
      setSequenceOpen(false); setSequenceNumber("10");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create sequence"); }
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

  const handleCreateMilestone = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await milestoneMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: milestoneName, dueDate: milestoneDue });
      toast.success("Milestone created");
      setMilestoneOpen(false); setMilestoneName(""); setMilestoneDue("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create milestone"); }
  };

  const handleCreateDeliverable = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await deliverableMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: deliverableName, dueDate: deliverableDue || null });
      toast.success("Deliverable created");
      setDeliverableOpen(false); setDeliverableName(""); setDeliverableDue("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create deliverable"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{project.project_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.project_type.replace(/_/g, " ")}{project.director_id ? ` · Directed by ${employeeMap.get(project.director_id) ?? "—"}` : ""}</p>
        </div>
        <ProductionStatusBadge status={project.status} />
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

        <TabsContent value="hierarchy" className="space-y-4 pt-4">
          <div className="flex justify-end gap-2">
            <Can permission={PERMISSIONS.PRODUCTION_EPISODES_CREATE}>
              <Dialog open={episodeOpen} onOpenChange={setEpisodeOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">+ Episode</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New episode</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateEpisode} className="space-y-3">
                    <div className="space-y-1.5"><Label>Episode number</Label><Input type="number" min={1} required value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={hierarchy.createEpisode.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
            <Can permission={PERMISSIONS.PRODUCTION_SEQUENCES_CREATE}>
              <Dialog open={sequenceOpen} onOpenChange={setSequenceOpen}>
                <DialogTrigger asChild><Button size="sm">+ Sequence</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New sequence</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateSequence} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Episode (optional)</Label>
                      <Select value={sequenceEpisodeId} onValueChange={setSequenceEpisodeId}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>{(episodes ?? []).map((ep) => <SelectItem key={ep.id} value={ep.id}>{ep.episode_code}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Sequence number</Label><Input type="number" min={1} required value={sequenceNumber} onChange={(e) => setSequenceNumber(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={hierarchy.createSequence.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>

          {shows && shows.length > 0 && (
            <p className="text-xs text-muted-foreground">{shows.length} show{shows.length === 1 ? "" : "s"} configured for this project.</p>
          )}

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Sequence</TableHead><TableHead>Episode</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(sequences ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sequence_code}</TableCell>
                    <TableCell className="text-muted-foreground">{s.episode_id ? episodes?.find((e) => e.id === s.episode_id)?.episode_code ?? "—" : "—"}</TableCell>
                    <TableCell>{s.name ?? "—"}</TableCell>
                    <TableCell><ProductionStatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))}
                {(!sequences || sequences.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No sequences yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
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
              <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
                <DialogTrigger asChild><Button size="sm">+ Milestone</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New milestone</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateMilestone} className="space-y-3">
                    <div className="space-y-1.5"><Label>Name</Label><Input required value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={milestoneMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(milestones ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.milestone_code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.due_date}</TableCell>
                    <TableCell><ProductionStatusBadge status={m.status} /></TableCell>
                  </TableRow>
                ))}
                {(!milestones || milestones.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No milestones yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_DELIVERABLES_CREATE}>
              <Dialog open={deliverableOpen} onOpenChange={setDeliverableOpen}>
                <DialogTrigger asChild><Button size="sm">+ Deliverable</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New deliverable</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateDeliverable} className="space-y-3">
                    <div className="space-y-1.5"><Label>Name</Label><Input required value={deliverableName} onChange={(e) => setDeliverableName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={deliverableDue} onChange={(e) => setDeliverableDue(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={deliverableMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(deliverables ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.deliverable_code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.due_date ?? "—"}</TableCell>
                    <TableCell><ProductionStatusBadge status={d.status} /></TableCell>
                  </TableRow>
                ))}
                {(!deliverables || deliverables.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deliverables yet.</TableCell></TableRow>
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
    </div>
  );
}
