import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, Package, Printer, Download, Columns3 } from "lucide-react";
import { useAssets } from "@/features/it/inventory/hooks";
import type { EnrichedAsset } from "@/features/it/inventory/inventoryApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AssetStatusBadge, AssetConditionBadge } from "@/components/shared/AssetBadges";
import { Can } from "@/lib/permissions/Can";
import { useCompany as useCompanyCtx } from "@/lib/tenant/useCompany";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { AssetStatus, AssetCondition } from "@/types/database";

const STATUS_OPTIONS: AssetStatus[] = [
  "ACTIVE", "UNASSIGNED", "REPAIR", "DEFECTIVE", "LOST", "DISPOSED", "RETIRED", "RESERVED", "EXPIRED", "CANCELLED", "SUSPENDED",
];
const CONDITION_OPTIONS: AssetCondition[] = ["NEW", "GOOD", "FAIR", "POOR", "DEFECTIVE", "NON_FUNCTIONAL"];

interface Column {
  key: string;
  label: string;
  render: (a: EnrichedAsset) => string;
  cell: (a: EnrichedAsset) => React.ReactNode;
  default: boolean;
}

function assigneeName(a: EnrichedAsset) {
  if (!a.assignee) return "Unassigned";
  return `${a.assignee.first_name ?? ""} ${a.assignee.last_name ?? ""}`.trim() || "Unassigned";
}

const COLUMNS: Column[] = [
  { key: "asset_code", label: "Asset ID", render: (a) => a.asset_code, cell: (a) => <span className="font-mono text-xs font-medium">{a.asset_code}</span>, default: true },
  { key: "asset_type", label: "Type", render: (a) => a.asset_type, cell: (a) => a.asset_type, default: true },
  { key: "category", label: "Category", render: (a) => a.category ?? "", cell: (a) => a.category ?? "—", default: true },
  { key: "name", label: "Name / Model", render: (a) => a.name, cell: (a) => <span className="font-medium">{a.name}</span>, default: true },
  { key: "serial_number", label: "Serial Number", render: (a) => a.serial_number ?? "", cell: (a) => a.serial_number ?? "—", default: true },
  { key: "assignee", label: "Assigned To", render: assigneeName, cell: assigneeName, default: true },
  { key: "department", label: "Department", render: (a) => a.departmentName ?? "", cell: (a) => a.departmentName ?? "—", default: true },
  { key: "purchase_date", label: "Purchase Date", render: (a) => a.purchase_date ?? "", cell: (a) => (a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : "—"), default: true },
  { key: "purchase_price", label: "Price", render: (a) => (a.purchase_price != null ? String(a.purchase_price) : ""), cell: (a) => (a.purchase_price != null ? `${a.currency} ${a.purchase_price.toLocaleString()}` : "—"), default: false },
  { key: "status", label: "Status", render: (a) => a.status, cell: (a) => <AssetStatusBadge status={a.status} />, default: true },
  { key: "condition", label: "Condition", render: (a) => a.condition ?? "", cell: (a) => (a.condition ? <AssetConditionBadge condition={a.condition} /> : "—"), default: true },
  { key: "location", label: "Location", render: (a) => a.location ?? "", cell: (a) => a.location ?? "—", default: false },
  { key: "notes", label: "Notes", render: (a) => a.notes ?? "", cell: (a) => a.notes ?? "—", default: false },
];

export default function AssetListPage({
  presetType,
  presetSoftwareType,
  title,
  description,
}: {
  presetType?: "HARDWARE" | "SOFTWARE";
  presetSoftwareType?: "SUBSCRIPTION" | "ONE_TIME_PURCHASE";
  title: string;
  description: string;
}) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompanyCtx();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(searchParams.get("status") ?? "all");
  const [condition, setCondition] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(COLUMNS.filter((c) => c.default).map((c) => c.key)));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: assets, isLoading } = useAssets(company?.id, {
    search: search || undefined,
    assetType: presetType,
    softwareType: presetSoftwareType,
    status: status === "all" ? undefined : status,
    condition: condition === "all" ? undefined : condition,
    sortBy,
    sortDir,
  });

  const columns = COLUMNS.filter((c) => visibleCols.has(c.key));
  const rows = assets ?? [];

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const header = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) => columns.map((c) => `"${c.render(r).replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const createPath = presetType ? `/c/${companySlug}/it/inventory/new?type=${presetType}` : `/c/${companySlug}/it/inventory/new`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description} · {rows.length} total</p>
        </div>
        <Can permission={PERMISSIONS.IT_INVENTORY_CREATE}>
          <Link to={createPath}>
            <Button>
              <Plus className="h-4 w-4" />
              New asset
            </Button>
          </Link>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search asset ID, serial, name…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Condition" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All conditions</SelectItem>
            {CONDITION_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={`${sortBy}:${sortDir}`} onValueChange={(v) => { const [f, d] = v.split(":"); setSortBy(f); setSortDir(d as "asc" | "desc"); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Newest first</SelectItem>
            <SelectItem value="created_at:asc">Oldest first</SelectItem>
            <SelectItem value="asset_code:asc">Asset ID (A–Z)</SelectItem>
            <SelectItem value="purchase_date:desc">Purchase date (newest)</SelectItem>
            <SelectItem value="purchase_price:desc">Price (highest)</SelectItem>
            <SelectItem value="status:asc">Status</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><Columns3 className="h-3.5 w-3.5" />Columns</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-1">
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <Checkbox checked={visibleCols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex gap-2">
          <Can permission={PERMISSIONS.IT_INVENTORY_PRINT}>
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5" />Print</Button>
          </Can>
          <Can permission={PERMISSIONS.IT_INVENTORY_EXPORT}>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export CSV</Button>
          </Can>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card print:hidden">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title="No assets found" description="Try adjusting your filters, or create a new asset." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {hasPermission(PERMISSIONS.IT_INVENTORY_ASSIGN) && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === rows.length}
                      onCheckedChange={(checked) => setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    />
                  </TableHead>
                )}
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/it/inventory/${a.asset_code}`)}>
                  {hasPermission(PERMISSIONS.IT_INVENTORY_ASSIGN) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleRow(a.id)} />
                    </TableCell>
                  )}
                  {columns.map((c) => <TableCell key={c.key}>{c.cell(a)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Print-only view: shows exactly the selected columns, nothing else on the page. */}
      <div className="hidden print:block">
        <h1 className="mb-1 text-lg font-semibold">{title}</h1>
        <p className="mb-4 text-xs text-muted-foreground">{company?.name} · Printed {new Date().toLocaleDateString()} · {rows.length} items</p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>{columns.map((c) => <th key={c.key} className="border border-gray-300 bg-gray-100 px-2 py-1 text-left">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>{columns.map((c) => <td key={c.key} className="border border-gray-300 px-2 py-1">{c.render(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
