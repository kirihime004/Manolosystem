import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw } from "lucide-react";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useRoles } from "@/features/company/settings/useRoles";
import { useInviteEmployee } from "@/features/company/settings/useCompanyUsers";
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

// Cryptographically-adequate-enough temporary password: readable-ish,
// generated client-side just for convenience -- the admin is expected to
// relay it out-of-band, and the employee should change it on first login.
function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 14);
}

export function InviteEmployeeDialog({ companyId }: { companyId: string | undefined }) {
  const { data: departments } = useDepartments(companyId);
  const { data: roles } = useRoles(companyId);
  const invite = useInviteEmployee(companyId);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"invite" | "direct">("invite");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState(generatePassword);

  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setDepartmentId("none");
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await invite.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        departmentId: departmentId === "none" ? null : departmentId,
        roleIds: [...selectedRoles],
        mode,
        password: mode === "direct" ? password : undefined,
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite employee</DialogTitle>
          </DialogHeader>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First name</Label>
                <Input id="invite-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last name</Label>
                <Input id="invite-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
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

            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
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
