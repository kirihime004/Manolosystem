import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Users, Plus, Pencil } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCustomers, useCustomerMutations } from "@/features/finance/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Customer } from "@/types/database";

const CUSTOMER_TYPES = ["CLIENT", "STUDIO", "NETWORK", "PRODUCTION_COMPANY", "CORPORATE", "OTHER"];

export default function CustomersPage() {
  const { company } = useCompany();
  const { data: customers, isLoading } = useCustomers(company?.id);
  const { create, update } = useCustomerMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerType, setCustomerType] = useState("CLIENT");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [editing, setEditing] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("CLIENT");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTaxNumber, setEditTaxNumber] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const c = await create.mutateAsync({ companyId: company.id, name: name.trim(), customerType, email: email || null, phone: phone || null });
      toast.success(`${c.name} created`);
      setOpen(false);
      setName(""); setEmail(""); setPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  const startEdit = (c: Customer) => {
    setEditing(c);
    setEditName(c.name);
    setEditType(c.customer_type);
    setEditEmail(c.email ?? "");
    setEditPhone(c.phone ?? "");
    setEditAddress(c.address ?? "");
    setEditTaxNumber(c.tax_number ?? "");
    setEditPaymentTerms(c.payment_terms ?? "");
    setEditStatus(c.status);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: {
          name: editName, customerType: editType, email: editEmail || null, phone: editPhone || null,
          address: editAddress || null, taxNumber: editTaxNumber || null, paymentTerms: editPaymentTerms || null,
          status: editStatus,
        },
      });
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers?.length ?? 0} customers</p>
        </div>
        <Can permission={PERMISSIONS.FINANCE_CUSTOMERS_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New customer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create customer"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !customers || customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.customer_code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.customer_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? c.phone ?? "—"}</TableCell>
                  <TableCell><FinanceStatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.FINANCE_CUSTOMERS_MANAGE}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Tax number</Label><Input value={editTaxNumber} onChange={(e) => setEditTaxNumber(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Payment terms</Label><Input value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)} placeholder="e.g. Net 30" /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
