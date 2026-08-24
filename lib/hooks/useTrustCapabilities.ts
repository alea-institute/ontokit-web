import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { trustApi, type SuggestionCapabilities, type TrustTier } from "@/lib/api/trust";

/**
 * The single client-side source of trust-tier truth (mirrors KTD3 server-side).
 *
 * Every affordance the ladder gates — entity minting, the trust explainer,
 * auto-accept messaging — reads this hook rather than re-deriving a tier from
 * roles. A second derivation drifts, and drift on a privilege gate is a bug.
 *
 * Fail-safe by design: while loading, and on error, minting is DISABLED. An
 * affordance that appears before its permission is known invites a contributor
 * into an action the server will refuse.
 */
export function useTrustCapabilities(projectId: string | undefined) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const query = useQuery({
    // User-scoped: tier and accepted_count are per-user, and a cached readout
    // must not survive a sign-out or user switch in the same tab.
    queryKey: ["trust-capabilities", projectId, session?.user?.email ?? null],
    queryFn: () => trustApi.getCapabilities(projectId!, token),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const capabilities: SuggestionCapabilities | undefined = query.data;
  const settled = !query.isLoading && !query.isError;

  const tier: TrustTier | null = capabilities?.tier ?? null;
  const canMintEntities = settled && capabilities?.can_mint_entities === true;
  const isTrusted = tier === "trusted" || tier === "reviewer";
  const isAnonymous = tier === "anonymous";

  // Progress toward the next rung, for the explainer. Null once the
  // contributor is already trusted — there is nothing left to earn.
  const promotionProgress =
    capabilities && !isTrusted
      ? {
          accepted: capabilities.accepted_count,
          threshold: capabilities.promotion_threshold,
          remaining: Math.max(
            0,
            capabilities.promotion_threshold - capabilities.accepted_count,
          ),
        }
      : null;

  return {
    capabilities: capabilities ?? null,
    tier,
    canMintEntities,
    isTrusted,
    isAnonymous,
    verificationRequired: capabilities?.verification_required === true,
    promotionProgress,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
