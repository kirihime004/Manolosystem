import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, PauseCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("status");
      if (error) throw error;
      return {
        total: data.length,
        active: data.filter((c) => c.status === "ACTIVE").length,
        suspended: data.filter((c) => c.status === "SUSPENDED").length,
      };
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Manage every company on Mindburst from one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Total companies" value={data?.total} loading={isLoading} />
        <StatCard icon={CheckCircle2} label="Active" value={data?.active} loading={isLoading} />
        <StatCard icon={PauseCircle} label="Suspended" value={data?.suspended} loading={isLoading} />
      </div>

      <Link
        to="/platform/companies"
        className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
      >
        Manage companies
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-semibold">{value ?? 0}</p>}
      </CardContent>
    </Card>
  );
}
