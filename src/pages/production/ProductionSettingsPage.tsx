import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useProductionSettings, useTaskTypes, useTaskTypeMutations, useCustomFields, useCustomFieldMutations,
  useWorkflowTemplates, useWorkflowStages, useWorkflowMutations, useClientUsers, useClientUserMutations,
  useProductionUnits, useProductionUnitMutations, useRateCards, useRateCardMutations, useProjects,
  useProjectTemplates, useProjectTemplateMutations,
} from "@/features/production/hooks";
import { updateProductionSettings } from "@/features/production/productionProjectsApi";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { usePositions } from "@/features/hr/hooks";
import { useCurrencies } from "@/features/it/procurement/hooks";
import { Money } from "@/components/shared/Money";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ProductionWorkflowStage } from "@/types/database";

const FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "DROPDOWN", "MULTI_SELECT", "EMPLOYEE", "PROJECT", "SHOT", "TASK", "CURRENCY"];
const ENTITY_TYPES = ["PROJECT", "SHOT", "ASSET", "TASK"];

const STATUS_OPTIONS_BY_ENTITY: Record<string, string[]> = {
  TASK: ["NOT_STARTED", "READY", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"],
  SHOT: ["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD", "OMITTED"],
  ASSET: ["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"],
};

export default function ProductionSettingsPage() {
  const { company } = useCompany();
  const { data: settings } = useProductionSettings(company?.id);
  const [namingFormat, setNamingFormat] = useState("");

  const { data: taskTypes, isLoading: taskTypesLoading } = useTaskTypes(company?.id);
  const taskTypeMutations = useTaskTypeMutations(company?.id);
  const [taskTypeOpen, setTaskTypeOpen] = useState(false);
  const [taskTypeName, setTaskTypeName] = useState("");
  const [taskTypeAppliesTo, setTaskTypeAppliesTo] = useState("SHOT");

  const { data: units } = useProductionUnits(company?.id);
  const unitMutations = useProductionUnitMutations(company?.id);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitCode, setUnitCode] = useState("");
  const [unitLabel, setUnitLabel] = useState("");

  const { data: templates } = useProjectTemplates(company?.id);
  const templateMutations = useProjectTemplateMutations(company?.id);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  const [tplMilestones, setTplMilestones] = useState<{ name: string; days_offset: string; milestone_type: string }[]>([]);

  const { data: rateCards } = useRateCards(company?.id);
  const rateCardMutations = useRateCardMutations(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { data: positions } = usePositions(company?.id);
  const { data: currencies } = useCurrencies();
  const { data: projects } = useProjects(company?.id);
  const [rateCardOpen, setRateCardOpen] = useState(false);
  const [rcName, setRcName] = useState("");
  const [rcTaskTypeId, setRcTaskTypeId] = useState("");
  const [rcUnitId, setRcUnitId] = useState("");
  const [rcDepartmentId, setRcDepartmentId] = useState("");
  const [rcProjectId, setRcProjectId] = useState("");
  const [rcPositionId, setRcPositionId] = useState("");
  const [rcCurrencyId, setRcCurrencyId] = useState("");
  const [rcRate, setRcRate] = useState("");
  const [rcEffectiveFrom, setRcEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [versionTarget, setVersionTarget] = useState<{ id: string; rate: number } | null>(null);
  const [versionRate, setVersionRate] = useState("");
  const [versionEffectiveFrom, setVersionEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: customFields } = useCustomFields(company?.id);
  const customFieldMutations = useCustomFieldMutations(company?.id);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldEntityType, setFieldEntityType] = useState("SHOT");
  const [fieldType, setFieldType] = useState("TEXT");
  const [fieldOptionsText, setFieldOptionsText] = useState("");

  const { data: workflowTemplates } = useWorkflowTemplates(company?.id);
  const workflowMutations = useWorkflowMutations(company?.id);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowEntityType, setWorkflowEntityType] = useState("TASK");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = (workflowTemplates ?? []).find((w) => w.id === selectedTemplateId) ?? null;
  const { data: workflowStages } = useWorkflowStages(selectedTemplateId ?? undefined);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageName, setStageName] = useState("");
  const [stageStatus, setStageStatus] = useState("NOT_STARTED");
  const [stageDeleteTarget, setStageDeleteTarget] = useState<ProductionWorkflowStage | null>(null);

  const { data: clientUsers } = useClientUsers(company?.id);
  const clientUserMutations = useClientUserMutations(company?.id);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCustomerId, setClientCustomerId] = useState("");

  const handleSaveNaming = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateProductionSettings(company!.id, { shotNamingFormat: namingFormat || settings?.shot_naming_format });
      toast.success("Naming format saved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
  };

  const handleCreateTaskType = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await taskTypeMutations.create.mutateAsync({ companyId: company!.id, name: taskTypeName, appliesTo: taskTypeAppliesTo, sortOrder: (taskTypes?.length ?? 0) + 1 });
      toast.success("Task type created");
      setTaskTypeOpen(false); setTaskTypeName("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create task type"); }
  };

  const handleCreateUnit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await unitMutations.create.mutateAsync({ companyId: company!.id, code: unitCode, label: unitLabel, sortOrder: (units?.length ?? 0) + 1 });
      toast.success("Production unit created");
      setUnitOpen(false); setUnitCode(""); setUnitLabel("");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create unit")); }
  };

  const handleCreateTemplate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await templateMutations.create.mutateAsync({
        companyId: company!.id, name: tplName, description: tplDescription || null,
        config: { milestones: tplMilestones.filter((m) => m.name.trim()).map((m) => ({ name: m.name, days_offset: Number(m.days_offset) || 0, milestone_type: m.milestone_type })) },
      });
      toast.success("Template created");
      setTemplateOpen(false); setTplName(""); setTplDescription(""); setTplMilestones([]);
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create template")); }
  };

  const handleCreateRateCard = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await rateCardMutations.create.mutateAsync({
        companyId: company!.id, name: rcName, taskTypeId: rcTaskTypeId, productionUnitId: rcUnitId,
        departmentId: rcDepartmentId || null, projectId: rcProjectId || null, positionId: rcPositionId || null,
        currencyId: rcCurrencyId, rate: Number(rcRate), effectiveFrom: rcEffectiveFrom,
      });
      toast.success("Rate card created");
      setRateCardOpen(false);
      setRcName(""); setRcTaskTypeId(""); setRcUnitId(""); setRcDepartmentId(""); setRcProjectId(""); setRcPositionId(""); setRcCurrencyId(""); setRcRate("");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create rate card")); }
  };

  const handleNewVersion = async () => {
    if (!versionTarget) return;
    try {
      await rateCardMutations.duplicateAsNewVersion.mutateAsync({ sourceId: versionTarget.id, rate: Number(versionRate), effectiveFrom: versionEffectiveFrom });
      toast.success("New rate version created — the previous rate stays on record for work already priced against it");
      setVersionTarget(null); setVersionRate("");
    } catch (err) { toast.error(getErrorMessage(err, "Failed to create new version")); }
  };

  const handleCreateField = async (e: FormEvent) => {
    e.preventDefault();
    const options = fieldOptionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map((o) => ({ value: o, label: o }));
    try {
      await customFieldMutations.create.mutateAsync({
        companyId: company!.id, entityType: fieldEntityType, fieldKey: fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: fieldLabel, fieldType, sortOrder: (customFields?.length ?? 0) + 1, options,
      });
      toast.success("Custom field created");
      setFieldOpen(false); setFieldLabel(""); setFieldOptionsText("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create custom field"); }
  };

  const handleCreateWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await workflowMutations.createTemplate.mutateAsync({ companyId: company!.id, name: workflowName, entityType: workflowEntityType });
      toast.success("Workflow template created");
      setWorkflowOpen(false); setWorkflowName("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create workflow template"); }
  };

  const handleCreateStage = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      await workflowMutations.addStage.mutateAsync({
        companyId: company!.id, workflowTemplateId: selectedTemplate.id, name: stageName,
        sortOrder: (workflowStages?.length ?? 0) + 1, mapsToStatus: stageStatus,
      });
      toast.success("Stage added");
      setStageOpen(false); setStageName("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add stage"); }
  };

  const handleDeleteStage = async () => {
    if (!stageDeleteTarget) return;
    try {
      await workflowMutations.deleteStage.mutateAsync({ id: stageDeleteTarget.id, workflowTemplateId: stageDeleteTarget.workflow_template_id });
      toast.success("Stage deleted");
      setStageDeleteTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete stage"); }
  };

  const handleLinkClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientCustomerId) { toast.error("Enter the customer this contact belongs to"); return; }
    try {
      await clientUserMutations.link.mutateAsync({ companyId: company!.id, customerId: clientCustomerId, email: clientEmail, name: clientName });
      toast.success("Client account linked");
      setClientOpen(false); setClientEmail(""); setClientName(""); setClientCustomerId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to link client — do they already have a platform account?"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Production Settings</h1>
        <p className="text-sm text-muted-foreground">Task types, naming, custom fields, workflows, and client access</p>
      </div>

      <Tabs defaultValue="task-types">
        <TabsList>
          <TabsTrigger value="task-types">Task Types</TabsTrigger>
          <TabsTrigger value="naming">Shot Naming</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="client-access">Client Access</TabsTrigger>
          <Can permission={PERMISSIONS.PRODUCTION_RATES_VIEW}><TabsTrigger value="rate-cards">Rate Cards</TabsTrigger></Can>
          <TabsTrigger value="production-units">Production Units</TabsTrigger>
          <TabsTrigger value="templates">Project Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="task-types" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE}>
              <Dialog open={taskTypeOpen} onOpenChange={setTaskTypeOpen}>
                <DialogTrigger asChild><Button size="sm">+ Task type</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New task type</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateTaskType} className="space-y-3">
                    <div className="space-y-1.5"><Label>Name</Label><Input required value={taskTypeName} onChange={(e) => setTaskTypeName(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Applies to</Label>
                      <Select value={taskTypeAppliesTo} onValueChange={setTaskTypeAppliesTo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["SHOT", "ASSET", "BOTH"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={taskTypeMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            {taskTypesLoading ? <Skeleton className="h-24 w-full" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Applies to</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(taskTypes ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.applies_to}</TableCell>
                      <TableCell>
                        <Can permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE} fallback={<span className="text-muted-foreground">{t.is_active ? "Yes" : "No"}</span>}>
                          <Switch checked={t.is_active} onCheckedChange={(checked) => taskTypeMutations.update.mutate({ id: t.id, patch: { isActive: checked } })} />
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="naming" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Controls how a shot's full code is displayed, e.g. <code className="rounded bg-muted px-1">EP01_SQ010_SH010</code>. Available tokens: <code className="rounded bg-muted px-1">{"{episode}"}</code>, <code className="rounded bg-muted px-1">{"{sequence}"}</code>, <code className="rounded bg-muted px-1">{"{shot}"}</code>.</p>
          <Can permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE}>
            <form onSubmit={handleSaveNaming} className="flex max-w-md items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Format</Label>
                <Input defaultValue={settings?.shot_naming_format} onChange={(e) => setNamingFormat(e.target.value)} />
              </div>
              <Button type="submit">Save</Button>
            </form>
          </Can>
        </TabsContent>

        <TabsContent value="custom-fields" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_CUSTOM_FIELDS_MANAGE}>
              <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
                <DialogTrigger asChild><Button size="sm">+ Custom field</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New custom field</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateField} className="space-y-3">
                    <div className="space-y-1.5"><Label>Label</Label><Input required value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Entity</Label>
                      <Select value={fieldEntityType} onValueChange={setFieldEntityType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Field type</Label>
                      <Select value={fieldType} onValueChange={setFieldType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {(fieldType === "DROPDOWN" || fieldType === "MULTI_SELECT") && (
                      <div className="space-y-1.5">
                        <Label>Options</Label>
                        <Input placeholder="Comma-separated, e.g. Low, Medium, High" value={fieldOptionsText} onChange={(e) => setFieldOptionsText(e.target.value)} />
                      </div>
                    )}
                    <DialogFooter><Button type="submit" disabled={customFieldMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Entity</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {(customFields ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.label}</TableCell>
                    <TableCell className="text-muted-foreground">{f.entity_type}</TableCell>
                    <TableCell className="text-muted-foreground">{f.field_type}{f.options.length > 0 ? ` (${f.options.map((o) => o.label).join(", ")})` : ""}</TableCell>
                  </TableRow>
                ))}
                {(!customFields || customFields.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No custom fields yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_WORKFLOWS_MANAGE}>
              <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
                <DialogTrigger asChild><Button size="sm">+ Workflow template</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New workflow template</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateWorkflow} className="space-y-3">
                    <div className="space-y-1.5"><Label>Name</Label><Input required value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Entity</Label>
                      <Select value={workflowEntityType} onValueChange={setWorkflowEntityType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["TASK", "SHOT", "ASSET"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={workflowMutations.createTemplate.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Entity</TableHead></TableRow></TableHeader>
              <TableBody>
                {(workflowTemplates ?? []).map((w) => (
                  <TableRow
                    key={w.id}
                    onClick={() => {
                      setSelectedTemplateId(w.id);
                      setStageStatus(STATUS_OPTIONS_BY_ENTITY[w.entity_type]?.[0] ?? "NOT_STARTED");
                    }}
                    className={cn("cursor-pointer", selectedTemplateId === w.id && "bg-accent")}
                  >
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-muted-foreground">{w.entity_type}</TableCell>
                  </TableRow>
                ))}
                {(!workflowTemplates || workflowTemplates.length === 0) && (
                  <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">No workflow templates yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {selectedTemplate && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Stages — {selectedTemplate.name}</h3>
                  <p className="text-xs text-muted-foreground">The ordered steps this workflow moves through, each tied to a status.</p>
                </div>
                <Can permission={PERMISSIONS.PRODUCTION_WORKFLOWS_MANAGE}>
                  <Dialog open={stageOpen} onOpenChange={setStageOpen}>
                    <DialogTrigger asChild><Button size="sm">+ Stage</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New stage</DialogTitle></DialogHeader>
                      <form onSubmit={handleCreateStage} className="space-y-3">
                        <div className="space-y-1.5"><Label>Name</Label><Input required value={stageName} onChange={(e) => setStageName(e.target.value)} /></div>
                        <div className="space-y-1.5">
                          <Label>Maps to status</Label>
                          <Select value={stageStatus} onValueChange={setStageStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(STATUS_OPTIONS_BY_ENTITY[selectedTemplate.entity_type] ?? []).map((s) => (
                                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter><Button type="submit" disabled={workflowMutations.addStage.isPending}>Add stage</Button></DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </Can>
              </div>

              <Table>
                <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Stage</TableHead><TableHead>Maps to status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(workflowStages ?? []).map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.maps_to_status.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Can permission={PERMISSIONS.PRODUCTION_WORKFLOWS_MANAGE}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStageDeleteTarget(s)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!workflowStages || workflowStages.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No stages yet — add the first one above.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <AlertDialog open={!!stageDeleteTarget} onOpenChange={(open) => !open && setStageDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete stage "{stageDeleteTarget?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStage}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="client-access" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Link an existing platform account (the client must already have signed up) to a customer as a portal contact.</p>
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_CLIENT_ACCESS_MANAGE}>
              <Dialog open={clientOpen} onOpenChange={setClientOpen}>
                <DialogTrigger asChild><Button size="sm">+ Link client account</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Link client account</DialogTitle></DialogHeader>
                  <form onSubmit={handleLinkClient} className="space-y-3">
                    <div className="space-y-1.5"><Label>Customer ID</Label><Input required value={clientCustomerId} onChange={(e) => setClientCustomerId(e.target.value)} placeholder="From Finance > Customers" /></div>
                    <div className="space-y-1.5"><Label>Contact name</Label><Input required value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Contact email</Label><Input required type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
                    <DialogFooter><Button type="submit" disabled={clientUserMutations.link.isPending}>Link</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {(clientUsers ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell>
                      <Can permission={PERMISSIONS.PRODUCTION_CLIENT_ACCESS_MANAGE} fallback={<span className="text-muted-foreground">{c.is_active ? "Yes" : "No"}</span>}>
                        <Switch checked={c.is_active} onCheckedChange={(checked) => clientUserMutations.setActive.mutate({ id: c.id, isActive: checked })} />
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
                {(!clientUsers || clientUsers.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No client accounts linked yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <Can permission={PERMISSIONS.PRODUCTION_RATES_VIEW}>
          <TabsContent value="rate-cards" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Priority when several cards match the same task: employee-specific, then project-specific, then position-specific, then department-specific, then company default. A rate is never overwritten once used — editing an active card creates a new version and closes out the old one.
            </p>
            <div className="flex justify-end">
              <Can permission={PERMISSIONS.PRODUCTION_RATES_CREATE}>
                <Dialog open={rateCardOpen} onOpenChange={setRateCardOpen}>
                  <DialogTrigger asChild><Button size="sm">+ Rate card</Button></DialogTrigger>
                  <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
                    <DialogHeader><DialogTitle>New rate card</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateRateCard} className="flex flex-1 flex-col gap-3 overflow-hidden">
                    <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                      <div className="space-y-1.5"><Label>Name</Label><Input required value={rcName} onChange={(e) => setRcName(e.target.value)} placeholder="e.g. Animation — Second, Company default" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Task type</Label>
                          <Select value={rcTaskTypeId} onValueChange={setRcTaskTypeId}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{(taskTypes ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Unit</Label>
                          <Select value={rcUnitId} onValueChange={setRcUnitId}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{(units ?? []).filter((u) => u.is_active).map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Leave scope fields empty for a company-wide default. Set one or more to narrow it — the most specific match wins.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Department (optional)</Label>
                          <Select value={rcDepartmentId || "__none__"} onValueChange={(v) => setRcDepartmentId(v === "__none__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent><SelectItem value="__none__">Any</SelectItem>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Project (optional)</Label>
                          <Select value={rcProjectId || "__none__"} onValueChange={(v) => setRcProjectId(v === "__none__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent><SelectItem value="__none__">Any</SelectItem>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Position (optional — e.g. Senior Animator)</Label>
                        <Select value={rcPositionId || "__none__"} onValueChange={(v) => setRcPositionId(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent><SelectItem value="__none__">Any</SelectItem>{(positions ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Currency</Label>
                          <Select value={rcCurrencyId} onValueChange={setRcCurrencyId}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{(currencies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label>Rate per unit</Label><Input required type="number" min="0" step="0.01" value={rcRate} onChange={(e) => setRcRate(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5"><Label>Effective from</Label><Input required type="date" value={rcEffectiveFrom} onChange={(e) => setRcEffectiveFrom(e.target.value)} /></div>
                    </div>
                      <DialogFooter><Button type="submit" disabled={rateCardMutations.create.isPending || !rcTaskTypeId || !rcUnitId || !rcCurrencyId}>Create</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Task type</TableHead><TableHead>Unit</TableHead>
                    <TableHead>Scope</TableHead><TableHead>Rate</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead><TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rateCards ?? []).map((rc) => {
                    const taskType = (taskTypes ?? []).find((t) => t.id === rc.task_type_id);
                    const unit = (units ?? []).find((u) => u.id === rc.production_unit_id);
                    const scope = rc.employee_id ? "Employee" : rc.project_id ? "Project" : rc.position_id ? "Position" : rc.department_id ? "Department" : "Company default";
                    return (
                      <TableRow key={rc.id}>
                        <TableCell className="font-medium">{rc.name}</TableCell>
                        <TableCell className="text-muted-foreground">{taskType?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{unit?.label ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{scope}</TableCell>
                        <TableCell><Money amount={rc.rate} currencyId={rc.currency_id} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{rc.effective_from}{rc.effective_to ? ` → ${rc.effective_to}` : ""}</TableCell>
                        <TableCell><ProductionStatusBadge status={rc.status} /></TableCell>
                        <TableCell>
                          <Can permission={PERMISSIONS.PRODUCTION_RATES_UPDATE}>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setVersionTarget({ id: rc.id, rate: rc.rate }); setVersionRate(String(rc.rate)); }}>New version</Button>
                              <Can permission={PERMISSIONS.PRODUCTION_RATES_DEACTIVATE}>
                                <Button size="sm" variant="ghost" onClick={() => rateCardMutations.setStatus.mutate({ id: rc.id, status: rc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>
                                  {rc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                </Button>
                              </Can>
                            </div>
                          </Can>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!rateCards || rateCards.length === 0) && (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No rate cards yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Can>

        <TabsContent value="production-units" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE}>
              <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
                <DialogTrigger asChild><Button size="sm">+ Unit</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New production unit</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateUnit} className="space-y-3">
                    <div className="space-y-1.5"><Label>Label</Label><Input required value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="e.g. Per Facial Shot" /></div>
                    <div className="space-y-1.5"><Label>Code</Label><Input required value={unitCode} onChange={(e) => setUnitCode(e.target.value)} placeholder="e.g. FACIAL_SHOT" /></div>
                    <DialogFooter><Button type="submit" disabled={unitMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Code</TableHead><TableHead>System</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {(units ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.label}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{u.code}</TableCell>
                    <TableCell className="text-muted-foreground">{u.is_system ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Can permission={PERMISSIONS.PRODUCTION_SETTINGS_MANAGE} fallback={<span className="text-muted-foreground">{u.is_active ? "Yes" : "No"}</span>}>
                        <Switch checked={u.is_active} onCheckedChange={(checked) => unitMutations.update.mutate({ id: u.id, patch: { isActive: checked } })} />
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_TEMPLATES_MANAGE}>
              <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild><Button size="sm">+ Template</Button></DialogTrigger>
                <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
                  <DialogHeader><DialogTitle>New project template</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateTemplate} className="flex flex-1 flex-col gap-3 overflow-hidden">
                  <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                    <div className="space-y-1.5"><Label>Name</Label><Input required value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Standard 22-min episode" /></div>
                    <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={tplDescription} onChange={(e) => setTplDescription(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Milestones (optional)</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTplMilestones((m) => [...m, { name: "", days_offset: "0", milestone_type: "INTERNAL" }])}>+ Milestone</Button>
                      </div>
                      {tplMilestones.map((m, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                          <Input placeholder="Name" value={m.name} onChange={(e) => setTplMilestones((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                          <Input type="number" className="w-20" placeholder="Days" value={m.days_offset} onChange={(e) => setTplMilestones((arr) => arr.map((x, j) => j === i ? { ...x, days_offset: e.target.value } : x))} />
                          <Select value={m.milestone_type} onValueChange={(v) => setTplMilestones((arr) => arr.map((x, j) => j === i ? { ...x, milestone_type: v } : x))}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INTERNAL">Internal</SelectItem>
                              <SelectItem value="CLIENT">Client</SelectItem>
                              <SelectItem value="DELIVERY">Delivery</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTplMilestones((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Days = how many days after the new project's start date each milestone falls due.</p>
                    </div>
                  </div>
                    <DialogFooter><Button type="submit" disabled={templateMutations.create.isPending}>Create</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Milestones</TableHead></TableRow></TableHeader>
              <TableBody>
                {(templates ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{(t.config?.milestones ?? []).length}</TableCell>
                  </TableRow>
                ))}
                {(!templates || templates.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No templates yet — new projects can be created from scratch either way.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!versionTarget} onOpenChange={(open) => !open && setVersionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New rate version</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">The current rate stays on record — any work already priced or approved against it keeps its snapshot. This only changes what applies going forward.</p>
            <div className="space-y-1.5"><Label>New rate</Label><Input type="number" min="0" step="0.01" value={versionRate} onChange={(e) => setVersionRate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={versionEffectiveFrom} onChange={(e) => setVersionEffectiveFrom(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleNewVersion} disabled={rateCardMutations.duplicateAsNewVersion.isPending}>Create version</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
