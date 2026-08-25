import { Gauge } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProductionWorkload } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ResourcesPage() {
  const { company } = useCompany();
  const { data: workload, isLoading } = useProductionWorkload(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Resources</h1>
        <p className="text-sm text-muted-foreground">Team workload and availability</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !workload || workload.length === 0 ? (
          <EmptyState icon={Gauge} title="No workload data" description="Assign tasks to employees to see their workload here." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Open tasks</TableHead><TableHead>Estimated hours</TableHead><TableHead>Available today</TableHead></TableRow></TableHeader>
            <TableBody>
              {workload.map((w) => (
                <TableRow key={w.employee_id}>
                  <TableCell className="font-medium">{w.employee_name}</TableCell>
                  <TableCell className="text-muted-foreground">{w.open_task_count}</TableCell>
                  <TableCell className="text-muted-foreground">{w.total_estimated_hours}</TableCell>
                  <TableCell className={w.is_available_today ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {w.is_available_today ? "Yes" : "No"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
