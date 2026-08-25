import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminDocuments } from "@/features/admin/hooks";
import { getAdminDocumentUrl } from "@/features/admin/adminDocumentsApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";

export default function AdminDocumentsPage() {
  const { company } = useCompany();
  const { data: documents, isLoading } = useAdminDocuments(company?.id);

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await getAdminDocumentUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">Contracts, permits, licenses, and other administrative documents</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !documents || documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Documents uploaded against requests, contracts, and compliance records will appear here." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Resource</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-muted-foreground">{d.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.resource_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.expiry_date ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={d.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleOpen(d.storage_path)}>Open</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
