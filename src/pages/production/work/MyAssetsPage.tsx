import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Shapes, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useTasks, useProjects, useAssetsByIds } from "@/features/production/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";

const CATEGORIES = ["CHARACTER", "PROP", "ENVIRONMENT", "VEHICLE", "RIG", "EFFECT", "OTHER"] as const;

export default function MyAssetsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: myTasks } = useTasks(company?.id, { assignedTo: myEmployee?.id });
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const myAssetIds = [...new Set((myTasks ?? []).map((t) => t.asset_id).filter((id): id is string => !!id))];
  const { data: assets, isLoading } = useAssetsByIds(myAssetIds);

  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = (assets ?? []).filter((a) => {
    if (categoryFilter !== "__all__" && a.asset_category !== categoryFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const effectiveSelectedId = selectedId ?? filtered[0]?.id ?? null;
  const selected = (assets ?? []).find((a) => a.id === effectiveSelectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Assets</h1>
        <p className="text-sm text-muted-foreground">Assets tied to tasks assigned to you, across every project</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["__all__", ...CATEGORIES] as const).map((cat) => {
          const count = cat === "__all__" ? (assets ?? []).length : (assets ?? []).filter((a) => a.asset_category === cat).length;
          return (
            <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} onClick={() => setCategoryFilter(cat)}>
              {cat === "__all__" ? "All Assets" : cat.charAt(0) + cat.slice(1).toLowerCase()} ({count})
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-48 pl-8" placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex rounded-md border border-border">
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-r-none ${viewMode === "grid" ? "bg-muted" : ""}`} onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-l-none ${viewMode === "list" ? "bg-muted" : ""}`} onClick={() => setViewMode("list")}><ListIcon className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Shapes} title="No assets yet" description="Assets tied to your assigned tasks will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2 xl:grid-cols-4" : "space-y-2 lg:col-span-2"}>
            {filtered.map((a) => {
              const isSelected = effectiveSelectedId === a.id;
              return viewMode === "grid" ? (
                <button key={a.id} onClick={() => setSelectedId(a.id)} className={`rounded-lg border text-left transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                  <div className="flex aspect-square items-center justify-center rounded-t-lg bg-muted/40"><Shapes className="h-8 w-8 text-muted-foreground" /></div>
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium text-foreground" title={a.name}>{a.name}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] text-muted-foreground">{a.asset_code}</span>
                      <ProductionStatusBadge status={a.status} />
                    </div>
                  </div>
                </button>
              ) : (
                <button key={a.id} onClick={() => setSelectedId(a.id)} className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted/40"><Shapes className="h-5 w-5 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{a.asset_code} · {projectMap.get(a.project_id) ?? "—"}</p>
                  </div>
                  <ProductionStatusBadge status={a.status} />
                </button>
              );
            })}
          </div>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardContent className="space-y-3 pt-6">
              {!selected ? (
                <p className="text-xs text-muted-foreground">Select an asset to see its details.</p>
              ) : (
                <>
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/40"><Shapes className="h-10 w-10 text-muted-foreground" /></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{selected.asset_code}</p>
                      <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                    </div>
                    <ProductionStatusBadge status={selected.status} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Project</span><span className="text-foreground">{projectMap.get(selected.project_id) ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Category</span><span className="text-foreground">{selected.asset_category}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Updated</span><span className="text-foreground">{selected.updated_at.slice(0, 10)}</span></div>
                  </div>
                  {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to={`/c/${companySlug}/production/assets/${selected.id}`}>Open full details</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
