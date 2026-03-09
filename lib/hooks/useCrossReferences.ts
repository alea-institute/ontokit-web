import { useQuery } from "@tanstack/react-query";
import { qualityApi } from "@/lib/api/quality";

export function useCrossReferences(
  projectId: string,
  entityIri: string | null,
  accessToken?: string,
  branch?: string
) {
  return useQuery({
    queryKey: ["crossReferences", projectId, entityIri, accessToken, branch],
    queryFn: () =>
      qualityApi.getCrossReferences(projectId, entityIri!, accessToken, branch),
    enabled: !!entityIri && !!projectId,
    staleTime: 60_000,
  });
}
