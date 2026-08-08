import { useQuery } from "@tanstack/react-query";
import { embeddingsApi } from "@/lib/api/embeddings";
import { projectOntologyApi } from "@/lib/api/client";

export function useSemanticSearch(
  projectId: string,
  query: string,
  enabled: boolean,
  accessToken?: string,
  branch?: string,
  mode: "semantic" | "text" = "semantic",
  limit = 20
) {
  return useQuery({
    queryKey: ["search", mode, projectId, query, accessToken ?? null, branch, limit],
    queryFn: async () => {
      if (mode === "text") {
        const response = await projectOntologyApi.searchEntities(
          projectId,
          query,
          accessToken,
          branch
        );
        return {
          results: response.results.map((r) => ({
            ...r,
            score: 1,
          })),
          search_mode: "text_fallback" as const,
        };
      }

      try {
        return await embeddingsApi.semanticSearch(
          projectId,
          query,
          accessToken,
          branch,
          limit
        );
      } catch (error) {
        // Budget exhaustion (402) and unavailable embeddings (503) can still
        // produce useful text results. Authorization and other failures must
        // remain visible instead of being silently disguised as text results.
        const status = (error as { status?: number }).status;
        if (status !== 402 && status !== 503) throw error;
        const response = await projectOntologyApi.searchEntities(
          projectId,
          query,
          accessToken,
          branch
        );
        return {
          results: response.results.map((r) => ({
            ...r,
            score: 1,
          })),
          search_mode: "text_fallback" as const,
        };
      }
    },
    enabled: enabled && !!query.trim() && !!projectId,
    staleTime: 10_000,
    retry: false,
  });
}
