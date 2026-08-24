import { useState, useEffect } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useFinancialPeriods, useTrialBalance } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { Scale } from "lucide-react";

export default function TrialBalancePage() {
  const { company } = useCompany();
  const { data: periods } = useFinancialPeriods(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const [periodId, setPeriodId] = useState("");

  useEffect(() => {
    if (periods && periods.length > 0 && !periodId) {
      const open = periods.find((p) => p.status === "OPEN") ?? periods[0];
      setPeriodId(open.id);
    }
  }, [periods, periodId]);

  const { data: rows, isLoading } = useTrialBalance(company?.id, periodId || undefined);
  const baseCurrencyId = currencySettings?.base_currency_id;

  const totalDebit = (rows ?? []).reduce((s, r) => s + r.closing_debit, 0);
  const totalCredit = (rows ?? []).reduce((s, r) => s + r.closing_credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trial Balance</h1>
          <p className="text-sm text-muted-foreground">Opening, period activity, and closing balance per account.</p>
        </div>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select period" /></SelectTrigger>
          <SelectContent>{(periods ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!periodId ? (
        <EmptyState icon={Scale} title="No financial periods yet" description="Set up a fiscal year and periods from Finance Settings." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !rows || rows.length === 0 ? (
            <EmptyState icon={Scale} title="No activity in this period yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Opening Debit</TableHead><TableHead>Opening Credit</TableHead>
                  <TableHead>Period Debit</TableHead><TableHead>Period Credit</TableHead>
                  <TableHead>Closing Debit</TableHead><TableHead>Closing Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.account_id}>
                    <TableCell>{r.account_code} {r.account_name}</TableCell>
                    <TableCell>{r.opening_debit > 0 && <Money amount={r.opening_debit} currencyId={baseCurrencyId} />}</TableCell>
                    <TableCell>{r.opening_credit > 0 && <Money amount={r.opening_credit} currencyId={baseCurrencyId} />}</TableCell>
                    <TableCell>{r.period_debit > 0 && <Money amount={r.period_debit} currencyId={baseCurrencyId} />}</TableCell>
                    <TableCell>{r.period_credit > 0 && <Money amount={r.period_credit} currencyId={baseCurrencyId} />}</TableCell>
                    <TableCell className="font-medium">{r.closing_debit > 0 && <Money amount={r.closing_debit} currencyId={baseCurrencyId} />}</TableCell>
                    <TableCell className="font-medium">{r.closing_credit > 0 && <Money amount={r.closing_credit} currencyId={baseCurrencyId} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className="font-semibold"><Money amount={totalDebit} currencyId={baseCurrencyId} /></TableCell>
                  <TableCell className="font-semibold"><Money amount={totalCredit} currencyId={baseCurrencyId} /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          {rows && rows.length > 0 && !balanced && (
            <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              Totals do not balance -- this indicates a data integrity issue and should be investigated.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
