import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Truck, Plus, Search } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useSuppliers } from "@/features/it/inventory/hooks";
import * as inventoryApi from "@/features/it/inventory/inventoryApi";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SupplierStatusBadge } from "@/components/shared/ProcurementBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function SuppliersListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useSuppliers(company?.id);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = (suppliers ?? []).filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setCreating(true);
    try {
      await inventoryApi.createSupplier({ companyId: company.id, name: name.trim(), contactPerson: contactPerson || null, email: email || null, phone: phone || null });
      toast.success("Supplier created");
      queryClient.invalidateQueries({ queryKey: ["suppliers", company.id] });
      setOpen(false);
      setName(""); setContactPerson(""); setEmail(""); setPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create supplier");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} suppliers</p>
        </div>
        <Can permission={PERMISSIONS.IT_SUPPLIERS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Contact person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create supplier"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title="No suppliers yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/it/procurement/suppliers/${s.id}`)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.contact_person ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                  <TableCell><SupplierStatusBadge status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
