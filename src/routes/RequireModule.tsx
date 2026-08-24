import type { ReactNode } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { MODULE_INFO } from "@/lib/modules/moduleInfo";
import type { ModuleKey } from "@/types/database";

// Belt-and-suspenders module gate: even if a disabled module's link is
// hidden from navigation, direct URL access is rejected here on the
// frontend, AND every query against that module's tables is separately
// rejected by has_module_enabled() inside Postgres RLS (which applies the
// same parent/child cascade -- a leaf module's own toggle being on isn't
// enough if its parent is off).
//
// Pass an array to require ANY of several keys -- used for a route that
// spans multiple sub-modules (e.g. the HR dashboard, reachable as long as
// at least one of Employees/Attendance & Leave/Payroll is enabled).
export function RequireModule({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey | ModuleKey[];
  children: ReactNode;
}) {
  const { isModuleEnabled } = useCompany();
  const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
  const allowed = keys.some(isModuleEnabled);

  if (!allowed) {
    return (
      <ErrorScreen
        title="Not available"
        description={`${MODULE_INFO[keys[0]].label} is not enabled for this company.`}
      />
    );
  }

  return <>{children}</>;
}
