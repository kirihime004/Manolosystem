import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Paperclip, Send, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { useCompany } from "@/lib/tenant/useCompany";
import { useTicketMutations } from "@/features/it/tickets/hooks";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TicketDetail } from "@/features/it/tickets/types";

function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketConversation({ ticket }: { ticket: TicketDetail }) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { comment, upload } = useTicketMutations(ticket.id);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !user || !body.trim()) return;
    setSubmitting(true);

    try {
      await comment.mutateAsync({ companyId: company.id, authorId: user.id, body: body.trim() });
      if (file) {
        await upload.mutateAsync({ companyId: company.id, uploadedBy: user.id, file });
        setFile(null);
      }
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {ticket.comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation below." />
      ) : (
        <div className="space-y-5">
          {ticket.comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {initials(c.author?.first_name, c.author?.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {c.author ? `${c.author.first_name ?? ""} ${c.author.last_name ?? ""}`.trim() : "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatTime(c.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Can permission={PERMISSIONS.IT_TICKETS_COMMENT}>
        <form onSubmit={handleSubmit} className="space-y-2 border-t border-border pt-4">
          <Textarea
            placeholder="Write a comment…"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {file ? file.name : "Attach file"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      </Can>
    </div>
  );
}
