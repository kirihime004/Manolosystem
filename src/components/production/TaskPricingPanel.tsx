import { useState } from "react";
import { toast } from "sonner";
import { useProductionUnits, useTask, useTaskPricingMutations } from "@/features/production/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/shared/Money";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";
import type { ProductionTask } from "@/types/database";

// Lives inside the existing "Edit task" dialogs (Shot/Asset detail pages)
// — there's no dedicated task detail route in this app, so pricing config
// rides along with the rest of task editing, same as CustomFieldsSection
// does. Quantity auto-calculates server-side (recalculate_task_pricing)
// from shot frame data for SECOND/FRAME units; every other unit needs a
// manual quantity. A rate is only resolved and an amount only calculated
// once both a unit and a quantity exist -- resolve_production_rate() has
// no client-callable preview (see productionRateCardsApi.ts), so "Save
// pricing" is the only way to see what rate/amount would apply.
export function TaskPricingPanel({ task: initialTask, canSubmitWork }: { task: ProductionTask; canSubmitWork: boolean }) {
  // The passed-in task is a snapshot from whatever list rendered the
  // parent dialog — it won't reflect a pricing recalculation performed in
  // this panel. Refetch so the readout (and the submit gate below) stay
  // live after "Save & calculate".
  const { data: freshTask } = useTask(initialTask.id);
  const task = freshTask ?? initialTask;

  const { data: units } = useProductionUnits(task.company_id);
  const mutations = useTaskPricingMutations(task.id);

  const [unitId, setUnitId] = useState(initialTask.production_unit_id ?? "");
  const [manualQty, setManualQty] = useState(initialTask.pricing_quantity != null ? String(initialTask.pricing_quantity) : "");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  const unit = (units ?? []).find((u) => u.id === (task.production_unit_id ?? unitId));
  const requiresManualQuantity = !unit || !["SECOND", "FRAME"].includes(unit.code);
  const quantityChanged = manualQty !== "" && Number(manualQty) !== (task.pricing_quantity ?? undefined);

  const handleSavePricing = async () => {
    try {
      if (unitId !== (task.production_unit_id ?? "")) {
        await mutations.setConfig.mutateAsync({ productionUnitId: unitId || null });
      }
      const needsReason = quantityChanged && task.pricing_quantity != null;
      if (needsReason && !overrideReason.trim()) {
        toast.error("Give a reason for changing the quantity");
        return;
      }
      await mutations.recalculate.mutateAsync({
        manualQuantity: manualQty !== "" ? Number(manualQty) : null,
        overrideReason: needsReason ? overrideReason : null,
      });
      toast.success("Pricing recalculated");
      setOverrideReason("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to calculate pricing — is a rate card configured for this task type + unit?"));
    }
  };

  const handleSubmit = async () => {
    try {
      await mutations.submit.mutateAsync({});
      toast.success("Submitted for approval");
      setSubmitOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit — check a rate card and approval policy are both configured"));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <h4 className="text-sm font-semibold text-foreground">Pricing</h4>
      <Can permission={PERMISSIONS.PRODUCTION_TASKS_UPDATE} fallback={<PricingReadout task={task} unitLabel={unit?.label} />}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>{(units ?? []).filter((u) => u.is_active).map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity {!requiresManualQuantity && <span className="text-muted-foreground">(auto from shot frames — override if needed)</span>}</Label>
            <Input type="number" min="0" step="0.01" value={manualQty} onChange={(e) => setManualQty(e.target.value)} placeholder={requiresManualQuantity ? "Enter quantity" : "Auto-calculated"} />
          </div>
        </div>
        {quantityChanged && task.pricing_quantity != null && (
          <div className="space-y-1.5">
            <Label>Reason for quantity change</Label>
            <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. shot re-cut, frame range corrected" />
          </div>
        )}
        <Button type="button" size="sm" variant="outline" onClick={handleSavePricing} disabled={!unitId || mutations.setConfig.isPending || mutations.recalculate.isPending}>
          {mutations.recalculate.isPending ? "Calculating…" : "Save & calculate"}
        </Button>
        <PricingReadout task={task} unitLabel={unit?.label} />
      </Can>

      {canSubmitWork && task.calculated_amount != null && (
        <Can permission={PERMISSIONS.PRODUCTION_WORK_SUBMIT}>
          <div className="border-t border-border pt-3">
            {submitOpen ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground flex-1">Submit this task's approved work for review at the amount shown above?</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSubmitOpen(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleSubmit} disabled={mutations.submit.isPending}>{mutations.submit.isPending ? "Submitting…" : "Confirm submit"}</Button>
              </div>
            ) : (
              <Button type="button" size="sm" onClick={() => setSubmitOpen(true)}>Submit for approval</Button>
            )}
          </div>
        </Can>
      )}
    </div>
  );
}

function PricingReadout({ task, unitLabel }: { task: ProductionTask; unitLabel: string | undefined }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Unit: <span className="text-foreground">{unitLabel ?? "—"}</span></span>
        <span>Quantity: <span className="text-foreground">{task.pricing_quantity ?? "—"}</span>{task.pricing_quantity_source && <span> ({task.pricing_quantity_source === "AUTO" ? "auto" : "manual"})</span>}</span>
        <span>Amount: <span className="text-foreground font-medium">{task.calculated_amount != null ? <Money amount={task.calculated_amount} currencyId={task.pricing_currency_id} /> : "—"}</span></span>
      </div>
      {task.quantity_changed_at && (
        <p className="text-xs text-muted-foreground">
          Quantity overridden from {task.original_quantity ?? "—"} on {new Date(task.quantity_changed_at).toLocaleDateString()}
          {task.quantity_override_reason ? ` — "${task.quantity_override_reason}"` : ""}
        </p>
      )}
    </div>
  );
}
