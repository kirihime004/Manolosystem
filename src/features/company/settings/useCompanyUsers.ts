import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabase/functionError";
import type { MembershipStatus, Profile } from "@/types/database";

export interface CompanyUserRow {
  id: string;
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

      const [{ data: profiles, error: profileError }, { data: userRoles, error: roleError }] =
        await Promise.all([
          supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", userIds),
          supabase
            .from("user_roles")
            .select("company_user_id, roles(id, name)")
            .in("company_user_id", membershipIds),
        ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
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
          status: m.status as MembershipStatus,
          department: Array.isArray(department) ? department[0] ?? null : department,
          profile: profileMap.get(m.user_id) ?? null,
          email: null,
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
