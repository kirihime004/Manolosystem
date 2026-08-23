import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllEmployeeDocuments } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: documents, isLoading } = useAllEmployeeDocuments(company?.id);

  const { today, in90 } = useMemo(() => ({
    today: new Date().toISOString().slice(0, 10),
    in90: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  }), []);
  const expiringSoon = (documents ?? []).filter((d) => d.expiry_date && d.expiry_date >= today && d.expiry_date <= in90);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">{documents?.length ?? 0} documents across all employees{expiringSoon.length > 0 ? ` · ${expiringSoon.length} expiring within 90 days` : ""}</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !documents || documents.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/hr/employees/${d.employee_id}`} className="font-medium hover:underline">
                      {d.employees.first_name} {d.employees.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>{d.title}</TableCell>
                  <TableCell className="text-muted-foreground">{d.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className={d.expiry_date && d.expiry_date <= in90 && d.expiry_date >= today ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {d.expiry_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
