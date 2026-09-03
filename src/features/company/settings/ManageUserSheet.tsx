import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRoles } from "@/features/company/settings/useRoles";
import { useDepartments } from "@/features/company/settings/useDepartments";
import {
  useAdminSetPassword,
  useDeleteCompanyMembership,
  useUpdateUserRoles,
  useUpdateUserDepartment,
  type CompanyUserRow,
} from "@/features/company/settings/useCompanyUsers";

function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 14);
}

export function ManageUserSheet({
  user,
  companyId,
  open,
  onOpenChange,
  allowDelete = false,
}: {
  user: CompanyUserRow | null;
  companyId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Platform Superadmin only -- Company Admin cannot delete a membership, only disable it. */
  allowDelete?: boolean;
}) {
  const { data: roles } = useRoles(companyId);
  const { data: departments } = useDepartments(companyId);
  const updateRoles = useUpdateUserRoles(companyId);
  const updateDepartment = useUpdateUserDepartment(companyId);
  const setPassword = useAdminSetPassword(companyId);
  const deleteMembership = useDeleteCompanyMembership(companyId);

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [departmentId, setDepartmentId] = useState("none");
  const [newPassword, setNewPassword] = useState(generatePassword);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRoles(new Set(user.roles.map((r) => r.id)));
      setDepartmentId(user.department?.id ?? "none");
    }
    setResetResult(null);
    setNewPassword(generatePassword());
  }, [user]);

  if (!user) return null;

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSaveRoles = async () => {
    try {
      await updateRoles.mutateAsync({ membershipId: user.id, roleIds: [...selectedRoles] });
      toast.success("Roles updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update roles");
    }
  };

  const handleSaveDepartment = async () => {
    try {
      await updateDepartment.mutateAsync({ membershipId: user.id, departmentId: departmentId === "none" ? null : departmentId });
      toast.success("Department updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update department");
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setPassword.mutateAsync({ userId: user.userId, newPassword });
      setResetResult(newPassword);
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMembership.mutateAsync({ membershipId: user!.id });
      toast.success(`${displayName} removed from this company`);
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  const displayName = `${user.profile?.first_name ?? ""} ${user.profile?.last_name ?? ""}`.trim() || "This user";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{displayName}</SheetTitle>
          {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
        </SheetHeader>

        <div className="px-4 pb-6">
          <Tabs defaultValue="roles">
            <TabsList className="w-full">
              <TabsTrigger value="roles" className="flex-1">Roles</TabsTrigger>
              <TabsTrigger value="department" className="flex-1">Department</TabsTrigger>
              <TabsTrigger value="password" className="flex-1">Password</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-1 pt-4">
              {roles?.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox checked={selectedRoles.has(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                  <span className="text-sm">{role.name}</span>
                </label>
              ))}
              <Button
                className="mt-3 w-full"
                onClick={handleSaveRoles}
                disabled={updateRoles.isPending}
              >
                {updateRoles.isPending ? "Saving…" : "Save roles"}
              </Button>
            </TabsContent>

            <TabsContent value="department" className="space-y-3 pt-4">
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
              <Button className="w-full" onClick={handleSaveDepartment} disabled={updateDepartment.isPending}>
                {updateDepartment.isPending ? "Saving…" : "Save department"}
              </Button>
            </TabsContent>

            <TabsContent value="password" className="space-y-4 pt-4">
              {resetResult ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share this new password with {displayName} yourself — it won't be shown again.
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
                    <span>{resetResult}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setResetResult(null)}>
                    Set another password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSetPassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNewPassword(generatePassword())}
                        title="Generate a new password"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={setPassword.isPending}>
                    {setPassword.isPending ? "Updating…" : "Set new password"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />
          <p className="text-xs text-muted-foreground">
            The user can also change their own password anytime from Account settings.
          </p>

          {allowDelete && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Danger zone</p>
                <p className="text-xs text-muted-foreground">
                  Removes {displayName} from this company only. Their account and any other company
                  memberships are unaffected.
                </p>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  Remove from company
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {displayName} from this company?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes their membership, roles, and department assignment for this company. Their
              account and any other company memberships are unaffected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
