import { useCompany } from "@/lib/tenant/useCompany";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useEmployees } from "@/features/hr/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import type { Department, Employee } from "@/types/database";

function DepartmentNode({ dept, allDepartments, employees, depth }: {
  dept: Department; allDepartments: Department[]; employees: Employee[]; depth: number;
}) {
  const children = allDepartments.filter((d) => d.parent_department_id === dept.id);
  const manager = employees.find((e) => e.id === dept.manager_id);
  const memberCount = employees.filter((e) => e.department_id === dept.id).length;

  return (
    <div style={{ marginLeft: depth * 24 }} className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
          {dept.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{dept.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {manager ? `${manager.first_name} ${manager.last_name}` : "No manager"} · {memberCount} {memberCount === 1 ? "employee" : "employees"}
          </p>
        </div>
      </div>
      {children.length > 0 && (
        <div className="space-y-2 border-l border-border pl-3">
          {children.map((c) => <DepartmentNode key={c.id} dept={c} allDepartments={allDepartments} employees={employees} depth={depth} />)}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { company } = useCompany();
  const { data: departments, isLoading: loadingDepts } = useDepartments(company?.id);
  const { data: employees, isLoading: loadingEmps } = useEmployees(company?.id);

  if (loadingDepts || loadingEmps) return <Skeleton className="h-96 w-full" />;

  const roots = (departments ?? []).filter((d) => !d.parent_department_id);
  const unassigned = (employees ?? []).filter((e) => !e.department_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Organizational Chart</h1>
        <p className="text-sm text-muted-foreground">Departments and their managers, nested by hierarchy</p>
      </div>

      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data available.</p>
      ) : (
        <div className="space-y-3">
          {roots.map((d) => <DepartmentNode key={d.id} dept={d} allDepartments={departments ?? []} employees={employees ?? []} depth={0} />)}
        </div>
      )}

      {unassigned.length > 0 && (
        <p className="text-xs text-muted-foreground">{unassigned.length} employee(s) have no department assigned.</p>
      )}
    </div>
  );
}
