import { useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { useProjects, useTasks, useTaskMutations, useProjectTaskStatusOptions, useShots, useAssets } from "@/features/production/hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ProductionRiskBadge, ProductionPriorityBadge } from "@/components/shared/ProductionBadges";
import { ListChecks, Trash2 } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionTask } from "@/types/database";
import { TaskTimelineView } from "@/pages/production/tasks/TaskTimelineView";

const DEFAULT_COLUMNS: { status: string; label: string }[] = [
  { status: "NOT_STARTED", label: "Not Started" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "PENDING_REVIEW", label: "Pending Review" },
  { status: "CHANGES_REQUESTED", label: "Changes Requested" },
  { status: "APPROVED", label: "Approved" },
  { status: "COMPLETED", label: "Completed" },
];

export default function TasksBoardPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: projects } = useProjects(company?.id);
  const [searchParams] = useSearchParams();
  const [projectId, setProjectId] = useState<string>("");
  const activeProjectId = projectId || searchParams.get("project") || projects?.[0]?.id;
  const activeProject = (projects ?? []).find((p) => p.id === activeProjectId);
  const mineOnly = searchParams.get("mine") === "1";

  const { data: tasks, isLoading } = useTasks(company?.id, { projectId: activeProjectId, assignedTo: mineOnly ? myEmployee?.id : undefined });
  const { data: shots } = useShots(activeProjectId);
  const { data: assets } = useAssets(activeProjectId);
  const mutations = useTaskMutations(company?.id);
  const workflowColumns = useProjectTaskStatusOptions(activeProject, DEFAULT_COLUMNS);
  // A task's real status can fall outside the project's chosen workflow --
  // e.g. every task starts life as NOT_STARTED, which a custom pipeline may
  // not include as a stage. Without this, that task would render nowhere
  // on the board at all. Append any such status as its own column instead
  // of silently dropping the task.
  const orphanStatuses = [...new Set((tasks ?? []).map((t) => t.status))].filter(
    (s) => !workflowColumns.some((c) => c.status === s),
  );
  const COLUMNS = [
    ...workflowColumns.map((o) => ({ status: o.status, label: o.label })),
    ...orphanStatuses.map((s) => ({ status: s, label: s.replace(/_/g, " ") })),
  ];

  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionTask | null>(null);

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const grouped = new Map<string, ProductionTask[]>(COLUMNS.map((c) => [c.status, []]));
  for (const t of tasks ?? []) {
    if (!grouped.has(t.status)) grouped.set(t.status, []);
    grouped.get(t.status)!.push(t);
  }

  const handleDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    if (!dragTaskId) return;
    mutations.updateStatus.mutate(
      { id: dragTaskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not move task — it may have unfinished dependencies") },
    );
    setDragTaskId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.remove.mutateAsync(deleteTarget.id);
      toast.success("Task deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Task Board</h1>
          <p className="text-sm text-muted-foreground">Drag a card to change its status, or switch to Timeline</p>
        </div>
        <Select value={activeProjectId ?? ""} onValueChange={setProjectId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select a project…" /></SelectTrigger>
          <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!activeProjectId ? (
        <EmptyState icon={ListChecks} title="No projects yet" description="Create a project first." />
      ) : isLoading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))` }}>
          {Array.from({ length: COLUMNS.length }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="pt-4">
            <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(180px, 1fr))` }}>
              {COLUMNS.map((col) => (
                <div
                  key={col.status}
                  className="min-h-[200px] rounded-lg border border-border bg-muted/30 p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, col.status)}
                >
                  <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{col.label} ({(grouped.get(col.status) ?? []).length})</p>
                  <div className="space-y-2">
                    {(grouped.get(col.status) ?? []).map((t) => (
                      <Can key={t.id} permission={PERMISSIONS.PRODUCTION_TASKS_UPDATE} fallback={<TaskCard task={t} assignee={t.assigned_to ? employeeMap.get(t.assigned_to) : undefined} draggable={false} />}>
                        <div
                          draggable
                          onDragStart={() => setDragTaskId(t.id)}
                        >
                          <TaskCard task={t} assignee={t.assigned_to ? employeeMap.get(t.assigned_to) : undefined} draggable onDelete={() => setDeleteTarget(t)} />
                        </div>
                      </Can>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="pt-4">
            <TaskTimelineView tasks={tasks ?? []} employeeMap={employeeMap} shots={shots ?? []} assets={assets ?? []} />
          </TabsContent>
        </Tabs>
      )}

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

function TaskCard({ task, assignee, draggable, onDelete }: { task: ProductionTask; assignee: string | undefined; draggable: boolean; onDelete?: () => void }) {
  return (
    <Card className={draggable ? "cursor-grab active:cursor-grabbing" : undefined}>
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-medium text-foreground">{task.name}</p>
          {onDelete && (
            <Can permission={PERMISSIONS.PRODUCTION_TASKS_DELETE}>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 -mt-0.5 -mr-0.5"
                draggable={false}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </Can>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{assignee ?? "Unassigned"}</p>
        {task.calculated_amount != null && (
          <p className="text-xs font-medium text-foreground">
            <Money amount={task.calculated_amount} currencyId={task.pricing_currency_id} />
          </p>
        )}
        <div className="flex items-center gap-1.5">
          <ProductionPriorityBadge priority={task.priority} />
          <ProductionRiskBadge risk={task.risk_status} />
        </div>
      </CardContent>
    </Card>
  );
}
