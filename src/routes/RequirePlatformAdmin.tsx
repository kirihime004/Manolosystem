import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { RequireAuth } from "@/routes/RequireAuth";
import { usePlatformAdmin } from "@/lib/auth/usePlatformAdmin";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

function PlatformAdminGate({ children }: { children: ReactNode }) {
  const { isPlatformAdmin, isLoading } = usePlatformAdmin();

  if (isLoading) return <LoadingScreen />;

  // A Company Admin (or any other company-level role) must never be able to
  // reach platform routes just by being authenticated -- this check is
  // backed by is_platform_superadmin(), the same SECURITY DEFINER function
  // every platform-scoped RLS policy uses server-side.
  if (!isPlatformAdmin) {
    return <Navigate to="/platform/login" replace />;
  }

  return <>{children}</>;
}

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth redirectTo="/platform/login">
      <PlatformAdminGate>{children}</PlatformAdminGate>
    </RequireAuth>
  );
}
