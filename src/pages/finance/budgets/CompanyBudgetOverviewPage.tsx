import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgets } from "@/features/it/procurement/hooks";
import { BUDGET_MODULE_CONFIG } from "@/features/it/procurement/budgetModuleConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import type { BudgetModuleKey, BudgetSummary } from "@/types/database";

const MODULES: BudgetModuleKey[] = ["IT", "HR", "FINANCE", "ADMIN", "PRODUCTION"];

function DepartmentCard({ moduleKey, budgets, currencyId }: { moduleKey: BudgetModuleKey; budgets: BudgetSummary[]; currencyId: string | null }) {
  const config = BUDGET_MODULE_CONFIG[moduleKey];
  const active = budgets.filter((b) => b.status === "APPROVED" || b.status === "ACTIVE");
  const totals = active.reduce(
    (acc, b) => ({
      approved: acc.approved + (b.total_approved ?? b.total_budget),
      committed: acc.committed + b.committed,
      spent: acc.spent + b.spent,
      available: acc.available + b.available,
    }),
    { approved: 0, committed: 0, spent: 0, available: 0 },
  );
  const pending = budgets.filter((b) => b.status === "SUBMITTED_TO_FINANCE" || b.status === "FINANCE_REVIEW").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{config.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Approved</span><span className="font-semibold">{currencyId ? <Money amount={totals.approved} currencyId={currencyId} /> : totals.approved}</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Committed</span><span>{currencyId ? <Money amount={totals.committed} currencyId={currencyId} /> : totals.committed}</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Spent</span><span>{currencyId ? <Money amount={totals.spent} currencyId={currencyId} /> : totals.spent}</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-emerald-600">Available</span><span className="font-semibold text-emerald-600">{currencyId ? <Money amount={totals.available} currencyId={currencyId} /> : totals.available}</span></div>
        {pending > 0 && <p className="pt-1 text-xs text-amber-600">{pending} awaiting Finance approval</p>}
      </CardContent>
    </Card>
  );
}

export default function CompanyBudgetOverviewPage() {
  const { company } = useCompany();
  const { data: budgets, isLoading } = useBudgets(company?.id);

  const total = (budgets ?? [])
    .filter((b) => b.status === "APPROVED" || b.status === "ACTIVE")
    .reduce((sum, b) => sum + (b.total_approved ?? b.total_budget), 0);
  const currencyId = budgets?.[0]?.currency_id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Company Budget Overview</h1>
        <p className="text-sm text-muted-foreground">
          Every department's approved budget, side by side — {currencyId ? <Money amount={total} currencyId={currencyId} /> : total} approved company-wide
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {MODULES.map((m) => (
            <DepartmentCard key={m} moduleKey={m} budgets={(budgets ?? []).filter((b) => b.module_key === m)} currencyId={currencyId} />
          ))}
        </div>
      )}
    </div>
  );
}
