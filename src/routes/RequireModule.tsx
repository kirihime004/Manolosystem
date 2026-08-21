import type { ReactNode } from "react";
import { useCompany } from "@/lib/tenant/useCompany";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { MODULE_INFO } from "@/lib/modules/moduleInfo";
import type { ModuleKey } from "@/types/database";

// Belt-and-suspenders module gate: even if a disabled module's link is
// hidden from navigation, direct URL access is rejected here on the
// frontend, AND every query against that module's tables is separately
// rejected by has_module_enabled() inside Postgres RLS.
export function RequireModule({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children: ReactNode;
}) {
  const { isModuleEnabled } = useCompany();

  if (!isModuleEnabled(moduleKey)) {
    return (
      <ErrorScreen
        title="Not available"
        description={`${MODULE_INFO[moduleKey].label} is not enabled for this company.`}
      />
    );
  }

  return <>{children}</>;
}
