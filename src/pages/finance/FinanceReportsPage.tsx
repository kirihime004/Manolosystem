import { useState } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProfitAndLoss, useBalanceSheet, useCashFlow, useTaxSummary } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/shared/Money";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";

function monthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

export default function FinanceReportsPage() {
  const { company } = useCompany();
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const [{ start, end }, setRange] = useState(monthRange);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: pnl } = useProfitAndLoss(company?.id, start, end);
  const { data: balanceSheet } = useBalanceSheet(company?.id, asOfDate);
  const { data: cashFlow } = useCashFlow(company?.id, start, end);
  const { data: taxSummary } = useTaxSummary(company?.id, start, end);

  const baseCurrencyId = currencySettings?.base_currency_id;
  const revenue = (pnl ?? []).filter((r) => r.account_type === "REVENUE").reduce((s, r) => s + r.amount, 0);
  const cogs = (pnl ?? []).filter((r) => r.account_type === "COGS").reduce((s, r) => s + r.amount, 0);
  const opex = (pnl ?? []).filter((r) => r.account_type === "EXPENSE").reduce((s, r) => s + r.amount, 0);
  const grossProfit = revenue - cogs;
  const netIncome = grossProfit - opex;

  const assets = (balanceSheet ?? []).filter((r) => r.account_type === "ASSET").reduce((s, r) => s + r.amount, 0);
  const liabilities = (balanceSheet ?? []).filter((r) => r.account_type === "LIABILITY").reduce((s, r) => s + r.amount, 0);
  const equity = (balanceSheet ?? []).filter((r) => r.account_type === "EQUITY").reduce((s, r) => s + r.amount, 0);
  const balanced = Math.abs(assets - (liabilities + equity)) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Financial statements in the company base currency.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} /></div>
        </div>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="tax">Tax Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profit & Loss</CardTitle><CardDescription>{start} to {end}</CardDescription></CardHeader>
            <CardContent>
              {!pnl || pnl.length === 0 ? <EmptyState icon={BarChart3} title="No activity in this range" /> : (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pnl.map((r) => (
                        <TableRow key={r.account_code}>
                          <TableCell>{r.account_code} {r.account_name}</TableCell>
                          <TableCell><Money amount={r.amount} currencyId={baseCurrencyId} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><Money amount={revenue} currencyId={baseCurrencyId} /></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">COGS</span><Money amount={cogs} currencyId={baseCurrencyId} /></div>
                    <div className="flex justify-between font-medium"><span>Gross Profit</span><Money amount={grossProfit} currencyId={baseCurrencyId} /></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Operating Expenses</span><Money amount={opex} currencyId={baseCurrencyId} /></div>
                    <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground"><span>Net Income</span><Money amount={netIncome} currencyId={baseCurrencyId} /></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet" className="space-y-4 pt-4">
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">As of</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} /></div>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Balance Sheet</CardTitle><CardDescription>As of {asOfDate}</CardDescription></CardHeader>
            <CardContent>
              {!balanceSheet || balanceSheet.length === 0 ? <EmptyState icon={BarChart3} title="No posted activity yet" /> : (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {balanceSheet.map((r) => (
                        <TableRow key={r.account_code}>
                          <TableCell>{r.account_code} {r.account_name}</TableCell>
                          <TableCell><Money amount={r.amount} currencyId={baseCurrencyId} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow><TableCell className="font-semibold">Assets</TableCell><TableCell className="font-semibold"><Money amount={assets} currencyId={baseCurrencyId} /></TableCell></TableRow>
                      <TableRow><TableCell className="font-semibold">Liabilities + Equity</TableCell><TableCell className="font-semibold"><Money amount={liabilities + equity} currencyId={baseCurrencyId} /></TableCell></TableRow>
                    </TableFooter>
                  </Table>
                  {!balanced && (
                    <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400">
                      FINANCIAL INTEGRITY ERROR: Assets do not equal Liabilities + Equity.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cash Flow</CardTitle><CardDescription>{start} to {end}</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cashFlow && (
                <>
                  <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Beginning Cash</span><Money amount={cashFlow.beginning_cash} currencyId={baseCurrencyId} /></div>
                  <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Cash Inflows</span><Money amount={cashFlow.cash_inflows} currencyId={baseCurrencyId} /></div>
                  <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Cash Outflows</span><Money amount={cashFlow.cash_outflows} currencyId={baseCurrencyId} /></div>
                  <div className="flex justify-between border-b border-border pb-2 font-medium"><span>Net Cash Flow</span><Money amount={cashFlow.net_cash_flow} currencyId={baseCurrencyId} /></div>
                  <div className="flex justify-between pt-1 font-semibold text-foreground"><span>Ending Cash</span><Money amount={cashFlow.ending_cash} currencyId={baseCurrencyId} /></div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Tax Summary</CardTitle><CardDescription>{start} to {end}</CardDescription></CardHeader>
            <CardContent>
              {!taxSummary || taxSummary.length === 0 ? <EmptyState icon={BarChart3} title="No tax activity in this range" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Tax Type</TableHead><TableHead>Direction</TableHead><TableHead>Base Amount</TableHead><TableHead>Tax Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {taxSummary.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.tax_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{r.direction}</TableCell>
                        <TableCell><Money amount={r.base_amount} currencyId={baseCurrencyId} /></TableCell>
                        <TableCell><Money amount={r.tax_amount} currencyId={baseCurrencyId} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
