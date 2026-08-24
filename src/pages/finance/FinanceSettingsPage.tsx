import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useFiscalYears, useFinancialPeriods, useFiscalPeriodMutations, usePeriodCloseChecklist,
  useCostCenters, useCostCenterMutations, useProfitCenters, useProfitCenterMutations,
  useTaxRates, useTaxRateMutations,
} from "@/features/finance/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { CalendarRange, Building2, TrendingUp, Percent } from "lucide-react";

function FiscalYearsTab() {
  const { company } = useCompany();
  const { data: fiscalYears } = useFiscalYears(company?.id);
  const { data: periods } = useFinancialPeriods(company?.id);
  const { createFiscalYear, generatePeriods, closePeriod, reopenPeriod } = useFiscalPeriodMutations(company?.id);
  const [selectedFy, setSelectedFy] = useState<string>("");
  const { data: checklist } = usePeriodCloseChecklist(selectedFy || undefined);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await createFiscalYear.mutateAsync({ companyId: company.id, name, startDate, endDate, isCurrent: true });
      toast.success(`${name} created`);
      setOpen(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create fiscal year");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.FINANCE_SETTINGS_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" />New fiscal year</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New fiscal year</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FY2026" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={createFiscalYear.isPending}>{createFiscalYear.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      {!fiscalYears || fiscalYears.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No fiscal years yet" />
      ) : (
        fiscalYears.map((fy) => (
          <Card key={fy.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{fy.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{fy.start_date} – {fy.end_date}</span></CardTitle>
              <Can permission={PERMISSIONS.FINANCE_SETTINGS_MANAGE}>
                {!(periods ?? []).some((p) => p.fiscal_year_id === fy.id) && (
                  <div className="flex gap-1">
                    {["MONTHLY", "QUARTERLY", "YEARLY"].map((t) => (
                      <Button key={t} size="sm" variant="outline" onClick={() => generatePeriods.mutate({ fiscalYearId: fy.id, periodType: t as "MONTHLY" | "QUARTERLY" | "YEARLY" })}>
                        Generate {t.toLowerCase()}
                      </Button>
                    ))}
                  </div>
                )}
              </Can>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
                <TableBody>
                  {(periods ?? []).filter((p) => p.fiscal_year_id === fy.id).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.start_date} – {p.end_date}</TableCell>
                      <TableCell><FinanceStatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <Can permission={PERMISSIONS.FINANCE_PERIODS_CLOSE}>
                          {p.status === "OPEN" && (
                            <Button size="sm" variant="outline" onClick={() => setSelectedFy(p.id)}>
                              Close
                            </Button>
                          )}
                          {p.status === "CLOSED" && (
                            <Button size="sm" variant="ghost" onClick={() => reopenPeriod.mutate({ id: p.id, reason: "Reopened from Finance Settings" })}>
                              Reopen
                            </Button>
                          )}
                        </Can>
                        {selectedFy === p.id && (
                          <AlertDialog open onOpenChange={(v) => !v && setSelectedFy("")}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Close {p.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {checklist && checklist.some((c) => c.blocking_count > 0)
                                    ? "There are unresolved items in this period. Closing may need to be forced."
                                    : "This will lock the period against new postings."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { closePeriod.mutate({ id: p.id }); setSelectedFy(""); }}>Close period</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function CostCentersTab() {
  const { company } = useCompany();
  const { data: costCenters } = useCostCenters(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { create, update, remove } = useCostCenterMutations(company?.id);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({ companyId: company.id, code, name, departmentId: departmentId || null });
      setOpen(false);
      setCode(""); setName(""); setDepartmentId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create cost center");
    }
  };

  const startEdit = (c: { id: string; name: string; department_id: string | null; status: string }) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDepartmentId(c.department_id ?? "");
    setEditStatus(c.status);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await update.mutateAsync({ id: editingId, patch: { name: editName, departmentId: editDepartmentId || null, status: editStatus } });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update cost center");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.FINANCE_COST_CENTERS_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" />New cost center</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New cost center</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Department (optional)</Label>
                  <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>
      {!costCenters || costCenters.length === 0 ? (
        <EmptyState icon={Building2} title="No cost centers yet" />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {costCenters.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><FinanceStatusBadge status={c.status} /></TableCell>
                <TableCell className="flex gap-1">
                  <Can permission={PERMISSIONS.FINANCE_COST_CENTERS_MANAGE}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit cost center</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={editDepartmentId || "none"} onValueChange={(v) => setEditDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfitCentersTab() {
  const { company } = useCompany();
  const { data: profitCenters } = useProfitCenters(company?.id);
  const { create, update, remove } = useProfitCenterMutations(company?.id);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({ companyId: company.id, code, name });
      setOpen(false);
      setCode(""); setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create profit center");
    }
  };

  const startEdit = (c: { id: string; name: string; description: string | null; status: string }) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description ?? "");
    setEditStatus(c.status);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await update.mutateAsync({ id: editingId, patch: { name: editName, description: editDescription || null, status: editStatus } });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profit center");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.FINANCE_PROFIT_CENTERS_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" />New profit center</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New profit center</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>
      {!profitCenters || profitCenters.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No profit centers yet" description="Optional -- only configure these if you report profitability by line of business." />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {profitCenters.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><FinanceStatusBadge status={c.status} /></TableCell>
                <TableCell className="flex gap-1">
                  <Can permission={PERMISSIONS.FINANCE_PROFIT_CENTERS_MANAGE}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit profit center</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TAX_TYPES = ["VAT", "WITHHOLDING_TAX", "SALES_TAX", "SSS_EMPLOYEE", "SSS_EMPLOYER", "PHILHEALTH_EMPLOYEE", "PHILHEALTH_EMPLOYER", "PAGIBIG_EMPLOYEE", "PAGIBIG_EMPLOYER", "OTHER"];

function TaxRatesTab() {
  const { company } = useCompany();
  const { data: taxRates } = useTaxRates(company?.id);
  const { create, update, remove } = useTaxRateMutations(company?.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [rate, setRate] = useState("");
  const [taxType, setTaxType] = useState("VAT");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({ companyId: company.id, name, code, rate: Number(rate), taxType });
      setOpen(false);
      setName(""); setCode(""); setRate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create tax rate");
    }
  };

  const startEdit = (t: { id: string; name: string; rate: number; expiry_date: string | null; is_active: boolean }) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditRate(String(t.rate));
    setEditExpiryDate(t.expiry_date ?? "");
    setEditIsActive(t.is_active);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await update.mutateAsync({ id: editingId, patch: { name: editName, rate: Number(editRate), expiryDate: editExpiryDate || null, isActive: editIsActive } });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tax rate");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.FINANCE_TAX_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" />New tax rate</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New tax rate</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VAT 12%" /></div>
                  <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={taxType} onValueChange={setTaxType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TAX_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Rate (%)</Label><Input type="number" step="0.001" required value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>
      {!taxRates || taxRates.length === 0 ? (
        <EmptyState icon={Percent} title="No tax rates configured" description="Add SSS/PhilHealth/Pag-IBIG/withholding rates here -- nothing is hard-coded." />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Rate</TableHead><TableHead>Effective</TableHead><TableHead>Active</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {taxRates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.tax_type.replace(/_/g, " ")}</TableCell>
                <TableCell>{t.rate}%</TableCell>
                <TableCell className="text-muted-foreground">{t.effective_date}</TableCell>
                <TableCell>{t.is_active ? "Yes" : "No"}</TableCell>
                <TableCell className="flex gap-1">
                  <Can permission={PERMISSIONS.FINANCE_TAX_MANAGE}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit tax rate</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Rate (%)</Label><Input type="number" step="0.001" required value={editRate} onChange={(e) => setEditRate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Expiry date (optional)</Label><Input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Active</Label>
              <Select value={editIsActive ? "true" : "false"} onValueChange={(v) => setEditIsActive(v === "true")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Finance Settings</h1>
        <p className="text-sm text-muted-foreground">Fiscal calendar, dimensions, and tax configuration. Currency settings live under Company Settings.</p>
      </div>

      <Tabs defaultValue="periods">
        <TabsList>
          <TabsTrigger value="periods">Fiscal Year & Periods</TabsTrigger>
          <TabsTrigger value="cost-centers">Cost Centers</TabsTrigger>
          <TabsTrigger value="profit-centers">Profit Centers</TabsTrigger>
          <TabsTrigger value="tax">Tax Rates</TabsTrigger>
        </TabsList>
        <TabsContent value="periods" className="pt-4"><FiscalYearsTab /></TabsContent>
        <TabsContent value="cost-centers" className="pt-4"><CostCentersTab /></TabsContent>
        <TabsContent value="profit-centers" className="pt-4"><ProfitCentersTab /></TabsContent>
        <TabsContent value="tax" className="pt-4"><TaxRatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
