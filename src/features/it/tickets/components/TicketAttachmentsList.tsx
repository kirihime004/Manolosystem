import { toast } from "sonner";
import { FileText, FileImage, FileArchive, File as FileIcon, Download } from "lucide-react";
import { getAttachmentSignedUrl } from "@/features/it/tickets/ticketApi";
import type { TicketDetail } from "@/features/it/tickets/types";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForMime(mimeType: string | null) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileArchive;
  if (mimeType.startsWith("text/") || mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
  return FileIcon;
}

export function TicketAttachmentsList({ attachments }: { attachments: TicketDetail["attachments"] }) {
  if (attachments.length === 0) return null;

  const handleOpen = async (filePath: string) => {
    try {
      const url = await getAttachmentSignedUrl(filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open attachment");
    }
  };

  return (
    <div className="space-y-1.5">
      {attachments.map((a) => {
        const Icon = iconForMime(a.mime_type);
        return (
          <button
            key={a.id}
            onClick={() => handleOpen(a.file_path)}
            className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{a.file_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatFileSize(a.file_size)}
                {a.uploader && ` · ${a.uploader.first_name ?? ""} ${a.uploader.last_name ?? ""}`.trim()}
              </p>
            </div>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}
