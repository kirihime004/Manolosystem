import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabase/functionError";
import type { MembershipStatus, Profile } from "@/types/database";

export interface CompanyUserRow {
  id: string;
  userId: string;
  status: MembershipStatus;
  department: { id: string; name: string } | null;
  profile: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null;
  email: string | null;
  roles: { id: string; name: string }[];
}

export function useCompanyUsersList(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-users-list", companyId],
    queryFn: async (): Promise<CompanyUserRow[]> => {
      const { data: memberships, error } = await supabase
        .from("company_users")
        .select("id, status, user_id, departments(id, name)")
        .eq("company_id", companyId!)
        .order("created_at");
      if (error) throw error;
      if (memberships.length === 0) return [];

      const userIds = memberships.map((m) => m.user_id);
      const membershipIds = memberships.map((m) => m.id);

      const [
        { data: profiles, error: profileError },
        { data: userRoles, error: roleError },
        { data: emails, error: emailError },
      ] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", userIds),
        supabase
          .from("user_roles")
          .select("company_user_id, roles(id, name)")
          .in("company_user_id", membershipIds),
        supabase.rpc("get_company_member_emails", { p_company_id: companyId! }),
      ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (emailError) throw emailError;

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const emailRows = (emails ?? []) as { user_id: string; email: string }[];
      const emailMap = new Map(emailRows.map((e) => [e.user_id, e.email]));
      const rolesByMembership = new Map<string, { id: string; name: string }[]>();
      for (const ur of userRoles ?? []) {
        const role = ur.roles as unknown as { id: string; name: string } | null;
        if (!role) continue;
        const list = rolesByMembership.get(ur.company_user_id) ?? [];
        list.push(role);
        rolesByMembership.set(ur.company_user_id, list);
      }

      return memberships.map((m) => {
        const department = m.departments as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
        return {
          id: m.id,
          userId: m.user_id,
          status: m.status as MembershipStatus,
          department: Array.isArray(department) ? department[0] ?? null : department,
          profile: profileMap.get(m.user_id) ?? null,
          email: emailMap.get(m.user_id) ?? null,
          roles: rolesByMembership.get(m.id) ?? [],
        };
      });
    },
    enabled: !!companyId,
  });
}

export function useToggleUserStatus(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; status: MembershipStatus }) => {
      const { error } = await supabase
        .from("company_users")
        .update({ status: input.status })
        .eq("id", input.membershipId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}

export function useUpdateUserDepartment(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; departmentId: string | null }) => {
      const { error } = await supabase
        .from("company_users")
        .update({ department_id: input.departmentId })
        .eq("id", input.membershipId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}

// Replaces a user's full role set for this company. Same delete-then-insert
// approach as useRoleMutations().setPermissions -- RLS still requires
// ADMIN.USERS.MANAGE for both halves, so a partial failure just leaves them
// under-assigned rather than granting anything unintended.
export function useUpdateUserRoles(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; roleIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("company_user_id", input.membershipId);
      if (deleteError) throw deleteError;

      if (input.roleIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(input.roleIds.map((role_id) => ({ company_user_id: input.membershipId, role_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}

// Platform Superadmin only (enforced by RLS: company_users has no DELETE
// policy for Company Admins, only is_platform_superadmin()). Removes this
// company's membership row -- cascades to this company's user_roles -- but
// never touches the underlying auth.users account or any other company's
// membership, since a user can belong to several companies.
export function useDeleteCompanyMembership(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string }) => {
      const { error } = await supabase.from("company_users").delete().eq("id", input.membershipId);
      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        p_company_id: companyId,
        p_action: "USER_REMOVED",
        p_resource_type: "company_user",
        p_resource_id: input.membershipId,
        p_metadata: {},
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}

export interface BulkImportRow {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string | null;
  employmentStatusId: string | null;
  roleIds: string[];
  hireDate: string | null;
  phone: string | null;
}

export interface BulkImportRowResult {
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
}

export function useBulkImportUsers(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BulkImportRow[]): Promise<BulkImportRowResult[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("bulk-import-users", {
        body: { companyId, rows },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      return (data as { results: BulkImportRowResult[] }).results;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}

export function useAdminSetPassword(companyId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { userId: string; newPassword: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("admin-set-password", {
        body: { companyId, userId: input.userId, newPassword: input.newPassword },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      return data;
    },
  });
}

export function useInviteEmployee(companyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      firstName: string;
      lastName: string;
      departmentId: string | null;
      roleIds: string[];
      mode: "invite" | "direct";
      password?: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          companyId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          departmentId: input.departmentId,
          roleIds: input.roleIds,
          mode: input.mode,
          password: input.password,
          redirectTo: `${window.location.origin}/accept-invite`,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-users-list", companyId] }),
  });
}
