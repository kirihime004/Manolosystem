import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Network, Plus, Search, Server, KeyRound, Copy } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyMembers } from "@/features/it/tickets/hooks";
import { useIpStats, useIpAddresses, useIpMutations, useAgentTokens, useAgentTokenMutations } from "@/features/it/inventory/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { IpStatusBadge } from "@/components/shared/AssetBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const DEVICE_TYPES = ["DESKTOP", "LAPTOP", "SERVER", "PRINTER", "SWITCH", "ROUTER", "ACCESS_POINT", "CCTV", "NAS", "FIREWALL", "OTHER"];

export default function IpAddressesPage() {
  const { company } = useCompany();
  const { data: members } = useCompanyMembers(company?.id);
  const [search, setSearch] = useState("");
  const { data: stats, isLoading: statsLoading } = useIpStats(company?.id);
  const { data: rows, isLoading } = useIpAddresses(company?.id, search || undefined);
  const { create } = useIpMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [hostname, setHostname] = useState("");
  const [deviceType, setDeviceType] = useState("DESKTOP");
  const [assignedTo, setAssignedTo] = useState("none");

  const [agentOpen, setAgentOpen] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({
        companyId: company.id,
        ipAddress: ip.trim(),
        macAddress: mac || null,
        hostname: hostname || null,
        deviceType,
        assignedTo: assignedTo === "none" ? null : assignedTo,
      });
      toast.success("IP record added");
      setCreateOpen(false);
      setIp(""); setMac(""); setHostname(""); setDeviceType("DESKTOP"); setAssignedTo("none");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add IP record");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">IP Addresses</h1>
          <p className="text-sm text-muted-foreground">Network device inventory and monitoring.</p>
        </div>
        <div className="flex gap-2">
          <Can permission={PERMISSIONS.IT_IP_MANAGE}>
            <Button variant="outline" onClick={() => setAgentOpen(true)}><KeyRound className="h-4 w-4" />Agent tokens</Button>
          </Can>
          <Can permission={PERMISSIONS.IT_IP_UPDATE}>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New record</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New IP record</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5"><Label>IP address</Label><Input required value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.10" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>MAC address</Label><Input value={mac} onChange={(e) => setMac(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hostname</Label><Input value={hostname} onChange={(e) => setHostname(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Device type</Label>
                    <Select value={deviceType} onValueChange={setDeviceType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEVICE_TYPES.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned to</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Add record"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total IPs</CardTitle></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{stats?.total ?? 0}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active</CardTitle></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{stats?.active ?? 0}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Inactive</CardTitle></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{stats?.inactive ?? 0}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Unknown</CardTitle></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{stats?.unknown ?? 0}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-red-500">Conflicts</CardTitle></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-7 w-10" /> : <p className="text-xl font-semibold">{stats?.conflicts ?? 0}</p>}</CardContent></Card>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search hostname, MAC…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !rows || rows.length === 0 ? (
          <EmptyState icon={Network} title="No IP records yet" description="Add devices manually, or connect a ManoloSystem Network Agent." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Device Type</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Assigned User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.ip_address}</TableCell>
                  <TableCell>{r.hostname ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.mac_address ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.device_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{r.asset?.asset_code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.assignee ? `${r.assignee.first_name ?? ""} ${r.assignee.last_name ?? ""}`.trim() : "—"}</TableCell>
                  <TableCell><IpStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{r.last_seen ? new Date(r.last_seen).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AgentTokensDialog open={agentOpen} onOpenChange={setAgentOpen} companyId={company?.id} />
    </div>
  );
}

function AgentTokensDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string | undefined }) {
  const { data: tokens } = useAgentTokens(companyId);
  const { create, revoke } = useAgentTokenMutations(companyId);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const token = await create.mutateAsync(name.trim());
      setCreated(token);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setCreated(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Network Agent tokens</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          A local ManoloSystem Network Agent on your LAN can use one of these tokens to report devices to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">network-agent-ingest</code>. A web app can't scan your private
          network directly — this is the secure channel a local collector process would use.
        </p>

        {created && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium text-foreground">Token created — shown once, copy it now:</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Input readOnly value={created} className="font-mono text-xs" />
              <Button type="button" size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(created); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input placeholder="Token name (e.g. Head Office Agent)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleCreate} disabled={create.isPending || !name.trim()}>Generate</Button>
        </div>

        <div className="space-y-2">
          {(tokens ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.name}</span>
                {t.revoked_at && <span className="text-xs text-muted-foreground">(revoked)</span>}
              </div>
              {!t.revoked_at && (
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(t.id)}>Revoke</Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
