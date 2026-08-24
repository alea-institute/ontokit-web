import { useQuery } from "@tanstack/react-query";
import { trustApi, type MemberTrust } from "@/lib/api/trust";

export const memberTrustQueryKeys = {
  list: (projectId: string) => ["member-trust", projectId] as const,
};

/**
 * Every member's rung, grant state, and accepted count (R6).
 *
 * Owner/admin only server-side, so `enabled` must carry the same condition —
 * asking as a non-admin buys nothing but a 403 in the console.
 */
export function useMemberTrust(
  projectId: string,
  accessToken?: string,
  enabled = true,
) {
  return useQuery<MemberTrust[]>({
    queryKey: memberTrustQueryKeys.list(projectId),
    queryFn: () => trustApi.listMemberTrust(projectId, accessToken!),
    enabled: !!projectId && !!accessToken && enabled,
    staleTime: 30_000,
  });
}
