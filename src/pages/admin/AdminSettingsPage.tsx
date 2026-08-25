import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminRequestCategories, useAdminRequestCategoryMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AdminSettingsPage() {
  const { company } = useCompany();
  const { data: categories, isLoading } = useAdminRequestCategories(company?.id);
  const { create, update } = useAdminRequestCategoryMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, name, sortOrder: (categories?.length ?? 0) + 1 });
      toast.success("Category created");
      setOpen(false); setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Administration Settings</h1>
        <p className="text-sm text-muted-foreground">Request categories</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Request Categories</h2>
        <Can permission={PERMISSIONS.ADMIN_CATEGORIES_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm">+ New category</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>
              {(categories ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_CATEGORIES_MANAGE} fallback={<span className="text-muted-foreground">{c.is_active ? "Yes" : "No"}</span>}>
                      <Switch checked={c.is_active} onCheckedChange={(checked) => update.mutate({ id: c.id, patch: { isActive: checked } })} />
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
