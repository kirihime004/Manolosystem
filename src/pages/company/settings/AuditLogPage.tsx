import { Fragment, useState } from "react";
import { ScrollText, ChevronDown, ChevronRight } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuditLog, useAuditLogResourceTypes } from "@/features/company/settings/useAuditLog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

function actorName(actor: { first_name: string | null; last_name: string | null } | null) {
  if (!actor) return "System";
  return `${actor.first_name ?? ""} ${actor.last_name ?? ""}`.trim() || "Unknown";
}

export default function AuditLogPage() {
  const { company } = useCompany();
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [limit, setLimit] = useState(100);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: entries, isLoading } = useAuditLog(company?.id, {
    action: action || undefined,
    resourceType: resourceType || undefined,
    limit,
  });
  const { data: resourceTypes } = useAuditLogResourceTypes(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">A permanent, read-only record of who did what across this company.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-56"
        />
        <Select value={resourceType || "all"} onValueChange={(v) => setResourceType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All resource types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resource types</SelectItem>
            {(resourceTypes ?? []).map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState icon={ScrollText} title="No matching events" description="Nothing on record for these filters yet." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const expanded = expandedId === e.id;
                  const hasMetadata = e.metadata && Object.keys(e.metadata).length > 0;
                  return (
                    <Fragment key={e.id}>
                      <TableRow
                        className={hasMetadata ? "cursor-pointer" : undefined}
                        onClick={() => hasMetadata && setExpandedId(expanded ? null : e.id)}
                      >
                        <TableCell>
                          {hasMetadata && (expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                        <TableCell>{actorName(e.actor)}</TableCell>
                        <TableCell className="font-medium">{e.action.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.resource_type.replace(/_/g, " ")}
                          {e.resource_id && <span className="ml-1 font-mono text-xs">#{e.resource_id.slice(0, 8)}</span>}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={4} className="bg-muted/30">
                            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {entries.length >= limit && (
              <div className="flex justify-center border-t border-border p-3">
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>Load more</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
