import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminDashboardSummary } from "@/features/admin/hooks";
import { exportCsv } from "@/lib/csvExport";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AdminReportsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: summary, isLoading } = useAdminDashboardSummary(company?.id);

  const cards: { label: string; value: number | undefined; href: string }[] = [
    { label: "Open Admin Requests", value: summary?.open_requests, href: `/c/${companySlug}/admin/requests` },
    { label: "Pending Approvals", value: summary?.pending_approvals, href: `/c/${companySlug}/admin/requests?status=PENDING_APPROVAL` },
    { label: "Today's Visitors", value: summary?.today_visitors, href: `/c/${companySlug}/admin/visitors` },
    { label: "Today's Meetings", value: summary?.today_meetings, href: `/c/${companySlug}/admin/meetings` },
    { label: "Upcoming Events", value: summary?.upcoming_events, href: `/c/${companySlug}/admin/events` },
    { label: "Low Office Supplies", value: summary?.low_stock_supplies, href: `/c/${companySlug}/admin/supplies` },
    { label: "Maintenance Due", value: summary?.maintenance_due, href: `/c/${companySlug}/admin/maintenance` },
    { label: "Contracts Expiring", value: summary?.contracts_expiring, href: `/c/${companySlug}/admin/contracts` },
    { label: "Documents Expiring", value: summary?.documents_expiring, href: `/c/${companySlug}/admin/documents` },
    { label: "Compliance Due", value: summary?.compliance_due, href: `/c/${companySlug}/admin/compliance` },
    { label: "Vehicle Renewals", value: summary?.vehicle_renewals, href: `/c/${companySlug}/admin/vehicles` },
    { label: "Upcoming Travel", value: summary?.upcoming_travel, href: `/c/${companySlug}/admin/travel` },
  ];

  const handleExport = () => {
    exportCsv(`admin-report-${new Date().toISOString().slice(0, 10)}.csv`, [
      { label: "Metric", render: (c: typeof cards[number]) => c.label },
      { label: "Count", render: (c: typeof cards[number]) => String(c.value ?? 0) },
    ], cards);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administration Reports</h1>
          <p className="text-sm text-muted-foreground">Current snapshot across facilities, fleet, and administration</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Can permission={PERMISSIONS.ADMIN_REPORTS_PRINT}>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
          </Can>
          <Can permission={PERMISSIONS.ADMIN_REPORTS_EXPORT}>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export CSV</Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2"><CardDescription>{c.label}</CardDescription></CardHeader>
                <CardContent><div className="text-2xl font-semibold text-foreground">{c.value ?? 0}</div></CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}
