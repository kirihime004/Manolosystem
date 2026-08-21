import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CompanyProvider } from "@/lib/tenant/CompanyProvider";
import { useCompany } from "@/lib/tenant/useCompany";
import { RequireAuth } from "@/routes/RequireAuth";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

function CompanyGate({ children }: { children: ReactNode }) {
  const { loading, error, company } = useCompany();

  if (loading) return <LoadingScreen />;
  if (error || !company) {
    return (
      <ErrorScreen
        title="Access denied"
        description={error ?? "You do not have access to this company."}
      />
    );
  }

  return <>{children}</>;
}

export function RequireCompanyAccess({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();

  return (
    <RequireAuth redirectTo={`/c/${companySlug}/login`}>
      <CompanyProvider>
        <CompanyGate>{children}</CompanyGate>
      </CompanyProvider>
    </RequireAuth>
  );
}

export function RequireCompanySlug({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  if (!companySlug) return <Navigate to="/company" replace />;
  return <>{children}</>;
}
