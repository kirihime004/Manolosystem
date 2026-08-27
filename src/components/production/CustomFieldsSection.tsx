import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { useEmployees } from "@/features/hr/hooks";
import {
  useCustomFields, useCustomFieldValues, useCustomFieldValueMutations,
  useProjects, useShots, useTasks,
} from "@/features/production/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/keys";
import type { ProductionCustomField, ProductionCustomFieldValue } from "@/types/database";

const ENTITY_UPDATE_PERMISSION: Record<string, PermissionKey> = {
  PROJECT: PERMISSIONS.PRODUCTION_PROJECTS_UPDATE,
  SHOT: PERMISSIONS.PRODUCTION_SHOTS_UPDATE,
  ASSET: PERMISSIONS.PRODUCTION_ASSETS_UPDATE,
  TASK: PERMISSIONS.PRODUCTION_TASKS_UPDATE,
};

type SaveInput = {
  valueText?: string | null; valueNumber?: number | null; valueBoolean?: boolean | null;
  valueDate?: string | null; valueTimestamp?: string | null; valueUuid?: string | null; valueJson?: unknown;
};

interface Props {
  companyId: string | undefined;
  entityType: "PROJECT" | "SHOT" | "ASSET" | "TASK";
  entityId: string;
  /** Scopes SHOT/TASK reference-type fields to one project's own shots/tasks. */
  projectId?: string | null;
}

export function CustomFieldsSection({ companyId, entityType, entityId, projectId }: Props) {
  const { user } = useAuth();
  const { data: fields } = useCustomFields(companyId, entityType);
  const { data: values } = useCustomFieldValues(entityType, entityId);
  const { set } = useCustomFieldValueMutations(entityType, entityId);

  const { data: employees } = useEmployees(companyId);
  const { data: refProjects } = useProjects(companyId);
  const { data: refShots } = useShots(projectId ?? undefined);
  const { data: refTasks } = useTasks(companyId, { projectId: projectId ?? undefined });

  if (!fields || fields.length === 0) return null;

  const valueMap = new Map((values ?? []).map((v) => [v.custom_field_id, v]));

  const saveValue = (field: ProductionCustomField, patch: SaveInput) => {
    if (!companyId || !user) return;
    set.mutate(
      { companyId, customFieldId: field.id, entityType, entityId, updatedBy: user.id, ...patch },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save field") },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Custom fields</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Can
            key={field.id}
            permission={ENTITY_UPDATE_PERMISSION[entityType]}
            fallback={
              <FieldReadOnly field={field} value={valueMap.get(field.id)} employees={employees} refProjects={refProjects} refShots={refShots} refTasks={refTasks} />
            }
          >
            <FieldEditor
              field={field}
              value={valueMap.get(field.id)}
              onSave={(patch) => saveValue(field, patch)}
              employees={employees}
              refProjects={refProjects}
              refShots={refShots}
              refTasks={refTasks}
            />
          </Can>
        ))}
      </CardContent>
    </Card>
  );
}

type RefLists = {
  employees?: { id: string; first_name: string; last_name: string }[];
  refProjects?: { id: string; name: string }[];
  refShots?: { id: string; shot_code: string }[];
  refTasks?: { id: string; name: string }[];
};

function formatReferenceLabel(field: ProductionCustomField, uuid: string | null, lists: RefLists): string {
  if (!uuid) return "—";
  if (field.field_type === "EMPLOYEE") {
    const e = lists.employees?.find((x) => x.id === uuid);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  }
  if (field.field_type === "PROJECT") return lists.refProjects?.find((x) => x.id === uuid)?.name ?? "—";
  if (field.field_type === "SHOT") return lists.refShots?.find((x) => x.id === uuid)?.shot_code ?? "—";
  if (field.field_type === "TASK") return lists.refTasks?.find((x) => x.id === uuid)?.name ?? "—";
  return "—";
}

function FieldReadOnly({ field, value, ...lists }: { field: ProductionCustomField; value: ProductionCustomFieldValue | undefined } & RefLists) {
  let display = "—";
  switch (field.field_type) {
    case "BOOLEAN":
      display = value?.value_boolean ? "Yes" : "No";
      break;
    case "NUMBER":
    case "CURRENCY":
      display = value?.value_number != null ? String(value.value_number) : "—";
      break;
    case "DATE":
      display = value?.value_date ?? "—";
      break;
    case "DATETIME":
      display = value?.value_timestamp ? new Date(value.value_timestamp).toLocaleString() : "—";
      break;
    case "EMPLOYEE":
    case "PROJECT":
    case "SHOT":
    case "TASK":
      display = formatReferenceLabel(field, value?.value_uuid ?? null, lists);
      break;
    case "MULTI_SELECT": {
      const selected = Array.isArray(value?.value_json) ? (value!.value_json as string[]) : [];
      display = selected.length > 0 ? selected.map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(", ") : "—";
      break;
    }
    case "DROPDOWN":
      display = value?.value_text ? (field.options.find((o) => o.value === value.value_text)?.label ?? value.value_text) : "—";
      break;
    default:
      display = value?.value_text ?? "—";
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <p className="text-sm text-foreground">{display}</p>
    </div>
  );
}

function FieldEditor({
  field, value, onSave, ...lists
}: { field: ProductionCustomField; value: ProductionCustomFieldValue | undefined; onSave: (patch: SaveInput) => void } & RefLists) {
  const [text, setText] = useState(value?.value_text ?? "");

  switch (field.field_type) {
    case "TEXT":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onSave({ valueText: text || null })} />
        </div>
      );
    case "TEXTAREA":
      return (
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{field.label}</Label>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onSave({ valueText: text || null })} />
        </div>
      );
    case "NUMBER":
    case "CURRENCY":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => onSave({ valueNumber: text === "" ? null : Number(text) })}
          />
        </div>
      );
    case "BOOLEAN":
      return (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label className="text-xs">{field.label}</Label>
          <Switch checked={!!value?.value_boolean} onCheckedChange={(checked) => onSave({ valueBoolean: checked })} />
        </div>
      );
    case "DATE":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input type="date" defaultValue={value?.value_date ?? ""} onChange={(e) => onSave({ valueDate: e.target.value || null })} />
        </div>
      );
    case "DATETIME":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="datetime-local"
            defaultValue={value?.value_timestamp ? value.value_timestamp.slice(0, 16) : ""}
            onChange={(e) => onSave({ valueTimestamp: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </div>
      );
    case "DROPDOWN":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value?.value_text ?? "__none__"} onValueChange={(v) => onSave({ valueText: v === "__none__" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "MULTI_SELECT": {
      const selected = new Set(Array.isArray(value?.value_json) ? (value!.value_json as string[]) : []);
      const toggle = (optValue: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(optValue); else next.delete(optValue);
        onSave({ valueJson: Array.from(next) });
      };
      return (
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{field.label}</Label>
          <div className="flex flex-wrap gap-3">
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm text-foreground">
                <Checkbox checked={selected.has(o.value)} onCheckedChange={(checked) => toggle(o.value, !!checked)} />
                {o.label}
              </label>
            ))}
            {field.options.length === 0 && <p className="text-xs text-muted-foreground">No options defined for this field.</p>}
          </div>
        </div>
      );
    }
    case "EMPLOYEE":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value?.value_uuid ?? "__none__"} onValueChange={(v) => onSave({ valueUuid: v === "__none__" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {(lists.employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "PROJECT":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value?.value_uuid ?? "__none__"} onValueChange={(v) => onSave({ valueUuid: v === "__none__" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {(lists.refProjects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "SHOT":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value?.value_uuid ?? "__none__"} onValueChange={(v) => onSave({ valueUuid: v === "__none__" ? null : v })}>
            <SelectTrigger><SelectValue placeholder={lists.refShots ? "—" : "No project in scope"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {(lists.refShots ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.shot_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "TASK":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value?.value_uuid ?? "__none__"} onValueChange={(v) => onSave({ valueUuid: v === "__none__" ? null : v })}>
            <SelectTrigger><SelectValue placeholder={lists.refTasks ? "—" : "No project in scope"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {(lists.refTasks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return null;
  }
}
