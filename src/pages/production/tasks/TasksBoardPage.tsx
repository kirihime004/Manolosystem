import { useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { useProjects, useTasks, useTaskMutations } from "@/features/production/hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionRiskBadge, ProductionPriorityBadge } from "@/components/shared/ProductionBadges";
import { ListChecks } from "lucide-react";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionTask } from "@/types/database";

const COLUMNS: { status: string; label: string }[] = [
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
  const activeProjectId = projectId || projects?.[0]?.id;
  const mineOnly = searchParams.get("mine") === "1";

  const { data: tasks, isLoading } = useTasks(company?.id, { projectId: activeProjectId, assignedTo: mineOnly ? myEmployee?.id : undefined });
  const mutations = useTaskMutations(company?.id);

  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Task Board</h1>
          <p className="text-sm text-muted-foreground">Drag a card to change its status</p>
        </div>
        <Select value={activeProjectId ?? ""} onValueChange={setProjectId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select a project…" /></SelectTrigger>
          <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!activeProjectId ? (
        <EmptyState icon={ListChecks} title="No projects yet" description="Create a project first." />
      ) : isLoading ? (
        <div className="grid grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6">
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
                      <TaskCard task={t} assignee={t.assigned_to ? employeeMap.get(t.assigned_to) : undefined} draggable />
                    </div>
                  </Can>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, assignee, draggable }: { task: ProductionTask; assignee: string | undefined; draggable: boolean }) {
  return (
    <Card className={draggable ? "cursor-grab active:cursor-grabbing" : undefined}>
      <CardContent className="space-y-1.5 p-3">
        <p className="text-sm font-medium text-foreground">{task.name}</p>
        <p className="text-xs text-muted-foreground">{assignee ?? "Unassigned"}</p>
        <div className="flex items-center gap-1.5">
          <ProductionPriorityBadge priority={task.priority} />
          <ProductionRiskBadge risk={task.risk_status} />
        </div>
      </CardContent>
    </Card>
  );
}
