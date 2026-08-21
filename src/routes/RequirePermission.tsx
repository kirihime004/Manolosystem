import type { ReactNode } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import type { PermissionKey } from "@/lib/permissions/keys";

// Route-level version of <Can>: blocks navigation to an entire settings
// screen outright rather than hiding a button. The real enforcement is
// still the RLS policy on whatever table the page reads/writes -- this
// only stops someone without the permission from staring at an empty
// admin screen that every mutation on it would reject anyway.
export function RequirePermission({
  permission,
  requireAll = false,
  children,
}: {
  permission: PermissionKey | PermissionKey[];
  requireAll?: boolean;
  children: ReactNode;
}) {
  const { hasPermission } = useCompany();
  const keys = Array.isArray(permission) ? permission : [permission];
  const allowed = requireAll ? keys.every(hasPermission) : keys.some(hasPermission);

  if (!allowed) {
    return (
      <ErrorScreen
        title="Access denied"
        description="You don't have permission to view this page."
      />
    );
  }

  return <>{children}</>;
}
