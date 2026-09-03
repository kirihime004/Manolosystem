import { Download, Printer } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useHrDashboardStats } from "@/features/hr/hooks";
import { useAllContracts, useAllEmployeeDocuments } from "@/features/hr/hooks";
import { exportCsv } from "@/lib/csvExport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function HrReportsPage() {
  const { company } = useCompany();
  const { data: stats, isLoading } = useHrDashboardStats(company?.id);
  const { data: contracts } = useAllContracts(company?.id);
  const { data: documents } = useAllEmployeeDocuments(company?.id);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!stats) return <p className="text-sm text-muted-foreground">No data available.</p>;

  const today = new Date().toISOString().slice(0, 10);
  const expiringContracts = (contracts ?? []).filter((c) => c.end_date && c.end_date >= today).slice(0, 10);
  const expiringDocuments = (documents ?? []).filter((d) => d.expiry_date && d.expiry_date >= today).slice(0, 10);

  const handleExport = () => {
    const rows = [
      ...stats.byDepartment.map((d) => ({ category: "Department", label: d.label, count: d.count })),
      ...stats.byEmploymentStatus.map((s) => ({ category: "Employment Status", label: s.label, count: s.count })),
      ...stats.byEmploymentType.map((t) => ({ category: "Employment Type", label: t.label, count: t.count })),
    ];
    exportCsv(`hr-report-${today}.csv`, [
      { label: "Category", render: (r: typeof rows[number]) => r.category },
      { label: "Label", render: (r: typeof rows[number]) => r.label },
      { label: "Count", render: (r: typeof rows[number]) => String(r.count) },
    ], rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">HR Reports</h1>
          <p className="text-sm text-muted-foreground">Headcount, turnover, and expiry reporting</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Can permission={PERMISSIONS.HR_REPORTS_PRINT}>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
          </Can>
          <Can permission={PERMISSIONS.HR_REPORTS_EXPORT}>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export CSV</Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard title="Headcount">
          <p className="text-2xl font-semibold text-foreground">{stats.totalEmployees}</p>
          <p className="text-xs text-muted-foreground">{stats.activeEmployees} active · {stats.newEmployeesThisMonth} new this month</p>
        </ReportCard>

        <ReportCard title="Employees by Department">
          {stats.byDepartment.length === 0 ? <p className="text-sm text-muted-foreground">No data available.</p> : (
            <ul className="space-y-1 text-sm">{stats.byDepartment.map((d) => <li key={d.label} className="flex justify-between"><span className="text-muted-foreground">{d.label}</span><span className="font-medium">{d.count}</span></li>)}</ul>
          )}
        </ReportCard>

        <Can permission={PERMISSIONS.HR_CONTRACTS_VIEW}>
          <ReportCard title="Contract Expiry Report">
            {expiringContracts.length === 0 ? <p className="text-sm text-muted-foreground">No data available.</p> : (
              <ul className="space-y-1 text-sm">{expiringContracts.map((c) => <li key={c.id} className="flex justify-between"><span className="font-mono text-xs">{c.contract_number}</span><span className="text-muted-foreground">{c.end_date}</span></li>)}</ul>
            )}
          </ReportCard>
        </Can>

        <Can permission={PERMISSIONS.HR_DOCUMENTS_VIEW}>
          <ReportCard title="Document Expiry Report">
            {expiringDocuments.length === 0 ? <p className="text-sm text-muted-foreground">No data available.</p> : (
              <ul className="space-y-1 text-sm">{expiringDocuments.map((d) => <li key={d.id} className="flex justify-between"><span>{d.title}</span><span className="text-muted-foreground">{d.expiry_date}</span></li>)}</ul>
            )}
          </ReportCard>
        </Can>

        <ReportCard title="Employment Status Report">
          {stats.byEmploymentStatus.length === 0 ? <p className="text-sm text-muted-foreground">No data available.</p> : (
            <ul className="space-y-1 text-sm">{stats.byEmploymentStatus.map((s) => <li key={s.label} className="flex justify-between"><span className="text-muted-foreground">{s.label}</span><span className="font-medium">{s.count}</span></li>)}</ul>
          )}
        </ReportCard>

        <ReportCard title="Employment Type Report">
          {stats.byEmploymentType.length === 0 ? <p className="text-sm text-muted-foreground">No data available.</p> : (
            <ul className="space-y-1 text-sm">{stats.byEmploymentType.map((t) => <li key={t.label} className="flex justify-between"><span className="text-muted-foreground">{t.label}</span><span className="font-medium">{t.count}</span></li>)}</ul>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
