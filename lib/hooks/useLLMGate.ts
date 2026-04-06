import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { llmApi, type LLMStatusResponse } from "@/lib/api/llm";
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
    queryKey: ["llm-status", projectId],
    queryFn: () => llmApi.getStatus(projectId, session!.accessToken!),
    enabled: !!session?.accessToken && !!projectId && !isAnonymous,
    staleTime: 60_000, // 1 min — advisory, not authoritative
  });

  const status = statusQuery.data as LLMStatusResponse | undefined;
  const hasAccess =
    !isAnonymous && LLM_ACCESS_ROLES.includes(userRole as ProjectRole);

  return {
    // Core access decision
    canUseLLM:
      hasAccess &&
      (status?.configured ?? false) &&
      !(status?.budget_exhausted ?? false),

    // Individual states for UI rendering
    budgetExhausted: status?.budget_exhausted ?? false,
    notConfigured: !(status?.configured ?? false),
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
    invalidateStatus: () =>
      queryClient.invalidateQueries({ queryKey: ["llm-status", projectId] }),

    isLoading: statusQuery.isLoading,
  };
}

function getRoleLimitLabel(role?: ProjectRole | null): string | null {
  switch (role) {
    case "owner":
    case "admin":
      return "Admin \u2014 unlimited";
    case "editor":
      return "Editor \u2014 500/day";
    case "suggester":
      return "Suggester \u2014 100/day";
    default:
      return null;
  }
}
