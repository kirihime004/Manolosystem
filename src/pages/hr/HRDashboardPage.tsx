import { Link } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useHrDashboardStats } from "@/features/hr/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-semibold text-foreground">{value}</p></CardContent>
    </Card>
  );
}

function BreakdownCard({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available.</p>
        ) : (
          <div className="space-y-2">
            {data.map((d) => (
              <div key={d.label} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate text-muted-foreground">{d.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-medium text-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HRDashboardPage() {
  const { company } = useCompany();
  const { data: stats, isLoading } = useHrDashboardStats(company?.id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!stats) return <p className="text-sm text-muted-foreground">No data available.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground">Employees, attendance, leave, and HR requests at a glance</p>
        </div>
        <Link to="../employees/new" className="text-sm font-medium text-primary hover:underline">+ New employee</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Employees" value={stats.totalEmployees} />
        <StatCard label="Active Employees" value={stats.activeEmployees} />
        <StatCard label="New This Month" value={stats.newEmployeesThisMonth} />
        <StatCard label="On Leave Today" value={stats.employeesOnLeaveToday} />
        <StatCard label="Absent Today" value={stats.employeesAbsentToday} />
        <StatCard label="Pending HR Requests" value={stats.pendingHrRequests} />
        <StatCard label="Contracts Expiring (90d)" value={stats.contractsExpiring90d} />
        <StatCard label="Probation Ending (14d)" value={stats.probationEnding14d} />
        <StatCard label="Pending Payroll" value={stats.pendingPayrollPeriods} />
        <StatCard label="Attendance Exceptions" value={stats.attendanceExceptionsToday} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownCard title="Employees by Department" data={stats.byDepartment} />
        <BreakdownCard title="Employees by Employment Type" data={stats.byEmploymentType} />
        <BreakdownCard title="Employees by Status" data={stats.byEmploymentStatus} />
      </div>
    </div>
  );
}
