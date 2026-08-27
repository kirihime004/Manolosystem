import { Link, useParams } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgetsPendingFinance } from "@/features/it/procurement/hooks";
import { useCompanyUsersList } from "@/features/company/settings/useCompanyUsers";
import { BUDGET_MODULE_CONFIG } from "@/features/it/procurement/budgetModuleConfig";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { BudgetStatusBadge } from "@/components/shared/ProcurementBadges";

export default function FinanceBudgetReviewListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: budgets, isLoading } = useBudgetsPendingFinance(company?.id);
  const { data: users } = useCompanyUsersList(company?.id);
  const ownerName = (userId: string | null) => {
    if (!userId) return "—";
    const u = users?.find((u) => u.userId === userId);
    if (!u) return "—";
    return u.profile ? `${u.profile.first_name} ${u.profile.last_name}`.trim() : u.email ?? "—";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Budget Approvals</h1>
        <p className="text-sm text-muted-foreground">Department budgets awaiting Finance review, across every department</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !budgets || budgets.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing waiting on Finance" description="Every submitted department budget has been decided." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead><TableHead>Budget</TableHead><TableHead>Fiscal Year</TableHead>
                <TableHead>Requested</TableHead><TableHead>Owner</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/budgets/review/${b.id}`)}>
                  <TableCell className="text-muted-foreground">{BUDGET_MODULE_CONFIG[b.module_key].label}</TableCell>
                  <TableCell><Link to={`/c/${companySlug}/finance/budgets/review/${b.id}`} className="font-medium text-foreground hover:underline">{b.budget_name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{b.fiscal_year}</TableCell>
                  <TableCell>{b.total_requested != null ? <Money amount={b.total_requested} currencyId={b.currency_id} /> : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{ownerName(b.owner_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{b.submitted_at ? new Date(b.submitted_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><BudgetStatusBadge status={b.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
