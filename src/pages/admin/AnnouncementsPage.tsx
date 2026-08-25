import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAnnouncements, useAnnouncementMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AnnouncementsPage() {
  const { company } = useCompany();
  const { data: announcements, isLoading } = useAnnouncements(company?.id);
  const { create, publish, retract } = useAnnouncementMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, title, content, audience: "ENTIRE_COMPANY", priority });
      toast.success("Announcement created");
      setOpen(false); setTitle(""); setContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create announcement");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">Company-wide notices</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_ANNOUNCEMENTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New announcement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Content</Label><Textarea required rows={4} value={content} onChange={(e) => setContent(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !announcements || announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Publish date</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell><AdminPriorityBadge priority={a.priority} /></TableCell>
                  <TableCell className="text-muted-foreground">{a.publish_date}</TableCell>
                  <TableCell><AdminStatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_ANNOUNCEMENTS_MANAGE}>
                      {a.status === "DRAFT" && <Button variant="ghost" size="sm" onClick={() => publish.mutate(a.id)}>Publish</Button>}
                      {a.status === "PUBLISHED" && <Button variant="ghost" size="sm" onClick={() => retract.mutate(a.id)}>Retract</Button>}
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
