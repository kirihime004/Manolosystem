import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useConversations, useConversationMutations, useMessages, useSendMessage } from "@/features/ai/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { AiConversation, AiMessage } from "@/types/database";

function SourcesPanel({ message }: { message: AiMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.tool_calls || message.tool_calls.length === 0) return null;
  return (
    <div className="mt-2">
      <button className="text-xs font-medium text-muted-foreground underline underline-offset-2" onClick={() => setOpen(!open)}>
        {open ? "Hide sources" : `Sources (${message.tool_calls.length})`}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-md border border-border bg-muted/30 p-2">
          {message.tool_calls.map((tc, i) => (
            <div key={i} className="text-xs">
              <p className="font-mono font-semibold text-foreground">{tc.tool}</p>
              <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">{JSON.stringify(tc.result, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AiAssistantPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: conversations, isLoading: conversationsLoading } = useConversations(company?.id);
  const conversationMutations = useConversationMutations(company?.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: messages, isLoading: messagesLoading } = useMessages(activeId ?? undefined);
  const sendMessage = useSendMessage(activeId ?? undefined);

  const [draft, setDraft] = useState(searchParams.get("ask") ?? "");
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null);

  useEffect(() => {
    if (!activeId && conversations && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const handleNewConversation = async () => {
    if (!user) return;
    try {
      const conversation = await conversationMutations.create.mutateAsync(user.id);
      setActiveId(conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create conversation");
    }
  };

  useEffect(() => {
    if (conversations && conversations.length === 0 && !conversationsLoading) {
      handleNewConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, conversationsLoading]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || !activeId || !company) return;
    const text = draft;
    setDraft("");
    if (searchParams.has("ask")) setSearchParams({}, { replace: true });
    try {
      await sendMessage.mutateAsync({ companyId: company.id, message: text });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      setDraft(text);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await conversationMutations.remove.mutateAsync(deleteTarget.id);
      if (activeId === deleteTarget.id) setActiveId(null);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-56 shrink-0 space-y-2 overflow-y-auto border-r border-border pr-3">
        <Button size="sm" className="w-full justify-start gap-1.5" onClick={handleNewConversation}>
          <Plus className="h-4 w-4" /> New chat
        </Button>
        {(conversations ?? []).map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer",
              activeId === c.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => setActiveId(c.id)}
          >
            <span className="truncate">{c.title}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messagesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !messages || messages.length === 0 ? (
            <EmptyState icon={Sparkles} title="Ask the AI Assistant" description="Try: “What is happening with production?” or “Which IT assets need replacement?”" />
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "USER" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === "ASSISTANT" && <SourcesPanel message={m} />}
              </div>
            ))
          )}
          {sendMessage.isPending && <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>}
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about IT, HR, Finance, Admin, or Production…"
            rows={2}
            disabled={!activeId || sendMessage.isPending}
          />
          <Button type="submit" disabled={!draft.trim() || !activeId || sendMessage.isPending}>Send</Button>
        </form>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
