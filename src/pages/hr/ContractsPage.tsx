import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllContracts, useEmployees } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractStatusBadge } from "@/components/shared/HrBadges";

export default function ContractsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: contracts, isLoading } = useAllContracts(company?.id);
  const { data: employees } = useEmployees(company?.id);

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Contracts</h1>
        <p className="text-sm text-muted-foreground">{contracts?.length ?? 0} employment contracts</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !contracts || contracts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                  <TableCell>
                    <Link to={`/c/${companySlug}/hr/employees/${c.employee_id}`} className="font-medium hover:underline">
                      {empMap.get(c.employee_id) ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.contract_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{c.start_date} → {c.end_date ?? "—"}</TableCell>
                  <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
