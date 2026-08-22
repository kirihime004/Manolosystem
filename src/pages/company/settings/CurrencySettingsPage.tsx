import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCompanyCurrencySettings, useCurrencies, useCurrencyMutations } from "@/features/it/procurement/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function CurrencySettingsPage() {
  const { company } = useCompany();
  const { data: settings } = useCompanyCurrencySettings(company?.id);
  const { data: currencies } = useCurrencies();
  const { updateBaseCurrency } = useCurrencyMutations(company?.id);

  const [pending, setPending] = useState<string | null>(null);

  const current = currencies?.find((c) => c.id === settings?.base_currency_id);

  const handleChange = async (id: string) => {
    setPending(id);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      await updateBaseCurrency.mutateAsync(pending);
      toast.success("Base currency updated. Historical transactions keep their original recorded currency and rate.");
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update base currency");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Currency</h1>
        <p className="text-sm text-muted-foreground">The default currency for IT budgets, procurement reports, and spending summaries.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base currency</CardTitle>
          <CardDescription>New budgets and reports default to this currency. Changing it does not alter any historical transaction — those keep the exchange rate they were recorded with.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium">{current ? `${current.code} — ${current.name} ${current.symbol}` : "Loading…"}</span>
          </div>
          <Can permission={PERMISSIONS.IT_CURRENCY_MANAGE}>
            <div className="space-y-2">
              <CurrencySelect value={pending ?? settings?.base_currency_id ?? ""} onChange={handleChange} className="w-72" />
              {pending && pending !== settings?.base_currency_id && (
                <Button size="sm" onClick={handleConfirm} disabled={updateBaseCurrency.isPending}>
                  {updateBaseCurrency.isPending ? "Saving…" : "Confirm change"}
                </Button>
              )}
            </div>
          </Can>
        </CardContent>
      </Card>
    </div>
  );
}
