import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

export function usePlatformAdmin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["is-platform-superadmin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_superadmin");
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    isPlatformAdmin: query.data ?? false,
    isLoading: !!user && query.isLoading,
  };
}
