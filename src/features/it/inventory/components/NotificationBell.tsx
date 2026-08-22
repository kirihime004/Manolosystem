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
import * as api from "@/features/it/inventory/inventoryApi";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/permissions/keys";

// Notifications are generated server-side (see generate_inventory_notifications),
// never on every dashboard render -- the RPC itself is idempotent (unique
// constraint + ON CONFLICT DO NOTHING), so calling it once per browser
// session here is a safe, cheap way to keep things current between
// whatever schedule eventually runs it server-side, without ever creating
// duplicate rows.
let generatedThisSession = false;

export function NotificationBell() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, hasPermission } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: unread } = useUnreadNotificationCount(company?.id);
  const { data: notifications } = useInventoryNotifications(company?.id);
  const { markRead, markAllRead } = useNotificationMutations(company?.id);

  useEffect(() => {
    if (!company?.id || generatedThisSession || !hasPermission(PERMISSIONS.IT_NOTIFICATIONS_MANAGE)) return;
    generatedThisSession = true;
    const companyId = company.id;
    api
      .generateNotifications(companyId)
      .then((created) => {
        if (created > 0) {
          queryClient.invalidateQueries({ queryKey: ["notifications", companyId] });
          queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", companyId] });
        }
      })
      .catch(() => {});
  }, [company?.id, hasPermission, queryClient]);

  if (!hasPermission(PERMISSIONS.IT_NOTIFICATIONS_VIEW)) return null;

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
