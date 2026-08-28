import { Link, useParams } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useQuotations } from "@/features/it/procurement/hooks";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { QuotationStatusBadge } from "@/components/shared/ProcurementBadges";
import type { BudgetModuleKey } from "@/types/database";

export default function QuotationsListPage({ moduleKey = "IT" }: { moduleKey?: BudgetModuleKey }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const config = PROCUREMENT_MODULE_CONFIG[moduleKey];
  const { data: quotations, isLoading } = useQuotations(company?.id, moduleKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{config.label} Quotations</h1>
        <p className="text-sm text-muted-foreground">{quotations?.length ?? 0} quotations across all requests</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !quotations || quotations.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No quotations yet" description="Quotations are added from a purchase request's detail page." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Supplier</TableHead><TableHead>Total</TableHead><TableHead>Delivery</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/${config.basePath}/requests/${q.purchase_request_id}`)}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/${config.basePath}/requests/${q.purchase_request_id}`} className="font-mono text-xs font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {q.purchase_request?.request_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{q.supplier?.name ?? "—"}</TableCell>
                  <TableCell><Money amount={q.total} currencyId={q.currency_id} /></TableCell>
                  <TableCell className="text-muted-foreground">{q.delivery_time_days ? `${q.delivery_time_days} days` : "—"}</TableCell>
                  <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
