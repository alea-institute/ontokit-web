"use client";

import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLLMUsage } from "@/lib/hooks/useLLMUsage";
import type { LLMUsageResponse } from "@/lib/api/llm";

// ── Constants ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentMonthName() {
  return MONTH_NAMES[new Date().getMonth()];
}

function formatUsd(amount: number) {
  return `$${amount.toFixed(2)}`;
}

// ── Props ──────────────────────────────────────────────────────────────

interface LLMUsageSectionProps {
  projectId: string;
  accessToken?: string;
  monthlyBudgetUsd?: number | null;
}

// ── Component ──────────────────────────────────────────────────────────

export function LLMUsageSection({
  projectId,
  accessToken,
  monthlyBudgetUsd,
}: LLMUsageSectionProps) {
  const { usage, isLoading, error, refetch } = useLLMUsage(
    projectId,
    accessToken
  );

  const [currentPage, setCurrentPage] = useState(0);

  const budgetConsumedPct = usage?.budget_consumed_pct ?? null;
  const totalCost = usage?.total_cost_usd ?? 0;
  const burnRate = usage?.burn_rate_daily_usd ?? 0;
  const effectiveBudget: number | null = monthlyBudgetUsd ?? null;

  // Derive remaining from budget
  let remainingUsd: number | null = null;
  if (effectiveBudget != null) {
    remainingUsd = effectiveBudget - totalCost;
  }

  // Progress bar color
  let barColor = "bg-primary-500";
  if (budgetConsumedPct != null) {
    if (budgetConsumedPct >= 1.0) barColor = "bg-red-500";
    else if (budgetConsumedPct >= 0.8) barColor = "bg-amber-500";
  }

  // Sort users by calls_this_month desc
  const sortedUsers = [...((usage as LLMUsageResponse | undefined)?.users ?? [])].sort(
    (a, b) => b.calls_this_month - a.calls_this_month
  );
  const totalUsers = sortedUsers.length;
  const pagedUsers = sortedUsers.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);
  const showPagination = totalUsers > PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Usage &amp; Budget
        </h3>
        <button
          type="button"
          aria-label="Refresh usage data"
          onClick={() => refetch()}
          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex h-12 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load usage data.
        </p>
      )}

      {!isLoading && !error && usage && (
        <>
          {/* Summary bar */}
          <div className="flex gap-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            {/* Budget used */}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatUsd(totalCost)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Budget used &middot; {currentMonthName()}
              </p>
            </div>

            {/* Remaining */}
            {effectiveBudget != null ? (
              <div>
                <p
                  className={`text-sm font-semibold ${
                    remainingUsd != null && remainingUsd <= 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {remainingUsd != null
                    ? formatUsd(Math.max(0, remainingUsd))
                    : "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Remaining
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  No budget cap
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Remaining
                </p>
              </div>
            )}

            {/* Burn rate */}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                ~{formatUsd(burnRate)}/day
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Burn rate
              </p>
            </div>
          </div>

          {/* Budget progress bar */}
          {budgetConsumedPct != null && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{
                    width: `${Math.min(budgetConsumedPct * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {Math.round(budgetConsumedPct * 100)}% of monthly budget used
              </p>
            </div>
          )}

          {/* Per-user table */}
          <div>
            {sortedUsers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No LLM calls recorded this month.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="pb-2 pr-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          User
                        </th>
                        <th className="pb-2 pr-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Calls today
                        </th>
                        <th className="pb-2 pr-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Calls this month
                        </th>
                        <th className="pb-2 pr-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Est. cost (USD)
                        </th>
                        <th className="pb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          BYO key
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.map((user) => (
                        <tr
                          key={user.user_id}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 text-sm text-slate-900 dark:text-slate-100">
                            {user.user_name ?? user.user_id}
                          </td>
                          <td className="py-2 pr-4 text-right text-sm text-slate-700 dark:text-slate-300">
                            {user.calls_today}
                          </td>
                          <td className="py-2 pr-4 text-right text-sm text-slate-700 dark:text-slate-300">
                            {user.calls_this_month}
                          </td>
                          <td className="py-2 pr-4 text-right text-sm text-slate-700 dark:text-slate-300">
                            {formatUsd(user.cost_this_month_usd)}
                          </td>
                          <td className="py-2 text-center text-sm">
                            {user.is_byo_key ? (
                              <Check
                                className="mx-auto h-4 w-4 text-green-600"
                                aria-label="Uses BYO key"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {showPagination && (
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      Showing {currentPage * PAGE_SIZE + 1}–
                      {Math.min((currentPage + 1) * PAGE_SIZE, totalUsers)} of{" "}
                      {totalUsers} users
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(totalPages - 1, p + 1)
                          )
                        }
                        disabled={currentPage >= totalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!isLoading && !error && !usage && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No LLM calls recorded this month.
        </p>
      )}
    </div>
  );
}
