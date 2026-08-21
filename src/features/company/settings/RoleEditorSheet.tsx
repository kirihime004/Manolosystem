import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  usePermissionsCatalog,
  useRoleMutations,
  useRolePermissionIds,
} from "@/features/company/settings/useRoles";
import type { Role } from "@/types/database";

export function RoleEditorSheet({
  role,
  companyId,
  open,
  onOpenChange,
}: {
  role: Role | null;
  companyId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: permissions } = usePermissionsCatalog();
  const { data: assignedIds } = useRolePermissionIds(role?.id);
  const { update, setPermissions } = useRoleMutations(companyId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description ?? "");
    }
  }, [role]);

  useEffect(() => {
    if (assignedIds) setSelected(new Set(assignedIds));
  }, [assignedIds]);

  if (!role) return null;

  const grouped = new Map<string, typeof permissions>();
  for (const p of permissions ?? []) {
    if (!grouped.has(p.module_key)) grouped.set(p.module_key, []);
    grouped.get(p.module_key)!.push(p);
  }

  const toggle = (permissionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const handleSaveDetails = async () => {
    try {
      await update.mutateAsync({ id: role.id, name: name.trim(), description: description.trim() || null });
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleSavePermissions = async () => {
    try {
      await setPermissions.mutateAsync({ roleId: role.id, permissionIds: [...selected] });
      toast.success("Permissions updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {role.name}
            {role.is_system && <Badge variant="secondary">System</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                disabled={role.is_system}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {!role.is_system && (
              <Button size="sm" variant="outline" onClick={handleSaveDetails} disabled={update.isPending}>
                Save details
              </Button>
            )}
            {role.is_system && (
              <p className="text-xs text-muted-foreground">
                System role names can't be changed, but you can still edit its permissions below.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-5">
            <p className="text-sm font-medium text-foreground">Permissions</p>
            {[...grouped.entries()].map(([moduleKey, perms]) => (
              <div key={moduleKey} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {moduleKey}
                </p>
                <div className="space-y-1.5">
                  {perms?.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{p.key}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleSavePermissions} disabled={setPermissions.isPending}>
            {setPermissions.isPending ? "Saving…" : "Save permissions"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
