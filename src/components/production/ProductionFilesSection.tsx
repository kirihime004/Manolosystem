import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, Download } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useProductionFiles, useProductionFileMutations } from "@/features/production/hooks";
import { getProductionFileUrl } from "@/features/production/productionDeliverablesApi";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionFile } from "@/types/database";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Reusable across any resource that can carry attachments (a shot, an
// asset, a project, a version, a deliverable) -- mirrors the file
// upload/list/delete pattern already established by the HR employee
// documents tab (EmployeeDetailPage.tsx's DocumentsTab), backed by the
// production-files storage bucket + production_files table.
export function ProductionFilesSection({ resourceType, resourceId }: { resourceType: ProductionFile["resource_type"]; resourceId: string }) {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: files, isLoading } = useProductionFiles(resourceType, resourceId);
  const { upload, remove } = useProductionFileMutations(resourceType, resourceId);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !file || !user) return;
    try {
      await upload.mutateAsync({ companyId: company.id, resourceType, resourceId, file, uploadedBy: user.id });
      toast.success("File uploaded");
      setOpen(false);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    }
  };

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await getProductionFileUrl(storagePath);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open file");
    }
  };

  const handleDelete = async (f: ProductionFile) => {
    try {
      await remove.mutateAsync({ id: f.id, storagePath: f.storage_path });
      toast.success("File removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove file");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Files</h3>
        <Can permission={PERMISSIONS.PRODUCTION_FILES_UPLOAD}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm">+ Upload file</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload a file</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-3">
                <div className="space-y-1.5"><Label>File</Label><Input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
                <DialogFooter><Button type="submit" disabled={upload.isPending || !file}>{upload.isPending ? "Uploading…" : "Upload"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !files || files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <button type="button" onClick={() => handleOpen(f.storage_path)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{f.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.file_size)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => handleOpen(f.storage_path)} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Can permission={PERMISSIONS.PRODUCTION_FILES_DELETE}>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => handleDelete(f)} disabled={remove.isPending} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Can>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
