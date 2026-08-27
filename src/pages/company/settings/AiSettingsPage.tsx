import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAiCompanySettings, useAiCompanySettingsMutations, useAiUsageSummary } from "@/features/ai/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const RETENTION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "36500", label: "Never delete" },
];

export default function AiSettingsPage() {
  const { company } = useCompany();
  const { data: settings, isLoading } = useAiCompanySettings(company?.id);
  const { update } = useAiCompanySettingsMutations(company?.id);
  const { data: usage } = useAiUsageSummary(company?.id, 30);

  const [tokenLimit, setTokenLimit] = useState("");
  const [requestLimit, setRequestLimit] = useState("");

  const handleToggle = async (enabled: boolean) => {
    try {
      await update.mutateAsync({ enabled });
      toast.success(enabled ? "AI enabled" : "AI disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update AI settings");
    }
  };

  const handleRetentionChange = async (value: string) => {
    try {
      await update.mutateAsync({ retention_days: Number(value) });
      toast.success("Retention updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update retention");
    }
  };

  const handleLimitsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        monthly_token_limit: tokenLimit ? Number(tokenLimit) : null,
        monthly_request_limit: requestLimit ? Number(requestLimit) : null,
      });
      toast.success("Limits updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update limits");
    }
  };

  if (isLoading) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">AI</h1>
        <p className="text-sm text-muted-foreground">Enablement, usage limits, and data retention for the AI Assistant and Business Intelligence.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enabled</CardTitle>
          <CardDescription>Requires the AI module to also be turned on for this company by the platform administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={settings?.enabled ?? false} onCheckedChange={handleToggle} disabled={update.isPending} />
            <span className="text-sm text-foreground">{settings?.enabled ? "AI is enabled" : "AI is disabled"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage limits</CardTitle>
          <CardDescription>Optional monthly caps. When reached, the AI Assistant stops responding until the next month rather than spending without limit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLimitsSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Monthly token limit</Label>
              <Input type="number" min="0" placeholder="No limit" defaultValue={settings?.monthly_token_limit ?? ""} onChange={(e) => setTokenLimit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly request limit</Label>
              <Input type="number" min="0" placeholder="No limit" defaultValue={settings?.monthly_request_limit ?? ""} onChange={(e) => setRequestLimit(e.target.value)} />
            </div>
            <Button type="submit" size="sm" disabled={update.isPending}>Save limits</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chat retention</CardTitle>
          <CardDescription>How long AI conversations are kept before being eligible for cleanup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={String(settings?.retention_days ?? 90)} onValueChange={handleRetentionChange}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{RETENTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage — last 30 days</CardTitle>
          <CardDescription>Real request and token counts from every AI call. Dollar cost isn't shown — OpenRouter's per-model pricing isn't tracked in this app yet, so a $ figure would be a guess rather than a real number.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Model</TableHead><TableHead className="text-right">Requests</TableHead><TableHead className="text-right">Input tokens</TableHead><TableHead className="text-right">Output tokens</TableHead></TableRow></TableHeader>
            <TableBody>
              {(usage ?? []).map((row) => (
                <TableRow key={row.model}>
                  <TableCell className="font-mono text-xs">{row.model}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.request_count.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.input_tokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.output_tokens.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!usage || usage.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No AI usage yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
