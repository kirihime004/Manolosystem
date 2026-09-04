import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Eye, EyeOff, Copy, Search, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyMembers } from "@/features/it/tickets/hooks";
import { useCredentials, useCredentialMutations } from "@/features/it/inventory/hooks";
import type { EnrichedCredential } from "@/features/it/inventory/credentialsApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CATEGORIES = ["NETWORK", "SERVER", "EMAIL", "CLOUD", "SOFTWARE", "DATABASE", "DOMAIN", "PRINTER", "SECURITY", "OTHER"];

export default function CredentialsPage() {
  const { company, hasPermission } = useCompany();
  const { data: members } = useCompanyMembers(company?.id);
  const [search, setSearch] = useState("");
  const { data: credentials, isLoading } = useCredentials(company?.id, search || undefined);
  const { create, remove, setSecret } = useCredentialMutations();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [system, setSystem] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [owner, setOwner] = useState("none");
  const [notes, setNotes] = useState("");
  const [initialSecret, setInitialSecret] = useState("");

  const [detail, setDetail] = useState<EnrichedCredential | null>(null);

  const resetForm = () => {
    setName(""); setSystem(""); setUrl(""); setUsername(""); setCategory("OTHER"); setOwner("none"); setNotes(""); setInitialSecret("");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const credential = await create.mutateAsync({
        companyId: company.id,
        credentialName: name.trim(),
        system: system.trim(),
        url: url || null,
        username: username || null,
        category,
        assignedOwner: owner === "none" ? null : owner,
        notes: notes || null,
      });
      if (initialSecret) {
        await setSecret.mutateAsync({ companyId: company.id, credentialId: credential.id, secret: initialSecret });
      }
      toast.success(`${credential.credential_code} created`);
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create credential");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Credential deleted");
      setDetail(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete credential");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Credentials</h1>
          <p className="text-sm text-muted-foreground">System logins, stored encrypted. Passwords are never shown by default.</p>
        </div>
        <Can permission={PERMISSIONS.IT_CREDENTIALS_CREATE}>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" />New credential</Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
              <DialogHeader><DialogTitle>New credential</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
                <div className="space-y-1.5"><Label>Credential name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main office router" /></div>
                <div className="space-y-1.5"><Label>System</Label><Input required value={system} onChange={(e) => setSystem(e.target.value)} placeholder="e.g. Firewall, Email admin" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Owner</Label>
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Password / secret</Label><Input type="password" value={initialSecret} onChange={(e) => setInitialSecret(e.target.value)} placeholder="Encrypted before it's stored" /></div>
                <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create credential"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, system, username…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !credentials || credentials.length === 0 ? (
          <EmptyState icon={KeyRound} title="No credentials yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credential</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                  <TableCell className="font-medium">{c.credential_name}<div className="font-mono text-xs text-muted-foreground">{c.credential_code}</div></TableCell>
                  <TableCell>{c.system}</TableCell>
                  <TableCell className="text-muted-foreground">{c.username ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{c.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.owner ? `${c.owner.first_name ?? ""} ${c.owner.last_name ?? ""}`.trim() : "—"}</TableCell>
                  <TableCell><Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {detail && (
            <div className="space-y-5 p-2">
              <SheetHeader className="p-0">
                <SheetTitle>{detail.credential_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span className="font-mono">{detail.credential_code}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">System</span><span>{detail.system}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Username</span><span>{detail.username ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">URL</span><span className="truncate">{detail.url ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{detail.category}</span></div>
              </div>
              <RevealSecret credentialId={detail.id} companyId={company!.id} hasSecret={!!detail.encrypted_secret} />
              {detail.notes && <p className="text-sm text-muted-foreground">{detail.notes}</p>}
              <Can permission={PERMISSIONS.IT_CREDENTIALS_DELETE}>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(detail.id)}>
                  <Trash2 className="h-3.5 w-3.5" />Delete credential
                </Button>
              </Can>
              {!hasPermission(PERMISSIONS.IT_CREDENTIALS_REVEAL) && (
                <p className="text-xs text-muted-foreground">You don't have permission to reveal this secret.</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RevealSecret({ credentialId, companyId, hasSecret }: { credentialId: string; companyId: string; hasSecret: boolean }) {
  const { reveal } = useCredentialMutations();
  const [visible, setVisible] = useState<string | null>(null);

  const handleReveal = async () => {
    try {
      const secret = await reveal.mutateAsync({ companyId, credentialId });
      setVisible(secret ?? "(no secret set)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reveal secret");
    }
  };

  if (!hasSecret) {
    return <p className="text-xs text-muted-foreground">No secret has been set for this credential.</p>;
  }

  return (
    <Can permission={PERMISSIONS.IT_CREDENTIALS_REVEAL}>
      <div className="rounded-md border border-border p-3">
        <Label className="text-xs text-muted-foreground">Secret</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <Input readOnly type={visible ? "text" : "password"} value={visible ?? "••••••••••••"} className="font-mono" />
          <Button type="button" size="icon" variant="outline" onClick={visible ? () => setVisible(null) : handleReveal} disabled={reveal.isPending}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {visible && (
            <Button type="button" size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(visible); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Every reveal is recorded in the audit log.</p>
      </div>
    </Can>
  );
}
