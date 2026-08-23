import { useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useEmployee, useEmployeeMutations, useEmergencyContacts, useEmergencyContactMutations,
  useEmployeeHistory, useEmployeeDocuments, useEmployeeDocumentMutations,
  useContracts, useContractMutations, useCompensationHistory, useCompensationMutations,
  useAttendance, useLeaveRequests, useTimesheets, useHrRequests, useBenefits,
  useOnboardingTasks, useOffboardingTasks, useLifecycleMutations,
  useEmploymentTypes, useEmploymentStatuses, usePositions,
} from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import * as employeeApi from "@/features/hr/hrEmployeeApi";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Money } from "@/components/shared/Money";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import {
  EmploymentStatusBadge, ContractStatusBadge, TaskStatusBadge, AttendanceStatusBadge,
  LeaveRequestStatusBadge, HrRequestStatusBadge,
} from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { company } = useCompany();
  const { data: employee, isLoading } = useEmployee(employeeId);
  const { update } = useEmployeeMutations(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { data: positions } = usePositions(company?.id);
  const { data: employmentTypes } = useEmploymentTypes(company?.id);
  const { data: employmentStatuses } = useEmploymentStatuses(company?.id);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!employee) return <ErrorScreen title="Employee not found" description="This employee does not exist or you do not have access." />;

  const dept = departments?.find((d) => d.id === employee.department_id);
  const position = positions?.find((p) => p.id === employee.position_id);
  const status = employmentStatuses?.find((s) => s.id === employee.employment_status_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{employee.employee_number}</p>
          <h1 className="text-xl font-semibold text-foreground">{employee.first_name} {employee.last_name}</h1>
          <p className="text-sm text-muted-foreground">{position?.title ?? "No position"} · {dept?.name ?? "No department"}</p>
        </div>
        {status && <EmploymentStatusBadge label={status.label} isActive={status.is_active_employment} />}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <Can permission={PERMISSIONS.HR_BENEFITS_VIEW}><TabsTrigger value="benefits">Benefits</TabsTrigger></Can>
          <Can permission={PERMISSIONS.HR_EMPLOYEES_VIEW_SALARY}><TabsTrigger value="compensation">Compensation</TabsTrigger></Can>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="lifecycle">Onboarding/Offboarding</TabsTrigger>
          <Can permission={PERMISSIONS.HR_EMPLOYEES_VIEW_SENSITIVE}><TabsTrigger value="history">History</TabsTrigger></Can>
        </TabsList>

        <TabsContent value="overview" className="pt-4"><OverviewTab employee={employee} /></TabsContent>
        <TabsContent value="employment" className="pt-4">
          <EmploymentTab
            employee={employee} departments={departments ?? []} positions={positions ?? []}
            employmentTypes={employmentTypes ?? []} employmentStatuses={employmentStatuses ?? []}
            onSave={async (patch, history) => {
              try {
                await update.mutateAsync({ id: employee.id, patch, history });
                toast.success("Employment details updated");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to update");
              }
            }}
          />
        </TabsContent>
        <TabsContent value="attendance" className="pt-4"><AttendanceTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="leave" className="pt-4"><LeaveTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="timesheets" className="pt-4"><TimesheetsTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="documents" className="pt-4"><DocumentsTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="contracts" className="pt-4"><ContractsTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="benefits" className="pt-4"><BenefitsTab employeeId={employee.id} /></TabsContent>
        <TabsContent value="compensation" className="pt-4"><CompensationTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="requests" className="pt-4"><RequestsTab employeeId={employee.id} companyId={company?.id} /></TabsContent>
        <TabsContent value="lifecycle" className="pt-4"><LifecycleTab employeeId={employee.id} /></TabsContent>
        <TabsContent value="history" className="pt-4"><HistoryTab employeeId={employee.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ employee }: { employee: NonNullable<ReturnType<typeof useEmployee>["data"]> }) {
  const { data: contacts, isLoading } = useEmergencyContacts(employee.id);
  const { upsert, remove } = useEmergencyContactMutations(employee.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await upsert.mutateAsync({ employeeId: employee.id, name, relationship, phone: contactPhone, isPrimary: (contacts ?? []).length === 0 });
      toast.success("Emergency contact added");
      setOpen(false); setName(""); setRelationship(""); setContactPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contact");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card><CardContent className="pt-6">
        <DetailRow label="Preferred name" value={employee.preferred_name ?? "—"} />
        <DetailRow label="Date of birth" value={employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : "—"} />
        <DetailRow label="Gender" value={employee.gender ?? "—"} />
        <DetailRow label="Nationality" value={employee.nationality ?? "—"} />
        <DetailRow label="Marital status" value={employee.marital_status ?? "—"} />
        <DetailRow label="Personal email" value={employee.personal_email ?? "—"} />
        <DetailRow label="Company email" value={employee.company_email ?? "—"} />
        <DetailRow label="Phone" value={employee.phone ?? "—"} />
        <DetailRow label="Alternative phone" value={employee.alternative_phone ?? "—"} />
        <DetailRow label="Address" value={[employee.address, employee.city, employee.province, employee.country].filter(Boolean).join(", ") || "—"} />
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Emergency contacts</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline">+ Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add emergency contact</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Relationship</Label><Input value={relationship} onChange={(e) => setRelationship(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={upsert.isPending}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {isLoading ? <Skeleton className="h-16 w-full" /> : !contacts || contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emergency contacts on file.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">{c.name} {c.is_primary && <span className="text-xs text-primary">(primary)</span>}</p>
                  <p className="text-muted-foreground">{c.relationship} · {c.phone}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function EmploymentTab({ employee, departments, positions, employmentTypes, employmentStatuses, onSave }: {
  employee: NonNullable<ReturnType<typeof useEmployee>["data"]>;
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  employmentTypes: { id: string; label: string }[];
  employmentStatuses: { id: string; label: string }[];
  onSave: (patch: Record<string, unknown>, history: { eventType: string; fieldName: string; previousValue?: string; newValue?: string; reason?: string }) => void;
}) {
  const [departmentId, setDepartmentId] = useState(employee.department_id ?? "");
  const [positionId, setPositionId] = useState(employee.position_id ?? "");
  const [employmentTypeId, setEmploymentTypeId] = useState(employee.employment_type_id ?? "");
  const [employmentStatusId, setEmploymentStatusId] = useState(employee.employment_status_id ?? "");
  const [reason, setReason] = useState("");

  return (
    <Card><CardContent className="pt-6 space-y-4 max-w-lg">
      <DetailRow label="Employee category" value={employee.employee_category ?? "—"} />
      <DetailRow label="Hire date" value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "—"} />
      <DetailRow label="Probation start" value={employee.probation_start_date ?? "—"} />
      <DetailRow label="Probation end" value={employee.probation_end_date ?? "—"} />
      <DetailRow label="Regularization date" value={employee.regularization_date ?? "—"} />
      <DetailRow label="Work location" value={employee.work_location ?? "—"} />

      <Can permission={PERMISSIONS.HR_EMPLOYEES_UPDATE} fallback={null}>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger><SelectValue placeholder="No position" /></SelectTrigger>
              <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select value={employmentTypeId} onValueChange={setEmploymentTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{employmentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment status</Label>
            <Select value={employmentStatusId} onValueChange={setEmploymentStatusId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{employmentStatuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Reason for change (recorded in history)</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button
            onClick={() => {
              const changes: { field: string; label: string; prev: string; next: string }[] = [];
              if (departmentId !== (employee.department_id ?? "")) changes.push({ field: "department_id", label: "DEPARTMENT_CHANGED", prev: employee.department_id ?? "", next: departmentId });
              if (positionId !== (employee.position_id ?? "")) changes.push({ field: "position_id", label: "POSITION_CHANGED", prev: employee.position_id ?? "", next: positionId });
              if (employmentTypeId !== (employee.employment_type_id ?? "")) changes.push({ field: "employment_type_id", label: "EMPLOYMENT_TYPE_CHANGED", prev: employee.employment_type_id ?? "", next: employmentTypeId });
              if (employmentStatusId !== (employee.employment_status_id ?? "")) changes.push({ field: "employment_status_id", label: "EMPLOYMENT_STATUS_CHANGED", prev: employee.employment_status_id ?? "", next: employmentStatusId });
              if (changes.length === 0) { toast.info("No changes to save"); return; }
              const patch = {
                department_id: departmentId || null, position_id: positionId || null,
                employment_type_id: employmentTypeId || null, employment_status_id: employmentStatusId || null,
              };
              onSave(patch, { eventType: changes[0].label, fieldName: changes[0].field, previousValue: changes[0].prev, newValue: changes[0].next, reason });
            }}
          >
            Save changes
          </Button>
        </div>
      </Can>
    </CardContent></Card>
  );
}

function AttendanceTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useAttendance(companyId, { employeeId });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data available.</p>;
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.slice(0, 30).map((a) => (
            <TableRow key={a.id}>
              <TableCell>{new Date(a.attendance_date).toLocaleDateString()}</TableCell>
              <TableCell className="text-muted-foreground">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{a.total_hours ?? "—"}</TableCell>
              <TableCell><AttendanceStatusBadge status={a.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeaveTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useLeaveRequests(companyId, employeeId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data available.</p>;
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((lr) => (
            <TableRow key={lr.id}>
              <TableCell className="font-mono text-xs">{lr.request_number}</TableCell>
              <TableCell className="text-muted-foreground">{lr.start_date} → {lr.end_date}</TableCell>
              <TableCell>{lr.days}</TableCell>
              <TableCell><LeaveRequestStatusBadge status={lr.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TimesheetsTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useTimesheets(companyId, employeeId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data available.</p>;
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Project</TableHead><TableHead>Task</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{new Date(t.work_date).toLocaleDateString()}</TableCell>
              <TableCell className="text-muted-foreground">{t.project_name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{t.task_name ?? "—"}</TableCell>
              <TableCell>{t.hours}</TableCell>
              <TableCell>{t.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DocumentsTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useEmployeeDocuments(employeeId);
  const { upload, remove } = useEmployeeDocumentMutations(employeeId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId || !file) return;
    try {
      await upload.mutateAsync({ companyId, employeeId, documentType: docType as never, title, file, uploadedBy: "" });
      toast.success("Document uploaded");
      setOpen(false); setTitle(""); setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const url = await employeeApi.getEmployeeDocumentSignedUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  return (
    <div className="space-y-3">
      <Can permission={PERMISSIONS.HR_DOCUMENTS_CREATE}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">+ Upload document</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
            <form onSubmit={handleUpload} className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["EMPLOYMENT_CONTRACT", "ID_DOCUMENT", "RESUME", "CERTIFICATE", "TRAINING_CERTIFICATE", "MEDICAL_CERTIFICATE", "GOVERNMENT_DOCUMENT", "TAX_DOCUMENT", "OTHER"].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>File</Label><Input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <DialogFooter><Button type="submit" disabled={upload.isPending}>Upload</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Can>
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents on file.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-muted-foreground">{d.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.expiry_date ?? "—"}</TableCell>
                  <TableCell>{d.status}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(d.storage_path)}>View</Button>
                    <Can permission={PERMISSIONS.HR_DOCUMENTS_DELETE}>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate({ id: d.id, storagePath: d.storage_path })}>Delete</Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ContractsTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useContracts(employeeId);
  const { create, renew } = useContractMutations(employeeId);
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState("FIXED_TERM");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await create.mutateAsync({ companyId, employeeId, contractType: contractType as never, startDate, endDate: endDate || null });
      toast.success("Contract created");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contract");
    }
  };

  return (
    <div className="space-y-3">
      <Can permission={PERMISSIONS.HR_CONTRACTS_CREATE}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">+ New contract</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New employment contract</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Contract type</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["FIXED_TERM", "PERMANENT", "PROBATIONARY", "CONTRACTOR_AGREEMENT"].map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Can>
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts on file.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                  <TableCell className="text-muted-foreground">{c.contract_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{c.start_date} → {c.end_date ?? "—"}</TableCell>
                  <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.HR_CONTRACTS_RENEW}>
                      {(c.status === "ACTIVE" || c.status === "EXPIRING") && (
                        <Button size="sm" variant="outline" onClick={() => renew.mutate({ id: c.id, newEndDate: null })}>Renew</Button>
                      )}
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BenefitsTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useBenefits(employeeId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data available.</p>;
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Provider</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.benefit_type.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-muted-foreground">{b.provider ?? "—"}</TableCell>
              <TableCell>{b.amount != null && b.currency_id ? <Money amount={b.amount} currencyId={b.currency_id} /> : "—"}</TableCell>
              <TableCell>{b.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CompensationTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useCompensationHistory(employeeId);
  const { record } = useCompensationMutations(employeeId);
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [payType, setPayType] = useState("MONTHLY");
  const [basicSalary, setBasicSalary] = useState("");
  const [currencyId, setCurrencyId] = useState("");

  const handleRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId || !currencyId) return;
    try {
      await record.mutateAsync({ companyId, employeeId, effectiveDate, payType: payType as never, basicSalary: Number(basicSalary), currencyId });
      toast.success("Compensation recorded");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record compensation");
    }
  };

  const current = data?.[0];

  return (
    <div className="space-y-3">
      {current && (
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Current salary</p>
          <p className="text-2xl font-semibold text-foreground"><Money amount={current.basic_salary} currencyId={current.currency_id} /></p>
          <p className="text-xs text-muted-foreground">Effective {new Date(current.effective_date).toLocaleDateString()} · {current.pay_type}</p>
        </CardContent></Card>
      )}
      <Can permission={PERMISSIONS.HR_COMPENSATION_CREATE}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">+ Record compensation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record compensation</DialogTitle></DialogHeader>
            <form onSubmit={handleRecord} className="space-y-3">
              <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" required value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Pay type</Label>
                <Select value={payType} onValueChange={setPayType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["MONTHLY", "BIWEEKLY", "WEEKLY", "DAILY", "HOURLY", "PROJECT_BASED"].map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Basic salary</Label><Input type="number" min="0" step="0.01" required value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Currency</Label><CurrencySelect value={currencyId} onChange={setCurrencyId} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={record.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Can>
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No compensation records yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Effective</TableHead><TableHead>Salary</TableHead><TableHead>Pay type</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.effective_date).toLocaleDateString()}</TableCell>
                  <TableCell><Money amount={c.basic_salary} currencyId={c.currency_id} /></TableCell>
                  <TableCell className="text-muted-foreground">{c.pay_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RequestsTab({ employeeId, companyId }: { employeeId: string; companyId: string | undefined }) {
  const { data, isLoading } = useHrRequests(companyId, employeeId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data available.</p>;
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
              <TableCell>{r.subject}</TableCell>
              <TableCell><HrRequestStatusBadge status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LifecycleTab({ employeeId }: { employeeId: string }) {
  const { data: onboarding, isLoading: loadingOn } = useOnboardingTasks(employeeId);
  const { data: offboarding, isLoading: loadingOff } = useOffboardingTasks(employeeId);
  const { startOnboarding, startOffboarding, updateOnboardingTask, updateOffboardingTask } = useLifecycleMutations(employeeId);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Onboarding</h3>
          <Can permission={PERMISSIONS.HR_EMPLOYEES_UPDATE}>
            <Button size="sm" variant="outline" onClick={() => startOnboarding.mutate()} disabled={startOnboarding.isPending || (onboarding?.length ?? 0) > 0}>
              Start onboarding
            </Button>
          </Can>
        </div>
        {loadingOn ? <Skeleton className="h-24 w-full" /> : !onboarding || onboarding.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not started.</p>
        ) : (
          <div className="space-y-2">
            {onboarding.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title} <span className="text-xs text-muted-foreground">({t.department})</span></span>
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={t.status} />
                  {t.status !== "COMPLETED" && (
                    <Button size="sm" variant="ghost" onClick={() => updateOnboardingTask.mutate({ id: t.id, patch: { status: "COMPLETED" } })}>Mark done</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Offboarding</h3>
          <Can permission={PERMISSIONS.HR_EMPLOYEES_UPDATE}>
            <Button size="sm" variant="outline" onClick={() => startOffboarding.mutate(null)} disabled={startOffboarding.isPending || (offboarding?.length ?? 0) > 0}>
              Start offboarding
            </Button>
          </Can>
        </div>
        {loadingOff ? <Skeleton className="h-24 w-full" /> : !offboarding || offboarding.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not started.</p>
        ) : (
          <div className="space-y-2">
            {offboarding.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title} <span className="text-xs text-muted-foreground">({t.department})</span></span>
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={t.status} />
                  {t.status !== "COMPLETED" && (
                    <Button size="sm" variant="ghost" onClick={() => updateOffboardingTask.mutate({ id: t.id, patch: { status: "COMPLETED" } })}>Mark done</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useEmployeeHistory(employeeId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <div className="space-y-3">
      {data.map((h) => (
        <div key={h.id} className="flex gap-3 border-l-2 border-border pl-4 text-sm">
          <div>
            <p className="font-medium text-foreground">{h.event_type.replace(/_/g, " ")}</p>
            {h.field_name && <p className="text-muted-foreground">{h.field_name}: {h.previous_value ?? "—"} → {h.new_value ?? "—"}</p>}
            {h.reason && <p className="text-muted-foreground">Reason: {h.reason}</p>}
            <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
