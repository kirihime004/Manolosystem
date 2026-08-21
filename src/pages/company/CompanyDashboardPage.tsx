import { Link, useParams } from "react-router-dom";
import { Ticket, Users, DollarSign, Building2, Clapperboard, ArrowRight, type LucideIcon } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModuleKey } from "@/types/database";

const MODULE_INFO: Record<ModuleKey, { label: string; description: string; icon: LucideIcon; path: string }> = {
  IT: { label: "IT", description: "Ticketing, assets, and technical support", icon: Ticket, path: "it" },
  HR: { label: "HR", description: "Employees, attendance, and leave", icon: Users, path: "hr" },
  FINANCE: { label: "Finance", description: "Invoices, expenses, and budgets", icon: DollarSign, path: "finance" },
  ADMIN: { label: "Administration", description: "Assets, suppliers, and purchasing", icon: Building2, path: "admin" },
  PRODUCTION: { label: "Production", description: "Shots, tasks, and reviews", icon: Clapperboard, path: "production" },
};

export default function CompanyDashboardPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, enabledModules } = useCompany();
  const { user } = useAuth();

  const enabled = (Object.keys(MODULE_INFO) as ModuleKey[]).filter((k) => enabledModules.has(k));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back{user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{company?.name}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Your modules</h2>
        {enabled.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No modules are enabled for your company yet. Contact your company administrator.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enabled.map((key) => {
              const m = MODULE_INFO[key];
              return (
                <Link key={key} to={`/c/${companySlug}/${m.path}`}>
                  <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <m.icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-base">{m.label}</CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{m.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
