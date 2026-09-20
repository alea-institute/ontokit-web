import { useQuery } from "@tanstack/react-query";
import { trustApi, type MemberTrust } from "@/lib/api/trust";

export const memberTrustQueryKeys = {
  list: (projectId: string, viewerId?: string) => viewerId
    ? ["member-trust", projectId, viewerId] as const
    : ["member-trust", projectId] as const,
};

/**
 * Every member's rung, grant state, and accepted count (R6).
 *
 * Owner/admin only server-side, so `enabled` must carry the same condition —
 * asking as a non-admin buys nothing but a 403 in the console.
 */
export function useMemberTrust(
  projectId: string,
  accessToken: string | undefined,
  enabled: boolean,
  viewerId: string | undefined,
) {
  const canRead = !!projectId && !!accessToken && !!viewerId && enabled;
  const query = useQuery<MemberTrust[]>({
    queryKey: memberTrustQueryKeys.list(projectId, viewerId),
    queryFn: () => trustApi.listMemberTrust(projectId, accessToken!),
    enabled: canRead,
    staleTime: 30_000,
  });
  return { ...query, data: canRead ? query.data : undefined };
}
