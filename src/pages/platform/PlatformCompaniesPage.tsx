import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreateCompanyDialog } from "@/features/platform/CreateCompanyDialog";
import { CompanyDetailSheet } from "@/features/platform/CompanyDetailSheet";
import type { Company, CompanyStatus } from "@/types/database";

const STATUS_VARIANT: Record<CompanyStatus, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
  INACTIVE: "secondary",
};

export default function PlatformCompaniesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Company | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["platform-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompanyStatus }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
      queryClient.invalidateQueries({ queryKey: ["platform-dashboard-stats"] });
      toast.success("Company updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Create tenants, manage their modules, and provision Company Admins.
          </p>
        </div>
        <CreateCompanyDialog />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !companies || companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Create your first company to get started."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(company);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="font-mono text-xs">{company.code}</TableCell>
                  <TableCell className="text-muted-foreground">/c/{company.slug}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[company.status]}>{company.status}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelected(company);
                            setSheetOpen(true);
                          }}
                        >
                          Manage
                        </DropdownMenuItem>
                        {company.status === "ACTIVE" ? (
                          <DropdownMenuItem
                            onClick={() => setStatus.mutate({ id: company.id, status: "SUSPENDED" })}
                          >
                            Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setStatus.mutate({ id: company.id, status: "ACTIVE" })}
                          >
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CompanyDetailSheet company={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
