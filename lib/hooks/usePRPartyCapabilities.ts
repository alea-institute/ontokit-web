import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { prPartyApi, type PRPartyMe } from "@/lib/api/prParty";
import { prPartyQueryKeys, prPartyUserKey } from "./usePRPartyQueue";

/**
 * The single client-side source of PR Party reviewer posture (KTD19).
 *
 * The server serves capabilities; nothing here re-derives them from roles or
 * emails. A second derivation drifts, and drift on a privilege gate is a bug.
 *
 * Fail-closed by design, on the `useTrustCapabilities` model: while loading,
 * on error, and for an unauthenticated visitor, `isReviewer` is false. The nav
 * entry and the queue both gate on it, so an affordance can never appear
 * before the permission behind it is known — the alternative walks a
 * non-reviewer into a 403.
 */
export function usePRPartyCapabilities() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userKey = prPartyUserKey(session);

  const query = useQuery({
    // User-scoped: a cached reviewer posture must not survive a user switch.
    queryKey: prPartyQueryKeys.capabilities(userKey),
    queryFn: () => prPartyApi.getMe(token!),
    enabled: !!token,
    // Credential expiry and degraded state change under the user's feet.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const capabilities: PRPartyMe | null = query.data ?? null;
  const settled = !query.isLoading && !query.isError;

  return {
    capabilities,
    /** Fail-closed: only true once a 200 has said so. */
    isReviewer: settled && capabilities?.is_reviewer === true,
    /** GitHub or the brief generator is unavailable; verdicts record intent. */
    degraded: capabilities?.degraded === true,
    githubLogin: capabilities?.github_login ?? null,
    credential: capabilities?.credential ?? null,
    credentialExpired: capabilities?.credential?.expired === true,
    credentialExpiringSoon: capabilities?.credential?.expires_soon === true,
    generationToken: capabilities?.generation_token ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
