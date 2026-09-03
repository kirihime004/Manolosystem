import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminDocuments, useAdminDocumentMutations } from "@/features/admin/hooks";
import { getAdminDocumentUrl } from "@/features/admin/adminDocumentsApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const DOCUMENT_TYPES = [
  "CONTRACT", "PERMIT", "LICENSE", "INSURANCE", "POLICY", "REGISTRATION",
  "PASSPORT", "VISA", "FLIGHT_CONFIRMATION", "HOTEL_CONFIRMATION", "RECEIPT", "OTHER",
];

export default function AdminDocumentsPage() {
  const { company } = useCompany();
  const { data: documents, isLoading } = useAdminDocuments(company?.id);
  // Documents uploaded from this general page aren't tied to one specific
  // request/contract/asset -- those already get their own upload flow on
  // their own detail pages. "OTHER" + the company id is a real, valid
  // resource_type/resource_id pair (storage RLS just needs 3 real path
  // segments), used here as the catch-all bucket for standalone documents.
  const { upload, remove } = useAdminDocumentMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("OTHER");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await getAdminDocumentUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !file || !title.trim()) return;
    try {
      await upload.mutateAsync({
        companyId: company.id, resourceType: "OTHER", resourceId: company.id,
        documentType, title, file, issueDate: issueDate || null, expiryDate: expiryDate || null,
      });
      toast.success("Document uploaded");
      setOpen(false); setTitle(""); setDocumentType("OTHER"); setIssueDate(""); setExpiryDate(""); setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    try {
      await remove.mutateAsync({ id, storagePath });
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">Contracts, permits, licenses, and other administrative documents</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_DOCUMENTS_UPLOAD}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Upload document</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-3">
                <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Issue date (optional)</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Expiry date (optional)</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>File</Label><Input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
                <DialogFooter><Button type="submit" disabled={upload.isPending || !file || !title.trim()}>{upload.isPending ? "Uploading…" : "Upload"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !documents || documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Documents uploaded against requests, contracts, and compliance records will appear here." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Resource</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-muted-foreground">{d.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.resource_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.expiry_date ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={d.status} /></TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpen(d.storage_path)}>Open</Button>
                    <Can permission={PERMISSIONS.ADMIN_DOCUMENTS_DELETE}>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id, d.storage_path)} disabled={remove.isPending}>Delete</Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
