import { useState } from "react";
import { toast } from "sonner";
import { useTaskDependencies, useTaskDependencyMutations } from "@/features/production/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";
import { X } from "lucide-react";
import type { ProductionTask } from "@/types/database";

const DEPENDENCY_TYPES = [
  { value: "FS", label: "Finish-to-Start", hint: "predecessor must finish before this starts (the only type actually enforced)" },
  { value: "SS", label: "Start-to-Start", hint: "recorded, not enforced" },
  { value: "FF", label: "Finish-to-Finish", hint: "recorded, not enforced" },
  { value: "SF", label: "Start-to-Finish", hint: "recorded, not enforced" },
];

// Lives inside the "Edit task" dialog, alongside CustomFieldsSection and
// TaskPricingPanel -- same reasoning as those: no dedicated task detail
// route exists in this app. Predecessors are scoped to the current shot's
// own task list (siblingTasks) to keep the picker simple; the schema and
// the enforce_task_dependency_gate() trigger don't actually require the
// predecessor to be on the same shot, but a same-shot picker covers the
// overwhelming majority of real dependency setups.
export function TaskDependenciesPanel({ task, siblingTasks }: { task: ProductionTask; siblingTasks: ProductionTask[] }) {
  const { data: dependencies } = useTaskDependencies(task.id);
  const mutations = useTaskDependencyMutations(task.id);

  const [predecessorId, setPredecessorId] = useState("");
  const [dependencyType, setDependencyType] = useState("FS");

  const existingIds = new Set((dependencies ?? []).map((d) => d.depends_on_task_id));
  const candidates = siblingTasks.filter((t) => t.id !== task.id && !existingIds.has(t.id));
  const taskById = new Map(siblingTasks.map((t) => [t.id, t]));

  const handleAdd = async () => {
    if (!predecessorId) return;
    try {
      await mutations.add.mutateAsync({ companyId: task.company_id, taskId: task.id, dependsOnTaskId: predecessorId, dependencyType });
      toast.success("Dependency added");
      setPredecessorId("");
      setDependencyType("FS");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add dependency"));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await mutations.remove.mutateAsync(id);
      toast.success("Dependency removed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove dependency"));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <h4 className="text-sm font-semibold text-foreground">Dependencies</h4>

      {(dependencies ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No dependencies — this task can move to any status freely.</p>
      ) : (
        <ul className="space-y-1.5">
          {(dependencies ?? []).map((d) => {
            const predecessor = taskById.get(d.depends_on_task_id);
            const typeLabel = DEPENDENCY_TYPES.find((t) => t.value === d.dependency_type)?.label ?? d.dependency_type;
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-muted-foreground">{typeLabel}:</span>
                  <span className="truncate font-medium text-foreground">{predecessor?.name ?? "Task on another shot"}</span>
                  {predecessor && <ProductionStatusBadge status={predecessor.status} />}
                </div>
                <Can permission={PERMISSIONS.PRODUCTION_DEPENDENCIES_MANAGE}>
                  <Button type="button" variant="ghost" size="icon-xs" className="shrink-0" onClick={() => handleRemove(d.id)} disabled={mutations.remove.isPending}>
                    <X className="h-3 w-3" />
                  </Button>
                </Can>
              </li>
            );
          })}
        </ul>
      )}

      <Can permission={PERMISSIONS.PRODUCTION_DEPENDENCIES_MANAGE}>
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No other tasks on this shot to depend on yet.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label className="text-xs">Depends on</Label>
              <Select value={predecessorId} onValueChange={setPredecessorId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a task…" /></SelectTrigger>
                <SelectContent>{candidates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={dependencyType} onValueChange={setDependencyType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{DEPENDENCY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" onClick={handleAdd} disabled={!predecessorId || mutations.add.isPending}>
              {mutations.add.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        )}
      </Can>
    </div>
  );
}
