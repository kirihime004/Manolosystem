import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { usePurchaseRequests } from "@/features/it/procurement/hooks";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PurchaseRequestStatusBadge, RequestPriorityBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import type { BudgetModuleKey, PurchaseRequestStatus } from "@/types/database";

const STATUSES: PurchaseRequestStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED", "CONVERTED_TO_PO"];

export default function PurchaseRequestsListPage({ moduleKey = "IT" }: { moduleKey?: BudgetModuleKey }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const config = PROCUREMENT_MODULE_CONFIG[moduleKey];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [mineOnly, setMineOnly] = useState(!hasPermission(config.viewPermission));

  const { data: requests, isLoading } = usePurchaseRequests(
    company?.id,
    { search: search || undefined, status: status === "all" ? undefined : status, mineOnly },
    user?.id,
    moduleKey,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{config.label} Purchase Requests</h1>
          <p className="text-sm text-muted-foreground">{requests?.length ?? 0} requests</p>
        </div>
        <Can permission={config.createPermission}>
          <Link to={`/c/${companySlug}/${config.basePath}/requests/new`}>
            <Button><Plus className="h-4 w-4" />New request</Button>
          </Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search number, reason…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Can permission={config.viewPermission}>
          <Button variant={mineOnly ? "outline" : "default"} size="sm" onClick={() => setMineOnly((v) => !v)}>
            {mineOnly ? "Showing: mine only" : "Showing: all requests"}
          </Button>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <EmptyState icon={FileText} title="No purchase requests" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Estimated Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/${config.basePath}/requests/${r.id}`)}>
                  <TableCell className="font-mono text-xs font-medium">{r.request_number}</TableCell>
                  <TableCell className="text-muted-foreground">{r.requester ? `${r.requester.first_name ?? ""} ${r.requester.last_name ?? ""}`.trim() : "—"}</TableCell>
                  <TableCell><RequestPriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><Money amount={r.estimated_total} currencyId={r.currency_id} /></TableCell>
                  <TableCell><PurchaseRequestStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.request_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
