import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useTicketCategories } from "@/features/it/tickets/hooks";
import * as api from "@/features/it/tickets/ticketApi";
import { AssetPicker } from "@/features/it/tickets/components/AssetPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TicketPriority } from "@/types/database";

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function CreateTicketPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: categoryData } = useTicketCategories(company?.id);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const subcategories = (categoryData?.subcategories ?? []).filter(
    (s) => s.category_id === categoryId,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !user) return;
    setSubmitting(true);

    try {
      const ticket = await api.createTicket({
        companyId: company.id,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        requesterId: user.id,
        assetId,
      });

      for (const file of files) {
        await api.uploadAttachment({
          companyId: company.id,
          ticketId: ticket.id,
          uploadedBy: user.id,
          file,
        });
      }

      toast.success(`Ticket ${ticket.ticket_number} created`);
      navigate(`/c/${companySlug}/it/tickets/${ticket.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New ticket</h1>
        <p className="text-sm text-muted-foreground">Describe the issue and we'll route it to IT.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryId("");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categoryData?.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                  <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related asset (optional)</Label>
              <AssetPicker companyId={company?.id} value={assetId} onChange={setAssetId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Steps to reproduce, error messages, affected systems…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachments">Attachments</Label>
              <label
                htmlFor="attachments"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-accent/40"
              >
                <Paperclip className="h-4 w-4" />
                Click to attach files
              </label>
              <input
                id="attachments"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-xs">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create ticket"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
