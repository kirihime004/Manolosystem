import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FolderTree, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useBudgetCategories, useBudgetMutations } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function BudgetCategoriesPage() {
  const { company } = useCompany();
  const { data: categories, isLoading } = useBudgetCategories(company?.id);
  const { createCategory } = useBudgetMutations();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await createCategory.mutateAsync({ companyId: company.id, name: name.trim(), description: description || null });
      toast.success("Category created");
      setOpen(false);
      setName(""); setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Budget Categories</h1>
          <p className="text-sm text-muted-foreground">{categories?.length ?? 0} categories</p>
        </div>
        <Can permission={PERMISSIONS.IT_BUDGET_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New category</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New budget category</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={createCategory.isPending}>{createCategory.isPending ? "Creating…" : "Create category"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !categories || categories.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell><Badge variant={c.is_system ? "secondary" : "outline"}>{c.is_system ? "Default" : "Custom"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
