import { useState } from "react";
import { toast } from "sonner";
import { CalendarRange, MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllMilestones, useMilestoneMutations, useProjects } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionMilestone } from "@/types/database";

const STATUSES = ["UPCOMING", "AT_RISK", "LATE", "COMPLETED", "CANCELLED"];

export default function MilestonesPage() {
  const { company } = useCompany();
  const { data: milestones, isLoading } = useAllMilestones(company?.id);
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const [scopeProjectId, setScopeProjectId] = useState<string>("");
  const mutations = useMilestoneMutations(scopeProjectId || undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductionMilestone | null>(null);

  const handleUpdateStatus = async (id: string, projectId: string, status: string) => {
    setScopeProjectId(projectId);
    try {
      await mutations.update.mutateAsync({ id, patch: { status } });
      toast.success("Milestone updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update milestone");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setScopeProjectId(deleteTarget.project_id);
    try {
      await mutations.remove.mutateAsync(deleteTarget.id);
      toast.success("Milestone deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete milestone");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Schedule</h1>
        <p className="text-sm text-muted-foreground">Milestones across every active project</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !milestones || milestones.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No milestones yet" description="Add milestones from a project's Milestones tab." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.milestone_code}</TableCell>
                  <TableCell className="text-muted-foreground">{projectMap.get(m.project_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.milestone_type}</TableCell>
                  <TableCell className="text-muted-foreground">{m.due_date}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_MILESTONES_UPDATE} fallback={<ProductionStatusBadge status={m.status} />}>
                      <Select value={m.status} onValueChange={(v) => handleUpdateStatus(m.id, m.project_id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </Can>
                  </TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_PROJECTS_MANAGE}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(m)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
