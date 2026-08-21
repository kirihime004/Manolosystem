import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FolderTree, MoreHorizontal, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useTicketCategories } from "@/features/it/tickets/hooks";
import { useCategoryMutations } from "@/features/it/categories/useCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TicketCategory, TicketSubcategory } from "@/types/database";

type DialogState =
  | { kind: "new-category" }
  | { kind: "edit-category"; category: TicketCategory }
  | { kind: "new-subcategory"; categoryId: string }
  | { kind: "edit-subcategory"; subcategory: TicketSubcategory }
  | null;

type DeleteState =
  | { kind: "category"; item: TicketCategory }
  | { kind: "subcategory"; item: TicketSubcategory }
  | null;

export default function CategoriesPage() {
  const { company } = useCompany();
  const { data, isLoading } = useTicketCategories(company?.id);
  const mutations = useCategoryMutations(company?.id);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [nameInput, setNameInput] = useState("");

  const openDialog = (state: DialogState) => {
    setDialog(state);
    if (state?.kind === "edit-category") setNameInput(state.category.name);
    else if (state?.kind === "edit-subcategory") setNameInput(state.subcategory.name);
    else setNameInput("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    try {
      switch (dialog.kind) {
        case "new-category":
          await mutations.createCategory.mutateAsync(nameInput.trim());
          toast.success("Category created");
          break;
        case "edit-category":
          await mutations.updateCategory.mutateAsync({ id: dialog.category.id, name: nameInput.trim() });
          toast.success("Category updated");
          break;
        case "new-subcategory":
          await mutations.createSubcategory.mutateAsync({ categoryId: dialog.categoryId, name: nameInput.trim() });
          toast.success("Subcategory created");
          break;
        case "edit-subcategory":
          await mutations.updateSubcategory.mutateAsync({ id: dialog.subcategory.id, name: nameInput.trim() });
          toast.success("Subcategory updated");
          break;
      }
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!deleteState) return;
    try {
      if (deleteState.kind === "category") {
        await mutations.deleteCategory.mutateAsync(deleteState.item.id);
        toast.success("Category deleted");
      } else {
        await mutations.deleteSubcategory.mutateAsync(deleteState.item.id);
        toast.success("Subcategory deleted");
      }
      setDeleteState(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const dialogTitle = {
    "new-category": "New category",
    "edit-category": "Edit category",
    "new-subcategory": "New subcategory",
    "edit-subcategory": "Edit subcategory",
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ticket categories</h1>
          <p className="text-sm text-muted-foreground">
            Configure the categories and subcategories requesters can select when creating a ticket.
          </p>
        </div>
        <Button onClick={() => openDialog({ kind: "new-category" })}>
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !data || data.categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.categories.map((category) => {
            const subcats = data.subcategories.filter((s) => s.category_id === category.id);
            return (
              <Card key={category.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog({ kind: "edit-category", category })}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDialog({ kind: "new-subcategory", categoryId: category.id })}>
                        Add subcategory
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteState({ kind: "category", item: category })}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-1">
                  {subcats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subcategories</p>
                  ) : (
                    subcats.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <span>{sub.name}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog({ kind: "edit-subcategory", subcategory: sub })}>
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteState({ kind: "subcategory", item: sub })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog ? dialogTitle[dialog.kind] : ""}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" required value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteState?.item.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState?.kind === "category"
                ? "This also deletes all of its subcategories. Tickets using them will keep their history but show no category."
                : "Tickets using this subcategory will keep their history but show no subcategory."}
            </AlertDialogDescription>
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
