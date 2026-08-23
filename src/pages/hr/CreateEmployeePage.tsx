import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployeeMutations, useEmploymentTypes, useEmploymentStatuses, usePositions, useEmployees } from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useCompanyUsersList } from "@/features/company/settings/useCompanyUsers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserCog } from "lucide-react";

export default function CreateEmployeePage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const { create } = useEmployeeMutations(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { data: positions } = usePositions(company?.id);
  const { data: employmentTypes } = useEmploymentTypes(company?.id);
  const { data: employmentStatuses } = useEmploymentStatuses(company?.id);
  const { data: companyUsers, isLoading: loadingUsers } = useCompanyUsersList(company?.id);
  const { data: employees } = useEmployees(company?.id);

  // Every employee must be linked to an existing MindBurst account,
  // provisioned through the IT/Admin invite flow -- HR doesn't create
  // login accounts itself. Accounts already linked to another employee
  // are excluded so one account can never back two employee records.
  const linkedUserIds = useMemo(() => new Set((employees ?? []).map((e) => e.user_id).filter((id): id is string => !!id)), [employees]);
  const availableUsers = useMemo(
    () => (companyUsers ?? []).filter((u) => u.status === "ACTIVE" && !linkedUserIds.has(u.userId)),
    [companyUsers, linkedUserIds],
  );

  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [positionId, setPositionId] = useState<string>("");
  const [employmentTypeId, setEmploymentTypeId] = useState<string>("");
  const [employmentStatusId, setEmploymentStatusId] = useState<string>("");
  const [hireDate, setHireDate] = useState("");

  const handleSelectUser = (id: string) => {
    setUserId(id);
    const account = availableUsers.find((u) => u.userId === id);
    if (account) {
      setFirstName((prev) => prev || account.profile?.first_name || "");
      setLastName((prev) => prev || account.profile?.last_name || "");
      setCompanyEmail((prev) => prev || account.email || "");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !userId) return;
    try {
      const employee = await create.mutateAsync({
        companyId: company.id, userId, firstName: firstName.trim(), lastName: lastName.trim(),
        companyEmail: companyEmail || null, personalEmail: personalEmail || null, phone: phone || null,
        departmentId: departmentId || null, positionId: positionId || null,
        employmentTypeId: employmentTypeId || null, employmentStatusId: employmentStatusId || null,
        hireDate: hireDate || null,
      });
      toast.success(`${employee.employee_number} created`);
      navigate(`/c/${companySlug}/hr/employees/${employee.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create employee");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">New employee</h1>
        <p className="text-sm text-muted-foreground">The employee ID is generated automatically once saved. Every employee must be linked to an existing user account.</p>
      </div>

      {!loadingUsers && availableUsers.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No available accounts"
          description="Every account is already linked to an employee, or none exist yet. Invite one from Settings → Users first."
          action={<Button asChild variant="outline"><Link to={`/c/${companySlug}/settings/users`}>Go to Users</Link></Button>}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label>User account</Label>
                <Select value={userId} onValueChange={handleSelectUser}>
                  <SelectTrigger><SelectValue placeholder={loadingUsers ? "Loading accounts…" : "Select an account"} /></SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.userId} value={u.userId}>
                        {u.profile?.first_name || u.profile?.last_name ? `${u.profile?.first_name ?? ""} ${u.profile?.last_name ?? ""}`.trim() : u.email} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Accounts are created by IT/Admin under Settings → Users, not here.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>First name</Label><Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Last name</Label><Input required value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Company email</Label><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Personal email</Label><Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hire date</Label><Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={positionId} onValueChange={setPositionId}>
                    <SelectTrigger><SelectValue placeholder="No position" /></SelectTrigger>
                    <SelectContent>{(positions ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Employment type</Label>
                  <Select value={employmentTypeId} onValueChange={setEmploymentTypeId}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{(employmentTypes ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Employment status</Label>
                  <Select value={employmentStatusId} onValueChange={setEmploymentStatusId}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>{(employmentStatuses ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending || !userId}>{create.isPending ? "Creating…" : "Create employee"}</Button>
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
