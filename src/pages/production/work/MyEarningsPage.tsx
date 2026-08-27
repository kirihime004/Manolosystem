import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useTasks, useMyWorkEarnings } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Wallet } from "lucide-react";

const PENDING = ["SUBMITTED", "UNDER_REVIEW"];
const APPROVED_UNPAID = ["APPROVED", "PAYABLE", "SENT_TO_FINANCE", "IN_PAYROLL"];

// No existing "My X" page precedent in this app — genuinely new, but
// ownership is the same pattern already used everywhere else (my
// employee record, filtered by employee_id — enforced again server-side
// by production_work_earnings_select's RLS policy).
export default function MyEarningsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: earnings, isLoading } = useMyWorkEarnings(company?.id, myEmployee?.id);
  const { data: tasks } = useTasks(company?.id, { assignedTo: myEmployee?.id });
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.name]));

  const sum = (statuses: string[], field: "requested_amount" | "approved_amount") =>
    (earnings ?? [])
      .filter((e) => statuses.includes(e.status))
      .reduce((s, e) => s + (Number(field === "approved_amount" ? e.approved_amount ?? e.requested_amount : e.requested_amount) || 0), 0);

  const pendingTotal = sum(PENDING, "requested_amount");
  const approvedUnpaidTotal = sum(APPROVED_UNPAID, "approved_amount");
  const paidTotal = sum(["PAID"], "approved_amount");

  const currencyId = (earnings ?? [])[0]?.currency_id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Earnings</h1>
        <p className="text-sm text-muted-foreground">Approved production work you've submitted and its payment status</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Pending decision</p><p className="text-xl font-semibold text-foreground"><Money amount={pendingTotal} currencyId={currencyId} /></p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Approved, not yet paid</p><p className="text-xl font-semibold text-foreground"><Money amount={approvedUnpaidTotal} currencyId={currencyId} /></p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-semibold text-foreground"><Money amount={paidTotal} currencyId={currencyId} /></p></CardContent></Card>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !earnings || earnings.length === 0 ? (
          <EmptyState icon={Wallet} title="No submitted work yet" description="Submit a priced task from its edit dialog to see it here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Task</TableHead><TableHead>Quantity</TableHead><TableHead>Requested</TableHead><TableHead>Approved</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {earnings.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{taskMap.get(e.task_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.approved_quantity ?? e.requested_quantity}{e.approved_quantity != null && e.approved_quantity !== e.requested_quantity ? ` (of ${e.requested_quantity})` : ""}</TableCell>
                  <TableCell><Money amount={e.requested_amount} currencyId={e.currency_id} /></TableCell>
                  <TableCell>{e.approved_amount != null ? <Money amount={e.approved_amount} currencyId={e.currency_id} /> : "—"}</TableCell>
                  <TableCell><ProductionStatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{e.submitted_at ? new Date(e.submitted_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
