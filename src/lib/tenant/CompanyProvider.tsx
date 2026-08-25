import { createContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import type { Company, CompanyUser, ModuleKey } from "@/types/database";

interface CompanyContextValue {
  company: Company | null;
  companyUser: CompanyUser | null;
  enabledModules: Set<ModuleKey>;
  permissions: Set<string>;
  loading: boolean;
  error: string | null;
  hasPermission: (key: string) => boolean;
  isModuleEnabled: (key: ModuleKey) => boolean;
  refresh: () => void;
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(
  undefined,
);

// Mirrors the parent/child cascade in has_module_enabled() (Postgres) so
// the frontend never shows a leaf module as available when its parent is
// off -- a leaf's own row can say enabled=true and still be inert if the
// parent switch is off, exactly like the backend enforces it.
const MODULE_PARENT: Partial<Record<ModuleKey, ModuleKey>> = {
  TICKETING: "IT",
  INVENTORY: "IT",
  PROCUREMENT: "IT",
  HR_EMPLOYEES: "HR",
  HR_ATTENDANCE_LEAVE: "HR",
  HR_PAYROLL: "HR",
  FINANCE_ACCOUNTING: "FINANCE",
  FINANCE_AP: "FINANCE",
  FINANCE_AR: "FINANCE",
  FINANCE_EXPENSES: "FINANCE",
  FINANCE_BANK: "FINANCE",
  FINANCE_PAYROLL: "FINANCE",
  ADMIN_REQUESTS: "ADMIN",
  ADMIN_FACILITIES: "ADMIN",
  ADMIN_SUPPLIES: "ADMIN",
  ADMIN_ASSETS: "ADMIN",
  ADMIN_VEHICLES: "ADMIN",
  ADMIN_TRAVEL: "ADMIN",
  ADMIN_VISITORS: "ADMIN",
  ADMIN_EVENTS: "ADMIN",
  ADMIN_CONTRACTS: "ADMIN",
  ADMIN_COMMS: "ADMIN",
};

function computeEffectiveModules(rows: { module_key: string; enabled: boolean }[]): Set<ModuleKey> {
  const ownEnabled = new Set(rows.filter((m) => m.enabled).map((m) => m.module_key as ModuleKey));
  const effective = new Set<ModuleKey>();
  for (const key of ownEnabled) {
    const parent = MODULE_PARENT[key];
    if (!parent || ownEnabled.has(parent)) {
      effective.add(key);
    }
  }
  return effective;
}

// Loads the active company for the current /c/{companySlug}/* route and, in
// the same pass, the caller's membership, enabled modules, and effective
// permissions within it.
//
// IMPORTANT: this never trusts the slug alone. `companies` and every table
// queried below is RLS-protected by has_company_access(), so a user who is
// not actually a member of this company (or a Platform Superadmin) simply
// gets zero rows back -- the slug in the URL only decides *which* company we
// attempt to load, never whether the load succeeds.
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, loading: authLoading } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [enabledModules, setEnabledModules] = useState<Set<ModuleKey>>(
    new Set(),
  );
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!companySlug || !user) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data: companyRow, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", companySlug)
        .maybeSingle();

      if (!isMounted) return;

      if (companyError || !companyRow) {
        setError("You do not have access to this company.");
        setLoading(false);
        return;
      }

      if (companyRow.status !== "ACTIVE") {
        setError("This company account is not active.");
        setLoading(false);
        return;
      }

      const [membershipResult, modulesResult, permissionsResult] =
        await Promise.all([
          supabase
            .from("company_users")
            .select("*")
            .eq("company_id", companyRow.id)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("company_modules")
            .select("*")
            .eq("company_id", companyRow.id)
            .eq("enabled", true),
          supabase.rpc("get_my_permission_keys", {
            p_company_id: companyRow.id,
          }),
        ]);

      if (!isMounted) return;

      if (!membershipResult.data) {
        setError("You do not have access to this company.");
        setLoading(false);
        return;
      }

      if (membershipResult.data.status !== "ACTIVE") {
        setError("Your account for this company has been disabled.");
        setLoading(false);
        return;
      }

      setCompany(companyRow as Company);
      setCompanyUser(membershipResult.data as CompanyUser);
      setEnabledModules(computeEffectiveModules(modulesResult.data ?? []));
      setPermissions(new Set((permissionsResult.data ?? []) as string[]));
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [companySlug, user, authLoading, refreshKey]);

  const hasPermission = (key: string) => permissions.has(key);
  const isModuleEnabled = (key: ModuleKey) => enabledModules.has(key);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <CompanyContext.Provider
      value={{
        company,
        companyUser,
        enabledModules,
        permissions,
        loading: loading || authLoading,
        error,
        hasPermission,
        isModuleEnabled,
        refresh,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}
