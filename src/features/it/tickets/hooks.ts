import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { TicketCategory, TicketSubcategory } from "@/types/database";
import type { TicketFilters } from "@/features/it/tickets/types";
import * as api from "@/features/it/tickets/ticketApi";

export function useTickets(companyId: string | undefined, filters: TicketFilters) {
  return useQuery({
    queryKey: ["tickets", companyId, filters],
    queryFn: () => api.listTickets(companyId!, filters),
    enabled: !!companyId,
  });
}

export function useTicketDashboardStats(companyId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-dashboard-stats", companyId],
    queryFn: () => api.getDashboardStats(companyId!),
    enabled: !!companyId,
  });
}

export function useRecentTickets(companyId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["recent-tickets", companyId, limit],
    queryFn: () => api.getRecentTickets(companyId!, limit),
    enabled: !!companyId,
  });
}

export function useAssignedTickets(companyId: string | undefined, userId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["assigned-tickets", companyId, userId, limit],
    queryFn: () => api.getAssignedTickets(companyId!, userId!, limit),
    enabled: !!companyId && !!userId,
  });
}

export function useCriticalTickets(companyId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["critical-tickets", companyId, limit],
    queryFn: () => api.getCriticalTickets(companyId!, limit),
    enabled: !!companyId,
  });
}

export function useTicketSearch(companyId: string | undefined, query: string) {
  return useQuery({
    queryKey: ["ticket-search", companyId, query],
    queryFn: () => api.searchTickets(companyId!, query),
    enabled: !!companyId && query.trim().length >= 2,
  });
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.getTicket(ticketId!),
    enabled: !!ticketId,
  });
}

export function useTicketCategories(companyId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-categories", companyId],
    queryFn: async () => {
      const [{ data: categories, error: catError }, { data: subcategories, error: subError }] =
        await Promise.all([
          supabase.from("ticket_categories").select("*").eq("company_id", companyId!).order("name"),
          supabase.from("ticket_subcategories").select("*").eq("company_id", companyId!).order("name"),
        ]);
      if (catError) throw catError;
      if (subError) throw subError;
      return {
        categories: categories as TicketCategory[],
        subcategories: subcategories as TicketSubcategory[],
      };
    },
    enabled: !!companyId,
  });
}

export function useCompanyMembers(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-members", companyId],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("company_users")
        .select("user_id")
        .eq("company_id", companyId!)
        .eq("status", "ACTIVE");
      if (error) throw error;

      const userIds = memberships.map((m) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);
      if (profileError) throw profileError;
      return profiles;
    },
    enabled: !!companyId,
  });
}

export function useMyTicketActivity(companyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-ticket-activity", companyId, userId],
    queryFn: () => api.getMyTicketActivity(companyId!, userId!),
    enabled: !!companyId && !!userId,
  });
}

export function useTicketMutations(ticketId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    if (ticketId) queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
  };

  const assign = useMutation({
    mutationFn: (assignedTo: string | null) => api.updateTicketAssignment(ticketId!, assignedTo),
    onSuccess: invalidate,
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.updateTicketStatus(ticketId!, status),
    onSuccess: invalidate,
  });

  const changePriority = useMutation({
    mutationFn: (priority: string) => api.updateTicketPriority(ticketId!, priority),
    onSuccess: invalidate,
  });

  const comment = useMutation({
    mutationFn: (input: { companyId: string; authorId: string; body: string }) =>
      api.addComment(ticketId!, input.companyId, input.authorId, input.body),
    onSuccess: invalidate,
  });

  const upload = useMutation({
    mutationFn: (input: { companyId: string; uploadedBy: string; file: File; commentId?: string }) =>
      api.uploadAttachment({ ticketId: ticketId!, ...input }),
    onSuccess: invalidate,
  });

  const updateAsset = useMutation({
    mutationFn: (assetId: string | null) => api.updateTicketAsset(ticketId!, assetId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTicket(ticketId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  return { assign, changeStatus, changePriority, comment, upload, updateAsset, remove };
}
