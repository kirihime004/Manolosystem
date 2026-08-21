import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Permission, Role } from "@/types/database";

export function useRoles(companyId: string | undefined) {
  return useQuery({
    queryKey: ["roles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("company_id", companyId!)
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Role[];
    },
    enabled: !!companyId,
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("module_key")
        .order("resource")
        .order("action");
      if (error) throw error;
      return data as Permission[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useRolePermissionIds(roleId: string | undefined) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId!);
      if (error) throw error;
      return new Set(data.map((row) => row.permission_id));
    },
    enabled: !!roleId,
  });
}

export function useRoleMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ["roles", companyId] });

  const create = useMutation({
    mutationFn: async (input: { name: string; description: string | null }) => {
      const { data, error } = await supabase
        .from("roles")
        .insert({ company_id: companyId!, name: input.name, description: input.description })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidateRoles,
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; name: string; description: string | null }) => {
      const { error } = await supabase
        .from("roles")
        .update({ name: input.name, description: input.description })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidateRoles,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateRoles,
  });

  // Replaces the full permission set for a role. Simple and safe at this
  // scale: RLS still requires ADMIN.ROLES.MANAGE for both the delete and
  // the insert, so a partial failure just leaves the role under-permissioned
  // rather than granting anything unintended.
  const setPermissions = useMutation({
    mutationFn: async (input: { roleId: string; permissionIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", input.roleId);
      if (deleteError) throw deleteError;

      if (input.permissionIds.length > 0) {
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(input.permissionIds.map((permission_id) => ({ role_id: input.roleId, permission_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.roleId] });
    },
  });

  return { create, update, remove, setPermissions };
}
