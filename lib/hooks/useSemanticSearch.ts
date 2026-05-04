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
    queryKey: ["search", mode, projectId, query, !!accessToken, branch, limit],
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
      } catch {
        // Fall back to text search if semantic search unavailable
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
  });
}
