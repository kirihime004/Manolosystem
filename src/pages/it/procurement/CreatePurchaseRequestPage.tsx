import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useBudgets, useBudgetCategories, useCompanyCurrencySettings, usePurchaseRequestMutations } from "@/features/it/procurement/hooks";
import { useOfficeSupplies } from "@/features/admin/hooks";
import { PROCUREMENT_MODULE_CONFIG } from "@/features/it/procurement/procurementModuleConfig";
import type { BudgetModuleKey } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Money } from "@/components/shared/Money";

interface ItemRow {
  description: string;
  category: string;
  assetType: string;
  quantity: string;
  unitPrice: string;
  officeSupplyId: string;
}

function emptyItem(): ItemRow {
  return { description: "", category: "", assetType: "none", quantity: "1", unitPrice: "0", officeSupplyId: "" };
}

export default function CreatePurchaseRequestPage({ moduleKey = "IT" }: { moduleKey?: BudgetModuleKey }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const config = PROCUREMENT_MODULE_CONFIG[moduleKey];
  const { data: departments } = useDepartments(company?.id);
  const { data: budgets } = useBudgets(company?.id, moduleKey);
  const { data: categories } = useBudgetCategories(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { data: officeSupplies } = useOfficeSupplies(company?.id);
  const { create, submit } = usePurchaseRequestMutations();

  const [budgetId, setBudgetId] = useState("none");
  const [categoryId, setCategoryId] = useState("none");
  const [departmentId, setDepartmentId] = useState("none");
  const [priority, setPriority] = useState("MEDIUM");
  const [requiredDate, setRequiredDate] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currencySettings?.base_currency_id && !currencyId) setCurrencyId(currencySettings.base_currency_id);
  }, [currencySettings, currencyId]);

  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const selectedBudget = budgets?.find((b) => b.id === budgetId);

  const updateItem = (idx: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const pickOfficeSupply = (idx: number, supplyId: string) => {
    const supply = officeSupplies?.find((s) => s.id === supplyId);
    updateItem(idx, {
      officeSupplyId: supplyId,
      description: supply?.name ?? "",
      unitPrice: supply?.unit_cost != null ? String(supply.unit_cost) : "0",
    });
  };

  const handleSubmit = async (e: FormEvent, submitAfterCreate: boolean) => {
    e.preventDefault();
    if (!company) return;
    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setSubmitting(true);
    try {
      const pr = await create.mutateAsync({
        companyId: company.id,
        moduleKey,
        budgetId: budgetId === "none" ? null : budgetId,
        budgetCategoryId: categoryId === "none" ? null : categoryId,
        departmentId: departmentId === "none" ? null : departmentId,
        requiredDate: requiredDate || null,
        priority,
        reason: reason || null,
        description: description || null,
        currencyId,
        items: validItems.map((i) => ({
          description: i.description,
          category: i.category || null,
          assetType: i.assetType === "none" ? null : i.assetType,
          quantity: Number(i.quantity),
          estimatedUnitPrice: Number(i.unitPrice),
          officeSupplyId: i.assetType === "OFFICE_SUPPLY" ? i.officeSupplyId || null : null,
        })),
      });

      if (submitAfterCreate) {
        try {
          await submit.mutateAsync(pr.id);
          toast.success(`${pr.request_number} submitted for approval`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Saved as draft, but submission failed");
          navigate(`/c/${companySlug}/${config.basePath}/requests/${pr.id}`);
          return;
        }
      } else {
        toast.success(`${pr.request_number} saved as draft`);
      }
      navigate(`/c/${companySlug}/${config.basePath}/requests/${pr.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New {config.label} purchase request</h1>
        <p className="text-sm text-muted-foreground">Describe what {config.label} needs to buy — budget availability is checked when you submit.</p>
      </div>

      <form className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Request details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget</Label>
                <Select value={budgetId} onValueChange={setBudgetId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No budget</SelectItem>
                    {budgets?.filter((b) => b.status === "ACTIVE").map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.budget_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Budget category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedBudget && (
              <p className="text-xs text-muted-foreground">
                Available in this budget: <Money amount={selectedBudget.available} currencyId={selectedBudget.currency_id} />
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Required date</Label><Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Need replacement laptops for new hires" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={currencyId} onChange={setCurrencyId} className="w-48" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}><Plus className="h-3.5 w-3.5" />Add item</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-32">Unit Price</TableHead>
                  <TableHead className="w-32">Line Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {item.assetType === "OFFICE_SUPPLY" ? (
                        <Select value={item.officeSupplyId} onValueChange={(v) => pickOfficeSupply(idx, v)}>
                          <SelectTrigger><SelectValue placeholder="Select supply item" /></SelectTrigger>
                          <SelectContent>{(officeSupplies ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="e.g. Dell Latitude 5420" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={item.assetType} onValueChange={(v) => updateItem(idx, { assetType: v, officeSupplyId: "", description: v === "OFFICE_SUPPLY" ? "" : item.description })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Other</SelectItem>
                          <SelectItem value="HARDWARE">Hardware</SelectItem>
                          <SelectItem value="SOFTWARE">Software</SelectItem>
                          <SelectItem value="OFFICE_SUPPLY">Office Supply</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString()}</TableCell>
                    <TableCell>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end text-sm font-medium">
              Estimated subtotal: <Money amount={subtotal} currencyId={currencyId} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as unknown as FormEvent, false)} disabled={submitting}>Save as draft</Button>
          <Button type="button" onClick={(e) => handleSubmit(e as unknown as FormEvent, true)} disabled={submitting}>{submitting ? "Submitting…" : "Create & submit"}</Button>
        </div>
      </form>
    </div>
  );
}
