import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { llmApi } from "@/lib/api/llm";
import type { ProjectRole } from "@/lib/api/projects";

const LLM_ACCESS_ROLES: ProjectRole[] = [
  "owner",
  "admin",
  "editor",
  "suggester",
];

export function useLLMGate(
  projectId: string,
  userRole?: ProjectRole | null
) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isAnonymous = !session?.user;

  const statusQuery = useQuery({
    // User-scoped: daily_remaining is role/user-dependent and the cached
    // status must not survive a sign-out/user-switch in the same tab.
    queryKey: ["llm-status", projectId, session?.user?.email ?? null],
    queryFn: () => llmApi.getStatus(projectId, session!.accessToken!),
    enabled: !!session?.accessToken && !!projectId && !isAnonymous,
    staleTime: 60_000, // 1 min — advisory, not authoritative
  });

  const status = statusQuery.data;
  const hasAccess =
    !isAnonymous && userRole != null && LLM_ACCESS_ROLES.includes(userRole);
  // daily_remaining: null = unlimited; 0 = today's per-role cap consumed.
  // The server 402s on dispatch when the cap is hit, so the gate must too.
  const dailyExhausted = status?.daily_remaining === 0;

  const invalidateStatus = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ["llm-status", projectId] }),
    [queryClient, projectId]
  );

  return {
    // Core access decision
    canUseLLM:
      hasAccess &&
      (status?.configured ?? false) &&
      !(status?.budget_exhausted ?? false) &&
      !dailyExhausted,

    // Individual states for UI rendering
    budgetExhausted: status?.budget_exhausted ?? false,
    dailyExhausted,
    // Only claim "not configured" when the server actually said so — while
    // loading or on a fetch error this must NOT masquerade as unconfigured.
    notConfigured: status ? !status.configured : false,
    dailyRemaining: status?.daily_remaining ?? null,
    isBudgetUnlimited: status?.monthly_budget_usd === null,
    isAnonymous,
    hasRoleAccess: hasAccess,

    // Status data for banner/badge
    monthlySpentUsd: status?.monthly_spent_usd ?? 0,
    monthlyBudgetUsd: status?.monthly_budget_usd ?? null,
    burnRateDailyUsd: status?.burn_rate_daily_usd ?? 0,

    // Role-based display
    roleLimitLabel: getRoleLimitLabel(userRole),

    // Force refresh (e.g., after 402 response)
    invalidateStatus,

    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    error: statusQuery.error,
  };
}

function getRoleLimitLabel(role?: ProjectRole | null): string | null {
  switch (role) {
    case "owner":
    case "admin":
      return "Admin — unlimited";
    case "editor":
      return "Editor — 500/day";
    case "suggester":
      return "Suggester — 100/day";
    default:
      return null;
  }
}
