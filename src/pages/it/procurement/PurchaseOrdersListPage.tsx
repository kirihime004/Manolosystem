import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePurchaseOrders } from "@/features/it/procurement/hooks";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PurchaseOrderStatusBadge } from "@/components/shared/ProcurementBadges";
import type { PurchaseOrderStatus } from "@/types/database";

const STATUSES: PurchaseOrderStatus[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT_TO_SUPPLIER", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED", "CLOSED"];

export default function PurchaseOrdersListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: orders, isLoading } = usePurchaseOrders(company?.id, { search: search || undefined, status: status === "all" ? undefined : status });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground">{orders?.length ?? 0} orders</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search PO number…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !orders || orders.length === 0 ? (
          <EmptyState icon={Package} title="No purchase orders" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>PO Number</TableHead><TableHead>Supplier</TableHead><TableHead>Total</TableHead><TableHead>Expected Delivery</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/it/procurement/orders/${po.id}`)}>
                  <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
                  <TableCell className="font-medium">{po.supplier?.name ?? "—"}</TableCell>
                  <TableCell><Money amount={po.total} currencyId={po.currency_id} /></TableCell>
                  <TableCell className="text-muted-foreground">{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><PurchaseOrderStatusBadge status={po.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
