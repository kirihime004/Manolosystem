import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useCompanyUsersList,
  useToggleUserStatus,
  type CompanyUserRow,
} from "@/features/company/settings/useCompanyUsers";
import { InviteEmployeeDialog } from "@/features/company/settings/InviteEmployeeDialog";
import { ManageUserSheet } from "@/features/company/settings/ManageUserSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { MembershipStatus } from "@/types/database";

const STATUS_VARIANT: Record<MembershipStatus, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  INVITED: "secondary",
  DISABLED: "destructive",
};

function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function UsersPage() {
  const { company } = useCompany();
  const { data: users, isLoading } = useCompanyUsersList(company?.id);
  const toggleStatus = useToggleUserStatus(company?.id);

  const [managing, setManaging] = useState<CompanyUserRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleToggle = async (membershipId: string, current: MembershipStatus) => {
    const next = current === "DISABLED" ? "ACTIVE" : "DISABLED";
    try {
      await toggleStatus.mutateAsync({ membershipId, status: next });
      toast.success(next === "DISABLED" ? "User disabled" : "User re-enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to {company?.name}. Click a user to edit roles or reset their password.
          </p>
        </div>
        <InviteEmployeeDialog companyId={company?.id} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !users || users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setManaging(u);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(u.profile?.first_name, u.profile?.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {u.profile ? `${u.profile.first_name ?? ""} ${u.profile.last_name ?? ""}`.trim() || "—" : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.department?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r.id} variant="outline">{r.name}</Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[u.status]}>{u.status}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {u.status !== "INVITED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(u.id, u.status)}
                        disabled={toggleStatus.isPending}
                      >
                        {u.status === "DISABLED" ? "Enable" : "Disable"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ManageUserSheet user={managing} companyId={company?.id} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
