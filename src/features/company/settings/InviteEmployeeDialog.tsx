import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw } from "lucide-react";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useRoles } from "@/features/company/settings/useRoles";
import { useInviteEmployee, type InviteEmployeeLink } from "@/features/company/settings/useCompanyUsers";
import { useEmployees, usePositions, useEmploymentTypes, useEmploymentStatuses } from "@/features/hr/hooks";
import { generatePassword } from "@/lib/generatePassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteEmployeeDialog({ companyId }: { companyId: string | undefined }) {
  const { data: departments } = useDepartments(companyId);
  const { data: roles } = useRoles(companyId);
  const { data: employees } = useEmployees(companyId);
  const { data: positions } = usePositions(companyId);
  const { data: employmentTypes } = useEmploymentTypes(companyId);
  const { data: employmentStatuses } = useEmploymentStatuses(companyId);
  const invite = useInviteEmployee(companyId);

  // Every account gets an employee record, one way or another -- either
  // linked to one that already exists with no login yet (e.g. bulk-imported
  // from Excel, or entered by HR before the person's account was set up),
  // or created here alongside the account. No account is ever left dangling
  // with no HR record behind it.
  const unlinkedEmployees = useMemo(() => (employees ?? []).filter((e) => !e.user_id), [employees]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"invite" | "direct">("invite");
  const [employeeMode, setEmployeeMode] = useState<"new" | "existing">("new");
  const [existingEmployeeId, setExistingEmployeeId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [positionId, setPositionId] = useState<string>("none");
  const [employmentTypeId, setEmploymentTypeId] = useState<string>("none");
  const [employmentStatusId, setEmploymentStatusId] = useState<string>("none");
  const [hireDate, setHireDate] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState(generatePassword);

  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setDepartmentId("none");
    setPositionId("none");
    setEmploymentTypeId("none");
    setEmploymentStatusId("none");
    setHireDate("");
    setEmployeeMode("new");
    setExistingEmployeeId("");
    setSelectedRoles(new Set());
    setPassword(generatePassword());
    setMode("invite");
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSelectExistingEmployee = (id: string) => {
    setExistingEmployeeId(id);
    const emp = unlinkedEmployees.find((e) => e.id === id);
    if (emp) {
      setFirstName((prev) => prev || emp.first_name);
      setLastName((prev) => prev || emp.last_name);
      setEmail((prev) => prev || emp.company_email || emp.personal_email || "");
    }
  };

  const employeeLinkReady = employeeMode === "new" || !!existingEmployeeId;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!employeeLinkReady) return;

    const employeeLink: InviteEmployeeLink =
      employeeMode === "existing"
        ? { mode: "existing", employeeId: existingEmployeeId }
        : {
            mode: "new",
            positionId: positionId === "none" ? null : positionId,
            employmentTypeId: employmentTypeId === "none" ? null : employmentTypeId,
            employmentStatusId: employmentStatusId === "none" ? null : employmentStatusId,
            hireDate: hireDate || null,
          };

    try {
      await invite.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        departmentId: departmentId === "none" ? null : departmentId,
        roleIds: [...selectedRoles],
        mode,
        password: mode === "direct" ? password : undefined,
        employee: employeeLink,
      });

      if (mode === "direct") {
        setCreatedCreds({ email: email.trim(), password });
      } else {
        toast.success(`Invitation sent to ${email}`);
        setOpen(false);
      }
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add employee");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Invite employee
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Invite employee</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "invite" | "direct")}>
              <TabsList className="w-full">
                <TabsTrigger value="invite" className="flex-1">Email invite</TabsTrigger>
                <TabsTrigger value="direct" className="flex-1">Create directly</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {mode === "invite"
                ? "Sends an email with a link to set their own password."
                : "Creates the account now with the password below — no email sent. Share it with them yourself."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First name</Label>
                <Input id="invite-first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last name</Label>
                <Input id="invite-last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {mode === "direct" && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-password">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPassword(generatePassword())}
                    title="Generate a new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label>Employee record</Label>
              <p className="text-xs text-muted-foreground">Every account is linked to an HR employee record — pick an existing one or create it here.</p>
              <Tabs value={employeeMode} onValueChange={(v) => setEmployeeMode(v as "new" | "existing")}>
                <TabsList className="w-full">
                  <TabsTrigger value="new" className="flex-1">Create new employee</TabsTrigger>
                  <TabsTrigger value="existing" className="flex-1" disabled={unlinkedEmployees.length === 0}>
                    Link existing employee {unlinkedEmployees.length > 0 ? `(${unlinkedEmployees.length})` : ""}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {employeeMode === "existing" ? (
                <div className="space-y-1.5 pt-1">
                  <Select value={existingEmployeeId} onValueChange={handleSelectExistingEmployee}>
                    <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                    <SelectContent>
                      {unlinkedEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.employee_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Position</Label>
                      <Select value={positionId} onValueChange={setPositionId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No position</SelectItem>
                          {positions?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employment type</Label>
                      <Select value={employmentTypeId} onValueChange={setEmploymentTypeId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {employmentTypes?.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Employment status</Label>
                      <Select value={employmentStatusId} onValueChange={setEmploymentStatusId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {employmentStatuses?.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hire date</Label>
                      <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Roles</Label>
              <div className="space-y-1 rounded-md border border-border p-2">
                {roles?.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                  >
                    <Checkbox checked={selectedRoles.has(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                    <span className="text-sm">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

            <DialogFooter>
              <Button type="submit" disabled={invite.isPending || !employeeLinkReady}>
                {invite.isPending
                  ? mode === "direct" ? "Creating…" : "Sending invite…"
                  : mode === "direct" ? "Create account" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdCreds} onOpenChange={(open) => !open && setCreatedCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share these credentials with {createdCreds?.email} yourself — they won't be shown again.
          </p>
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{createdCreds?.email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{createdCreds?.password}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (createdCreds) navigator.clipboard.writeText(createdCreds.password);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
