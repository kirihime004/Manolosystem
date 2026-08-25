import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminDashboardSummary } from "@/features/admin/hooks";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground">Operational overview for {company?.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : cards.map((c) => (
              <Link key={c.label} to={c.href}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardDescription>{c.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-foreground">{c.value ?? 0}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>
    </div>
  );
}
