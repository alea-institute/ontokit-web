import { useQuery } from "@tanstack/react-query";
import { embeddingsApi } from "@/lib/api/embeddings";

export function useSimilarEntities(
  projectId: string,
  entityIri: string | null,
  accessToken?: string,
  branch?: string,
  limit = 10
) {
  return useQuery({
    queryKey: ["similar", projectId, entityIri, !!accessToken, branch, limit],
    queryFn: () =>
      embeddingsApi.getSimilarEntities(
        projectId,
        entityIri!,
        accessToken,
        branch,
        limit
      ),
    // The similarity endpoint requires authentication; anonymous visitors
    // would only collect 401s, so never fire without an access token.
    enabled: !!entityIri && !!projectId && !!accessToken,
    staleTime: 60_000,
  });
}
