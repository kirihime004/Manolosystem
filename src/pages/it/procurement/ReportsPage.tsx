import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgets, useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { usePurchaseOrders } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { PurchaseOrderStatusBadge } from "@/components/shared/ProcurementBadges";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const { company } = useCompany();
  const { data: budgets } = useBudgets(company?.id);
  const { data: orders } = usePurchaseOrders(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);

  const supplierTotals = new Map<string, { name: string; count: number; total: number }>();
  for (const po of orders ?? []) {
    if (po.status === "CANCELLED" || !po.supplier) continue;
    const key = po.supplier.id;
    const existing = supplierTotals.get(key) ?? { name: po.supplier.name, count: 0, total: 0 };
    existing.count += 1;
    existing.total += po.base_currency_total ?? po.total;
    supplierTotals.set(key, existing);
  }
  const supplierRows = [...supplierTotals.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Budget and procurement reporting for {company?.name}, in {currencySettings ? "the company base currency" : "each budget's own currency"}.</p>
      </div>

      <Tabs defaultValue="budget-vs-actual">
        <TabsList>
          <TabsTrigger value="budget-vs-actual">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="supplier-spending">Supplier Spending</TabsTrigger>
          <TabsTrigger value="currency">By Currency</TabsTrigger>
        </TabsList>

        <TabsContent value="budget-vs-actual" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget vs Actual</CardTitle>
              <CardDescription>Every budget's committed and spent amounts against its total.</CardDescription>
            </CardHeader>
            <CardContent>
              {!budgets || budgets.length === 0 ? (
                <EmptyState icon={BarChart3} title="No budgets yet" />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Budget</TableHead><TableHead>Total</TableHead><TableHead>Committed</TableHead><TableHead>Spent</TableHead><TableHead>Available</TableHead><TableHead>% Used</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {budgets.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.budget_name}</TableCell>
                        <TableCell><Money amount={b.total_budget} currencyId={b.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground"><Money amount={b.committed} currencyId={b.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground"><Money amount={b.spent} currencyId={b.currency_id} /></TableCell>
                        <TableCell className="font-medium"><Money amount={b.available} currencyId={b.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground">{b.total_budget > 0 ? Math.round(((b.committed + b.spent) / b.total_budget) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier-spending" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier Spending</CardTitle>
              <CardDescription>Total procurement value per supplier, in each purchase order's base-currency amount.</CardDescription>
            </CardHeader>
            <CardContent>
              {supplierRows.length === 0 ? (
                <EmptyState icon={BarChart3} title="No procurement spending yet" />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Orders</TableHead><TableHead>Total Spent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {supplierRows.map((s) => (
                      <TableRow key={s.name}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.count}</TableCell>
                        <TableCell><Money amount={s.total} currencyId={currencySettings?.base_currency_id} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Procurement by Currency</CardTitle>
              <CardDescription>Original transaction currency alongside the company base-currency equivalent.</CardDescription>
            </CardHeader>
            <CardContent>
              {!orders || orders.length === 0 ? (
                <EmptyState icon={BarChart3} title="No purchase orders yet" />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Original</TableHead><TableHead>Rate</TableHead><TableHead>Base Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orders.filter((po) => po.status !== "CANCELLED").map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                        <TableCell className="text-muted-foreground">{po.supplier?.name ?? "—"}</TableCell>
                        <TableCell><Money amount={po.total} currencyId={po.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground">{po.exchange_rate ?? "—"}</TableCell>
                        <TableCell className="font-medium">{po.base_currency_total != null ? <Money amount={po.base_currency_total} currencyId={po.base_currency_id} /> : "—"}</TableCell>
                        <TableCell><PurchaseOrderStatusBadge status={po.status} /></TableCell>
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
