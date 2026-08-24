import { useCompany } from "@/lib/tenant/useCompany";
import { useArAging } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { AgingBucketBadge } from "@/components/shared/FinanceBadges";
import { Clock } from "lucide-react";

export default function ArAgingPage() {
  const { company } = useCompany();
  const { data: rows, isLoading } = useArAging(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);

  const buckets = ["Current", "1-30", "31-60", "61-90", "90+"] as const;
  const totals = Object.fromEntries(buckets.map((b) => [b, (rows ?? []).filter((r) => r.bucket === b).reduce((s, r) => s + r.outstanding, 0)]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">AR Aging</h1>
        <p className="text-sm text-muted-foreground">Outstanding customer invoices by days overdue.</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {buckets.map((b) => (
          <div key={b} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{b}</p>
            <p className="mt-1 text-lg font-semibold text-foreground"><Money amount={totals[b] ?? 0} currencyId={currencySettings?.base_currency_id} /></p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing outstanding" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice</TableHead><TableHead>Due date</TableHead><TableHead>Original</TableHead><TableHead>Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Days overdue</TableHead><TableHead>Bucket</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.invoice_id}>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.invoice_number}</TableCell>
                  <TableCell className="text-muted-foreground">{r.due_date}</TableCell>
                  <TableCell><Money amount={r.original_amount} currencyId={currencySettings?.base_currency_id} /></TableCell>
                  <TableCell><Money amount={r.paid_amount} currencyId={currencySettings?.base_currency_id} /></TableCell>
                  <TableCell className="font-medium"><Money amount={r.outstanding} currencyId={currencySettings?.base_currency_id} /></TableCell>
                  <TableCell>{r.days_overdue}</TableCell>
                  <TableCell><AgingBucketBadge bucket={r.bucket} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
