import type { ReactNode } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import type { PermissionKey } from "@/lib/permissions/keys";

interface CanProps {
  permission: PermissionKey | PermissionKey[];
  /** When multiple permissions are passed, require all of them (default: any). */
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

// Client-side visibility gate only. The corresponding Postgres RLS policy
// (see supabase/migrations) is the actual enforcement point -- this
// component exists purely so the UI doesn't offer actions the backend would
// reject anyway.
export function Can({ permission, requireAll = false, fallback = null, children }: CanProps) {
  const { hasPermission } = useCompany();
  const keys = Array.isArray(permission) ? permission : [permission];
  const allowed = requireAll ? keys.every(hasPermission) : keys.some(hasPermission);

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
