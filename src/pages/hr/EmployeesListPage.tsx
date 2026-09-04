import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Users, Search } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees, useEmploymentStatuses } from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmploymentStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function EmployeesListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("all");

  const { data: departments } = useDepartments(company?.id);
  const { data: statuses } = useEmploymentStatuses(company?.id);
  const { data: employees, isLoading } = useEmployees(company?.id, {
    search: search || undefined,
    departmentId: departmentId === "all" ? undefined : departmentId,
  });

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees?.length ?? 0} employees</p>
        </div>
        <div className="flex gap-2">
          <Can permission={[PERMISSIONS.ADMIN_USERS_MANAGE, PERMISSIONS.HR_EMPLOYEES_CREATE]} requireAll>
            <Button asChild variant="outline"><Link to={`/c/${companySlug}/settings/users/import`}>Import from Excel</Link></Button>
          </Can>
          <Can permission={PERMISSIONS.HR_EMPLOYEES_CREATE}>
            <Button asChild><Link to="new">+ New employee</Link></Button>
          </Can>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, ID, email…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !employees || employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet" description="Add your first employee to get started." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
                <TableHead>Company Email</TableHead><TableHead>Hire Date</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const status = e.employment_status_id ? statusMap.get(e.employment_status_id) : undefined;
                return (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/hr/employees/${e.id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{e.employee_number}</TableCell>
                    <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.department_id ? (deptMap.get(e.department_id) ?? "—") : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.company_email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.hire_date ? new Date(e.hire_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{status ? <EmploymentStatusBadge label={status.label} isActive={status.is_active_employment} /> : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
