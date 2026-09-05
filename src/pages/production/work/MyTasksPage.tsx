import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ListChecks, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useTasks, useProjects, useTaskTypes } from "@/features/production/hooks";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";

const FILTERS = [
  { key: "__all__", label: "All" },
  { key: "NOT_STARTED", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "PENDING_REVIEW", label: "For Review" },
  { key: "APPROVED", label: "Approved" },
] as const;

export default function MyTasksPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: tasks, isLoading } = useTasks(company?.id, { assignedTo: myEmployee?.id });
  const { data: projects } = useProjects(company?.id);
  const { data: taskTypes } = useTaskTypes(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const taskTypeMap = new Map((taskTypes ?? []).map((tt) => [tt.id, tt.name]));

  const [projectFilter, setProjectFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]["key"]>("__all__");

  const counts = {
    total: tasks?.length ?? 0,
    todo: (tasks ?? []).filter((t) => t.status === "NOT_STARTED").length,
    inProgress: (tasks ?? []).filter((t) => t.status === "IN_PROGRESS").length,
    review: (tasks ?? []).filter((t) => t.status === "PENDING_REVIEW").length,
    approved: (tasks ?? []).filter((t) => t.status === "APPROVED" || t.status === "COMPLETED").length,
  };
  const filtered = (tasks ?? []).filter((t) => {
    if (projectFilter !== "__all__" && t.project_id !== projectFilter) return false;
    if (statusFilter !== "__all__" && t.status !== statusFilter) return false;
    return true;
  });
  const myProjectIds = [...new Set((tasks ?? []).map((t) => t.project_id))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Tasks</h1>
        <p className="text-sm text-muted-foreground">Everything assigned to you, across every project</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Total</CardDescription><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>In Progress</CardDescription><Clock className="h-4 w-4 text-blue-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>For Review</CardDescription><PauseCircle className="h-4 w-4 text-amber-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.review}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Approved</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.approved}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={statusFilter === f.key ? "default" : "outline"} onClick={() => setStatusFilter(f.key)}>{f.label}</Button>
          ))}
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="ml-auto w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Projects</SelectItem>
            {myProjectIds.map((id) => <SelectItem key={id} value={id}>{projectMap.get(id) ?? id}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing here" description="Tasks assigned to you will show up here." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Stage</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{projectMap.get(t.project_id) ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.task_type_id ? taskTypeMap.get(t.task_type_id) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.due_date ?? "—"}</TableCell>
                  <TableCell><ProductionStatusBadge status={t.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" asChild><Link to={`/c/${companySlug}/production/projects/${t.project_id}`}>Open</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
