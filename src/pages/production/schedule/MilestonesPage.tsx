import { CalendarRange } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllMilestones, useProjects } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";

export default function MilestonesPage() {
  const { company } = useCompany();
  const { data: milestones, isLoading } = useAllMilestones(company?.id);
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));

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
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.milestone_code}</TableCell>
                  <TableCell className="text-muted-foreground">{projectMap.get(m.project_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.milestone_type}</TableCell>
                  <TableCell className="text-muted-foreground">{m.due_date}</TableCell>
                  <TableCell><ProductionStatusBadge status={m.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
