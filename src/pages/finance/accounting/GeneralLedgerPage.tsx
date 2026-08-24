import { useState } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useGeneralLedger, useChartOfAccounts } from "@/features/finance/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ScrollText } from "lucide-react";

const PAGE_SIZE = 50;

export default function GeneralLedgerPage() {
  const { company } = useCompany();
  const { data: accounts } = useChartOfAccounts(company?.id);
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const filters = { accountId: accountId || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, isLoading } = useGeneralLedger(company?.id, filters, page, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">General Ledger</h1>
        <p className="text-sm text-muted-foreground">{data?.count ?? 0} posted lines</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Account</Label>
          <Select value={accountId || "ALL"} onValueChange={(v) => { setAccountId(v === "ALL" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All accounts</SelectItem>
              {(accounts ?? []).filter((a) => !a.is_header).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} /></div>
        <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} /></div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No ledger entries for these filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Journal #</TableHead><TableHead>Account</TableHead>
                    <TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead>
                    <TableHead>Balance</TableHead><TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.line_id}>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell>{r.journal_number}</TableCell>
                      <TableCell>{r.account_code} {r.account_name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{r.description}</TableCell>
                      <TableCell>{r.debit > 0 && <Money amount={r.debit} currencyId={r.base_currency_id} />}</TableCell>
                      <TableCell>{r.credit > 0 && <Money amount={r.credit} currencyId={r.base_currency_id} />}</TableCell>
                      <TableCell className="font-medium"><Money amount={r.balance} currencyId={r.base_currency_id} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.reference_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-border p-3">
              <p className="text-xs text-muted-foreground">Page {page + 1} of {Math.max(1, Math.ceil(data.count / PAGE_SIZE))}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= data.count} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
