import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Wallet, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgets, useBudgetMutations, useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { BUDGET_MODULE_CONFIG } from "@/features/it/procurement/budgetModuleConfig";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { BudgetStatusBadge } from "@/components/shared/ProcurementBadges";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Can } from "@/lib/permissions/Can";
import type { BudgetModuleKey } from "@/types/database";

export default function BudgetsListPage({ moduleKey = "IT" }: { moduleKey?: BudgetModuleKey }) {
  const config = BUDGET_MODULE_CONFIG[moduleKey];
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: budgets, isLoading } = useBudgets(company?.id, moduleKey);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { create } = useBudgetMutations();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [currencyId, setCurrencyId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (currencySettings?.base_currency_id && !currencyId) setCurrencyId(currencySettings.base_currency_id);
  }, [currencySettings, currencyId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const budget = await create.mutateAsync({
        companyId: company.id,
        moduleKey,
        budgetName: name.trim(),
        fiscalYear: Number(fiscalYear),
        startDate,
        endDate,
        currencyId: currencyId || currencySettings!.base_currency_id,
        description: description || null,
      });
      toast.success(`${budget.budget_name} created as a draft — add line items, then submit for Finance approval`);
      setOpen(false);
      setName(""); setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create budget");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{config.label} Budgets</h1>
          <p className="text-sm text-muted-foreground">{budgets?.length ?? 0} budgets</p>
        </div>
        <Can permission={config.createPermission}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New budget</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New {config.label.toLowerCase()} budget</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5"><Label>Budget name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. 2026 ${config.label} Budget`} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Fiscal year</Label><Input type="number" required value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <CurrencySelect value={currencyId || currencySettings?.base_currency_id || ""} onChange={setCurrencyId} />
                </div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <p className="text-xs text-muted-foreground">
                  Starts as a draft with no total — add line items on the budget's detail page, then submit it for Finance approval.
                </p>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create budget"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !budgets || budgets.length === 0 ? (
          <EmptyState icon={Wallet} title="No budgets yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget</TableHead>
                <TableHead>Fiscal Year</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Committed</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/${config.basePath}/budgets/${b.id}`)}>
                  <TableCell><Link to={`/c/${companySlug}/${config.basePath}/budgets/${b.id}`} className="font-medium text-foreground hover:underline">{b.budget_name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{b.fiscal_year}</TableCell>
                  <TableCell className="text-muted-foreground">{b.total_requested != null ? <Money amount={b.total_requested} currencyId={b.currency_id} /> : "—"}</TableCell>
                  <TableCell><Money amount={b.total_approved ?? b.total_budget} currencyId={b.currency_id} /></TableCell>
                  <TableCell className="text-muted-foreground"><Money amount={b.committed} currencyId={b.currency_id} /></TableCell>
                  <TableCell className="text-muted-foreground"><Money amount={b.spent} currencyId={b.currency_id} /></TableCell>
                  <TableCell className="font-medium"><Money amount={b.available} currencyId={b.currency_id} /></TableCell>
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
