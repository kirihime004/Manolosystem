import { useState } from "react";
import { toast } from "sonner";
import { SendToBack, MoreHorizontal } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllDeliverables, useDeliverableMutations, useProjects } from "@/features/production/hooks";
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
import type { ProductionDeliverable } from "@/types/database";

const STATUSES = ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "REJECTED"];

export default function DeliverablesPage() {
  const { company } = useCompany();
  const { data: deliverables, isLoading } = useAllDeliverables(company?.id);
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const [scopeProjectId, setScopeProjectId] = useState<string>("");
  const mutations = useDeliverableMutations(scopeProjectId || undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductionDeliverable | null>(null);

  const handleUpdateStatus = async (id: string, projectId: string, status: string) => {
    setScopeProjectId(projectId);
    try {
      await mutations.update.mutateAsync({ id, patch: { status, deliveredDate: status === "DELIVERED" ? new Date().toISOString().slice(0, 10) : undefined } });
      toast.success("Deliverable updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update deliverable");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setScopeProjectId(deleteTarget.project_id);
    try {
      await mutations.remove.mutateAsync(deleteTarget.id);
      toast.success("Deliverable deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete deliverable");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Deliverables</h1>
        <p className="text-sm text-muted-foreground">Client deliverables across every project</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !deliverables || deliverables.length === 0 ? (
          <EmptyState icon={SendToBack} title="No deliverables yet" description="Add deliverables from a project's Deliverables tab." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {deliverables.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.deliverable_code}</TableCell>
                  <TableCell className="text-muted-foreground">{projectMap.get(d.project_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.due_date ?? "—"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE} fallback={<ProductionStatusBadge status={d.status} />}>
                      <Select value={d.status} onValueChange={(v) => handleUpdateStatus(d.id, d.project_id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </Can>
                  </TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(d)}>Delete</DropdownMenuItem>
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
