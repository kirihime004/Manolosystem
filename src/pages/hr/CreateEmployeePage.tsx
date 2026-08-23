import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployeeMutations, useEmploymentTypes, useEmploymentStatuses, usePositions } from "@/features/hr/hooks";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CreateEmployeePage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const { create } = useEmployeeMutations(company?.id);
  const { data: departments } = useDepartments(company?.id);
  const { data: positions } = usePositions(company?.id);
  const { data: employmentTypes } = useEmploymentTypes(company?.id);
  const { data: employmentStatuses } = useEmploymentStatuses(company?.id);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const employee = await create.mutateAsync({
        companyId: company.id, firstName: firstName.trim(), lastName: lastName.trim(),
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
        <p className="text-sm text-muted-foreground">The employee ID is generated automatically once saved.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create employee"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
