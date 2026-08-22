import { Link, useParams } from "react-router-dom";
import { Wallet, PiggyBank, Clock, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgets, useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/Money";
import { BudgetStatusBadge } from "@/components/shared/ProcurementBadges";
import { EmptyState } from "@/components/shared/EmptyState";

export default function BudgetDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: budgets, isLoading } = useBudgets(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);

  const active = budgets?.filter((b) => b.status === "ACTIVE") ?? [];
  const totals = active.reduce(
    (acc, b) => ({
      total: acc.total + b.total_budget,
      allocated: acc.allocated + b.allocated,
      committed: acc.committed + b.committed,
      spent: acc.spent + b.spent,
      available: acc.available + b.available,
    }),
    { total: 0, allocated: 0, committed: 0, spent: 0, available: 0 },
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">IT Budget</h1>
          <p className="text-sm text-muted-foreground">Company-wide IT spending overview for {company?.name}</p>
        </div>
        <Link to={`/c/${companySlug}/it/budget/budgets`}>
          <Button>Manage budgets</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : active.length === 0 ? (
        <EmptyState icon={Wallet} title="No active budgets" description="Create a budget to start tracking IT spending." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard icon={Wallet} label="Total IT Budget" amount={totals.total} currencyId={currencySettings?.base_currency_id} />
            <StatCard icon={PiggyBank} label="Allocated" amount={totals.allocated} currencyId={currencySettings?.base_currency_id} />
            <StatCard icon={Clock} label="Committed" amount={totals.committed} currencyId={currencySettings?.base_currency_id} />
            <StatCard icon={TrendingUp} label="Spent" amount={totals.spent} currencyId={currencySettings?.base_currency_id} />
            <StatCard icon={CheckCircle2} label="Available" amount={totals.available} currencyId={currencySettings?.base_currency_id} tone="success" />
            <StatCard icon={AlertTriangle} label="Active Budgets" amount={active.length} currencyId={null} />
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Active budgets</p>
            <div className="space-y-3">
              {active.map((b) => {
                const usedPct = b.total_budget > 0 ? Math.min(100, Math.round(((b.committed + b.spent) / b.total_budget) * 100)) : 0;
                return (
                  <Link key={b.id} to={`/c/${companySlug}/it/budget/budgets/${b.id}`}>
                    <Card className="transition-colors hover:border-primary/40">
                      <CardContent className="pt-6">
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{b.budget_name}</p>
                            <p className="text-xs text-muted-foreground">FY {b.fiscal_year}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <BudgetStatusBadge status={b.status} />
                            <span className="text-sm font-medium"><Money amount={b.total_budget} currencyId={b.currency_id} /></span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${usedPct >= 100 ? "bg-red-500" : usedPct >= 90 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${usedPct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{usedPct}% committed/spent</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, amount, currencyId, tone }: { icon: typeof Wallet; label: string; amount: number; currencyId: string | null | undefined; tone?: "success" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone === "success" ? "text-emerald-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{currencyId !== null ? <Money amount={amount} currencyId={currencyId} /> : amount}</p>
      </CardContent>
    </Card>
  );
}
