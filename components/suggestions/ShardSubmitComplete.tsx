"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchSubmitPRResult } from "@/lib/api/suggestions";

interface ShardSubmitCompleteProps {
  results: BatchSubmitPRResult[];
  succeeded: number;
  failed: number;
  onRetryFailed: () => void;
  onDone: () => void;
}

/**
 * ShardSubmitComplete — success/partial-failure completion screen.
 * Lists each PR with a GitHub link (opens in new tab) for successes,
 * and error details with a "Retry failed" button for failures.
 * T-15-03 mitigated: all links use rel="noopener noreferrer".
 * D-18/D-19, UI-SPEC Copywriting Contract.
 */
export function ShardSubmitComplete({
  results,
  succeeded,
  failed,
  onRetryFailed,
  onDone,
}: ShardSubmitCompleteProps) {
  const total = succeeded + failed;
  const isFullSuccess = failed === 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      {/* Heading */}
      <div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {isFullSuccess ? "Suggestions submitted" : `${succeeded} of ${total} PRs created`}
        </h3>

        {/* Body */}
        <p
          className={[
            "mt-1 text-sm",
            isFullSuccess
              ? "text-slate-500 dark:text-slate-400"
              : "text-red-600 dark:text-red-400",
          ].join(" ")}
        >
          {isFullSuccess
            ? `${succeeded} ${succeeded === 1 ? "PR" : "PRs"} opened for review.`
            : `${failed} failed. Review errors below and retry, or close and try again later.`}
        </p>
      </div>

      {/* PR result list */}
      <div className="rounded-md border border-slate-200 dark:border-slate-700">
        {results.map((result, index) => {
          const prUrl = result.github_pr_url ?? result.pr_url;
          const prNumber = result.pr_number;
          const isSuccess = result.status === "success";

          return (
            <div
              key={index}
              className={[
                "flex items-center gap-2 px-4 py-2",
                index < results.length - 1
                  ? "border-b border-slate-100 dark:border-slate-800"
                  : "",
                !isSuccess
                  ? "rounded bg-red-50 dark:bg-red-900/20"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              )}

              {isSuccess && prUrl ? (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open PR #${prNumber ?? index + 1} on GitHub (opens in new tab)`}
                  className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  PR #{prNumber ?? index + 1}
                </a>
              ) : isSuccess ? (
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  PR #{prNumber ?? index + 1}
                </span>
              ) : (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {result.error ?? "Unknown error — PR creation failed."}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {failed > 0 && (
          <Button variant="secondary" size="sm" onClick={onRetryFailed}>
            Retry failed
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
