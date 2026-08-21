import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useCategoryMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ticket-categories", companyId] });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("ticket_categories").insert({ company_id: companyId!, name });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateCategory = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from("ticket_categories").update({ name: input.name }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const createSubcategory = useMutation({
    mutationFn: async (input: { categoryId: string; name: string }) => {
      const { error } = await supabase
        .from("ticket_subcategories")
        .insert({ company_id: companyId!, category_id: input.categoryId, name: input.name });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateSubcategory = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from("ticket_subcategories")
        .update({ name: input.name })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  };
}
