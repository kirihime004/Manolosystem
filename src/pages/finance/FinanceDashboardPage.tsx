import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCashAccounts, useApAging, useArAging, useProfitAndLoss, usePayrollRuns } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Money } from "@/components/shared/Money";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default function FinanceDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { data: cashAccounts } = useCashAccounts(company?.id);
  const { data: apAging } = useApAging(company?.id);
  const { data: arAging } = useArAging(company?.id);
  const { data: payrollRuns } = usePayrollRuns(company?.id);
  const { start, end } = useMemo(monthRange, []);
  const { data: pnl } = useProfitAndLoss(company?.id, start, end);

  const baseCurrencyId = currencySettings?.base_currency_id;
  const cashBalance = (cashAccounts ?? []).reduce((sum, a) => sum + a.current_balance, 0);
  const arOutstanding = (arAging ?? []).reduce((sum, r) => sum + r.outstanding, 0);
  const apOutstanding = (apAging ?? []).reduce((sum, r) => sum + r.outstanding, 0);
  const revenue = (pnl ?? []).filter((r) => r.account_type === "REVENUE").reduce((s, r) => s + r.amount, 0);
  const cogs = (pnl ?? []).filter((r) => r.account_type === "COGS").reduce((s, r) => s + r.amount, 0);
  const expenses = (pnl ?? []).filter((r) => r.account_type === "EXPENSE").reduce((s, r) => s + r.amount, 0);
  const netIncome = revenue - cogs - expenses;
  const payrollCost = (payrollRuns ?? [])
    .filter((r) => r.status === "APPROVED" || r.status === "PAID")
    .reduce((s, r) => s + r.total_gross_pay, 0);

  const cards: { label: string; value: React.ReactNode; href?: string }[] = [
    { label: "Cash Balance", value: <Money amount={cashBalance} currencyId={baseCurrencyId} />, href: `/c/${companySlug}/finance/cash-bank` },
    { label: "Accounts Receivable", value: <Money amount={arOutstanding} currencyId={baseCurrencyId} />, href: `/c/${companySlug}/finance/ar/invoices` },
    { label: "Accounts Payable", value: <Money amount={apOutstanding} currencyId={baseCurrencyId} />, href: `/c/${companySlug}/finance/ap/bills` },
    { label: "Outstanding Invoices", value: (arAging ?? []).length, href: `/c/${companySlug}/finance/ar/invoices` },
    { label: "Outstanding Bills", value: (apAging ?? []).length, href: `/c/${companySlug}/finance/ap/bills` },
    { label: "Monthly Revenue", value: <Money amount={revenue} currencyId={baseCurrencyId} /> },
    { label: "Monthly Expenses", value: <Money amount={cogs + expenses} currencyId={baseCurrencyId} /> },
    { label: "Net Income (MTD)", value: <Money amount={netIncome} currencyId={baseCurrencyId} /> },
    { label: "Payroll Cost", value: <Money amount={payrollCost} currencyId={baseCurrencyId} />, href: `/c/${companySlug}/finance/payroll` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Finance</h1>
        <p className="text-sm text-muted-foreground">Financial overview for {company?.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const inner = (
            <Card className={c.href ? "transition-colors hover:border-primary/50" : undefined}>
              <CardHeader className="pb-2">
                <CardDescription>{c.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">{c.value}</div>
              </CardContent>
            </Card>
          );
          return c.href ? <Link key={c.label} to={c.href}>{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue vs Expenses (this month)</CardTitle>
          <CardDescription>From posted journal entries in the company base currency.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Revenue</span>
            <Money amount={revenue} currencyId={baseCurrencyId} />
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Cost of Goods Sold</span>
            <Money amount={cogs} currencyId={baseCurrencyId} />
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Operating Expenses</span>
            <Money amount={expenses} currencyId={baseCurrencyId} />
          </div>
          <div className="flex items-center justify-between pt-1 font-semibold text-foreground">
            <span>Net Income</span>
            <Money amount={netIncome} currencyId={baseCurrencyId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
