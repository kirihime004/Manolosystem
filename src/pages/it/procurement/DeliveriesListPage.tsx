import { Link, useParams } from "react-router-dom";
import { Truck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDeliveries } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DeliveriesListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: deliveries, isLoading } = useDeliveries(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Deliveries</h1>
        <p className="text-sm text-muted-foreground">{deliveries?.length ?? 0} deliveries received</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !deliveries || deliveries.length === 0 ? (
          <EmptyState icon={Truck} title="No deliveries yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Delivery</TableHead><TableHead>Purchase Order</TableHead><TableHead>Date</TableHead><TableHead>Tracking</TableHead></TableRow></TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs font-medium">{d.delivery_number}</TableCell>
                  <TableCell>
                    <Link to={`/c/${companySlug}/it/procurement/orders/${d.purchase_order_id}`} className="font-medium text-foreground hover:underline">
                      {d.purchase_order?.po_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(d.delivery_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">{d.tracking_number ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
