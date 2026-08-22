import { useState } from "react";
import { Receipt, Search } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllBudgetTransactions } from "@/features/it/procurement/hooks";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import type { BudgetTransactionType } from "@/types/database";

const TYPES: BudgetTransactionType[] = ["ALLOCATION", "COMMITMENT", "RELEASE", "EXPENSE", "ADJUSTMENT", "REFUND"];

export default function BudgetTransactionsPage() {
  const { company } = useCompany();
  const { data: transactions, isLoading } = useAllBudgetTransactions(company?.id);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const filtered = (transactions ?? []).filter((t) => {
    if (type !== "all" && t.transaction_type !== type) return false;
    if (search && !(t.description ?? "").toLowerCase().includes(search.toLowerCase()) && !(t.budget?.budget_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Budget Transactions</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} transactions across all budgets</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search description, budget…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Budget</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{t.budget?.budget_name ?? "—"}</TableCell>
                  <TableCell>{t.transaction_type}</TableCell>
                  <TableCell><Money amount={t.amount * t.adjustment_sign} currencyId={t.currency_id} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.reference_type ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
