"use client";

import { Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";

export type StepStatus = "idle" | "active" | "done" | "error";

export interface ProgressStep {
  label: string;
  status: StepStatus;
  errorMessage?: string;
}

interface ShardSubmitProgressBarProps {
  steps: ProgressStep[];
}

/**
 * ShardSubmitProgressBar — multi-step vertical progress indicator.
 * Each step has idle/active/done/error states with appropriate icons and colors.
 * Announced to screen readers via role="status" + aria-live="polite".
 * D-17, UI-SPEC Component Inventory.
 */
export function ShardSubmitProgressBar({ steps }: ShardSubmitProgressBarProps) {
  return (
    <div role="status" aria-live="polite" aria-label="Submission progress">
      {steps.map((step, index) => (
        <div
          key={index}
          className={[
            "flex flex-col gap-0.5 px-6 py-3",
            step.status === "active"
              ? "border-l-2 border-primary-600 opacity-100 transition-opacity duration-200 ease-out dark:border-primary-500"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-center gap-3">
            {/* Step icon */}
            {step.status === "idle" && (
              <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            {step.status === "active" && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-600 dark:text-primary-500" />
            )}
            {step.status === "done" && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            )}
            {step.status === "error" && (
              <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            )}

            {/* Step label */}
            <span
              className={[
                "text-sm",
                step.status === "idle"
                  ? "text-slate-500 dark:text-slate-400"
                  : step.status === "active"
                    ? "font-medium text-slate-900 dark:text-slate-100"
                    : step.status === "done"
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-red-600 dark:text-red-400",
              ].join(" ")}
            >
              {step.label}
            </span>
          </div>

          {/* Error message below label */}
          {step.status === "error" && step.errorMessage && (
            <p className="ml-8 text-xs text-red-500 dark:text-red-400">
              {step.errorMessage}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
