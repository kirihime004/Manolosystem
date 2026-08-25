import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useOfficeSupplies, useOfficeSupplyMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { OfficeSupply } from "@/types/database";

export default function OfficeSuppliesPage() {
  const { company } = useCompany();
  const { data: supplies, isLoading } = useOfficeSupplies(company?.id);
  const { create, recordMovement } = useOfficeSupplyMutations(company?.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("each");
  const [minimumQuantity, setMinimumQuantity] = useState("0");

  const [stockTarget, setStockTarget] = useState<OfficeSupply | null>(null);
  const [movementType, setMovementType] = useState("STOCK_IN");
  const [quantity, setQuantity] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, name, category: category || null, unit, minimumQuantity: Number(minimumQuantity) });
      toast.success("Item created");
      setCreateOpen(false); setName(""); setCategory(""); setUnit("each"); setMinimumQuantity("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create item");
    }
  };

  const handleMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!stockTarget || !quantity) return;
    try {
      await recordMovement.mutateAsync({ supplyId: stockTarget.id, movementType, quantity: Number(quantity) });
      toast.success("Stock updated");
      setStockTarget(null); setQuantity("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record movement");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Office Supplies</h1>
          <p className="text-sm text-muted-foreground">Consumables inventory — paper, pens, toner, and other supplies</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_SUPPLIES_MANAGE}>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button>+ New item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New office supply item</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Paper" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Minimum quantity</Label><Input type="number" min="0" value={minimumQuantity} onChange={(e) => setMinimumQuantity(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create item</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !supplies || supplies.length === 0 ? (
          <EmptyState icon={Package} title="No supplies yet" description="Add your first office supply item." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>On hand</TableHead><TableHead>Minimum</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {supplies.map((s) => (
                <TableRow key={s.id} className={s.current_quantity <= s.minimum_quantity ? "bg-amber-500/5" : undefined}>
                  <TableCell className="font-mono text-xs">{s.item_code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.category ?? "—"}</TableCell>
                  <TableCell className={s.current_quantity <= s.minimum_quantity ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                    {s.current_quantity} {s.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.minimum_quantity} {s.unit}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_SUPPLIES_MANAGE}>
                      <Button variant="ghost" size="sm" onClick={() => setStockTarget(s)}>Adjust stock</Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!stockTarget} onOpenChange={(open) => !open && setStockTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {stockTarget?.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleMovement} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Movement type</Label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "RETURN", "DISPOSAL"].map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min="0.01" step="0.01" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={recordMovement.isPending}>Record movement</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
