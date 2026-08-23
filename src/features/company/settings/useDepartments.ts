import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Department } from "@/types/database";

export function useDepartments(companyId: string | undefined) {
  return useQuery({
    queryKey: ["departments", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Department[];
    },
    enabled: !!companyId,
  });
}

export function useDepartmentMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departments", companyId] });

  const create = useMutation({
    mutationFn: async (input: {
      name: string; description: string | null;
      code?: string | null; managerId?: string | null; parentDepartmentId?: string | null;
    }) => {
      const { error } = await supabase
        .from("departments")
        .insert({
          company_id: companyId!, name: input.name, description: input.description,
          code: input.code ?? null, manager_id: input.managerId ?? null, parent_department_id: input.parentDepartmentId ?? null,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string; name: string; description: string | null;
      code?: string | null; managerId?: string | null; parentDepartmentId?: string | null; status?: "ACTIVE" | "INACTIVE";
    }) => {
      const { error } = await supabase
        .from("departments")
        .update({
          name: input.name, description: input.description,
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.managerId !== undefined ? { manager_id: input.managerId } : {}),
          ...(input.parentDepartmentId !== undefined ? { parent_department_id: input.parentDepartmentId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
