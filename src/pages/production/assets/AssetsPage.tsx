import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Shapes } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProjects, useAssets, useAssetMutations } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CATEGORIES = ["CHARACTER", "PROP", "ENVIRONMENT", "VEHICLE", "RIG", "EFFECT", "OTHER"];

export default function AssetsPage() {
  const { company } = useCompany();
  const { data: projects } = useProjects(company?.id);
  const [projectId, setProjectId] = useState<string>("");
  const activeProjectId = projectId || projects?.[0]?.id;

  const { data: assets, isLoading } = useAssets(activeProjectId);
  const { create } = useAssetMutations(activeProjectId);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("PROP");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    try {
      await create.mutateAsync({ companyId: company!.id, projectId: activeProjectId, name, assetCategory: category });
      toast.success("Asset created");
      setOpen(false); setName("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create asset"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">Characters, props, environments, and rigs</p>
        </div>
        <Can permission={PERMISSIONS.PRODUCTION_ASSETS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={!activeProjectId}>+ New asset</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New asset</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <Select value={activeProjectId ?? ""} onValueChange={setProjectId}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Select a project…" /></SelectTrigger>
        <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>

      <div className="rounded-lg border border-border bg-card">
        {!activeProjectId ? (
          <EmptyState icon={Shapes} title="No projects yet" description="Create a project first." />
        ) : isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !assets || assets.length === 0 ? (
          <EmptyState icon={Shapes} title="No assets yet" description="Add an asset to start tracking its build pipeline." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs"><Link to={a.id} className="hover:underline">{a.asset_code}</Link></TableCell>
                  <TableCell className="font-medium"><Link to={a.id} className="hover:underline">{a.name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{a.asset_category}</TableCell>
                  <TableCell><ProductionStatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
