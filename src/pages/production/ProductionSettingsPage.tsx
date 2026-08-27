import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useProductionSettings, useTaskTypes, useTaskTypeMutations, useCustomFields, useCustomFieldMutations,
  useWorkflowTemplates, useWorkflowStages, useWorkflowMutations, useClientUsers, useClientUserMutations,
} from "@/features/production/hooks";
import { updateProductionSettings } from "@/features/production/productionProjectsApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
      </Tabs>
    </div>
  );
}
