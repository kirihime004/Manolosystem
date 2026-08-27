import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useUnreadNotificationCount,
  useInventoryNotifications,
  useNotificationMutations,
} from "@/features/it/inventory/hooks";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/permissions/keys";

const VIEW_PERMISSIONS = [
  PERMISSIONS.IT_NOTIFICATIONS_VIEW,
  PERMISSIONS.HR_NOTIFICATIONS_VIEW,
  PERMISSIONS.FINANCE_NOTIFICATIONS_VIEW,
  PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW,
  PERMISSIONS.PRODUCTION_NOTIFICATIONS_VIEW,
];

// One sweep call per module's notification generator, each gated by its own
// permission check inside the RPC itself -- a user missing that module's
// permission just gets a harmless rejected promise here. Every RPC is
// idempotent (unique constraint + ON CONFLICT DO NOTHING / plain recompute),
// so firing all of them once per browser session is a safe, cheap way to
// keep things current in the absence of any server-side cron in this app.
const SWEEP_RPCS = [
  "generate_inventory_notifications",
  "generate_procurement_notifications",
  "generate_hr_notifications",
  "generate_finance_notifications",
  "generate_admin_notifications",
  "generate_production_notifications",
  "recalculate_production_risk",
] as const;

let sweptThisSession = false;

export function NotificationBell() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: unread } = useUnreadNotificationCount(company?.id);
  const { data: notifications } = useInventoryNotifications(company?.id);
  const { markRead, markAllRead } = useNotificationMutations(company?.id);

  const canView = VIEW_PERMISSIONS.some(hasPermission);

  useEffect(() => {
    if (!company?.id || sweptThisSession || !canView) return;
    sweptThisSession = true;
    const companyId = company.id;
    Promise.allSettled(SWEEP_RPCS.map((fn) => supabase.rpc(fn, { p_company_id: companyId }))).then((results) => {
      if (results.some((r) => r.status === "fulfilled")) {
        queryClient.invalidateQueries({ queryKey: ["notifications", companyId] });
        queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", companyId] });
      }
    });
  }, [company?.id, canView, queryClient]);

  if (!canView) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {!!unread && unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {!!unread && unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  if (n.resource_type === "asset") navigate(`/c/${companySlug}/it/inventory`);
                }}
                className={`w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-accent ${n.read ? "" : "bg-accent/40"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{n.title}</span>
                  {!n.read && <Badge className="h-4 px-1.5 text-[9px]">New</Badge>}
                </div>
                <p className="mt-0.5 text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
