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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles } from "@/features/company/settings/useRoles";
import {
  useAdminSetPassword,
  useUpdateUserRoles,
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
}: {
  user: CompanyUserRow | null;
  companyId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: roles } = useRoles(companyId);
  const updateRoles = useUpdateUserRoles(companyId);
  const setPassword = useAdminSetPassword(companyId);

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [newPassword, setNewPassword] = useState(generatePassword);
  const [resetResult, setResetResult] = useState<string | null>(null);

  useEffect(() => {
    if (user) setSelectedRoles(new Set(user.roles.map((r) => r.id)));
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

  const displayName = `${user.profile?.first_name ?? ""} ${user.profile?.last_name ?? ""}`.trim() || "This user";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{displayName}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6">
          <Tabs defaultValue="roles">
            <TabsList className="w-full">
              <TabsTrigger value="roles" className="flex-1">Roles</TabsTrigger>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
