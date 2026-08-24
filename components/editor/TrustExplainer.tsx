"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { HelpCircle, Loader2, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrustTier } from "@/lib/api/trust";

/**
 * Everything a minting affordance needs to explain itself (R8, AE2).
 *
 * Built once at the editor page from `useTrustCapabilities` and passed down,
 * so every gated affordance tells the same story. `locked` is authoritative:
 * it is true while capabilities are loading and when the fetch failed, because
 * an affordance that appears before its permission is known invites a
 * contributor into an action the server will refuse.
 */
export interface TrustGate {
  /** Resolved rung, or null while it is still unknown. */
  tier: TrustTier | null;
  /** True when creating new entities must be blocked. */
  locked: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Retry the capabilities fetch — offered on the error state. */
  onRetry?: () => void;
  /** Progress toward the trusted rung; null once there is nothing left to earn. */
  progress: { accepted: number; threshold: number; remaining: number } | null;
  /** Sign-in CTA — only meaningful for anonymous visitors. */
  onSignIn?: () => void;
}

/**
 * One short sentence for places with no room for the full explainer — a
 * disabled context-menu item, a button tooltip. Returns "" when nothing is
 * locked, so callers can use it as both the copy and the condition.
 */
export function mintingLockReason(gate: TrustGate | undefined | null): string {
  if (!gate || !gate.locked) return "";
  if (gate.isLoading) return "Checking what you can do here…";
  if (gate.isError) return "We couldn't check your contributor status, so creating new entries stays unavailable.";
  if (gate.tier === "anonymous") {
    return "Creating new entries is for trusted contributors. Sign in to start earning that trust — suggesting edits still works without an account.";
  }
  if (gate.progress) {
    const { remaining, threshold } = gate.progress;
    return remaining === 1
      ? "Creating new entries requires trusted status — 1 more accepted suggestion to go."
      : `Creating new entries requires trusted status — ${remaining} more accepted suggestions to go (${threshold} in total).`;
  }
  return "Creating new entries requires trusted status on this project.";
}

interface TrustExplainerPanelProps {
  gate: TrustGate;
  className?: string;
}

/**
 * The explanation itself, with no trigger of its own — for surfaces that are
 * already a panel or a dialog (nesting a popover inside a modal is a focus
 * trap fight nobody wins).
 */
export function TrustExplainerPanel({ gate, className }: TrustExplainerPanelProps) {
  if (gate.isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60",
          className,
        )}
      >
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
          Checking what you can do here…
        </p>
      </div>
    );
  }

  if (gate.isError) {
    return (
      <div
        className={cn(
          "rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20",
          className,
        )}
      >
        <p className="text-sm text-amber-800 dark:text-amber-300">
          We couldn&apos;t check your contributor status, so creating new entries stays
          unavailable for now. Suggesting edits to existing entries still works.
        </p>
        {gate.onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={gate.onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  const isAnonymous = gate.tier === "anonymous";

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
        How trust is earned
      </p>

      {isAnonymous ? (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Anyone can suggest edits to entries that already exist — no account needed.
            Creating brand-new entries is reserved for trusted contributors, so that new
            concepts always get a second pair of eyes.
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Sign in and your accepted suggestions start counting toward trusted status on
            this project.
          </p>
          {gate.onSignIn && (
            <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={gate.onSignIn}>
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Creating new entries is reserved for trusted contributors. Keep suggesting
            edits to existing entries — each one a reviewer accepts moves you up.
          </p>
          {gate.progress && (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {gate.progress.accepted} of {gate.progress.threshold} accepted
              </p>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                role="progressbar"
                aria-label="Progress toward trusted status"
                aria-valuenow={gate.progress.accepted}
                aria-valuemin={0}
                aria-valuemax={gate.progress.threshold}
              >
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{
                    width: `${gate.progress.threshold > 0
                      ? Math.min(100, (gate.progress.accepted / gate.progress.threshold) * 100)
                      : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {gate.progress.remaining === 1
                  ? "1 more accepted suggestion to go."
                  : `${gate.progress.remaining} more accepted suggestions to go.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface TrustExplainerProps {
  gate: TrustGate;
  /** Visible label on the trigger. Kept short — it sits next to a disabled button. */
  triggerLabel?: string;
  className?: string;
  align?: "left" | "right";
}

/**
 * "Why is this disabled?" — a disclosure button plus the explainer panel.
 *
 * Gating is an explained-disabled affordance, never a hidden one: a
 * contributor who cannot see the action cannot learn how to earn it. Renders
 * nothing when the gate is open, so callers can mount it unconditionally.
 */
export function TrustExplainer({
  gate,
  triggerLabel = "Why can't I add entries?",
  className,
  align = "left",
}: TrustExplainerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Click outside dismisses without stealing focus back.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", onPointerDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (!gate.locked) return null;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary-600 hover:text-primary-700 focus:outline-hidden focus:ring-2 focus:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {triggerLabel}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="How trust is earned"
          className={cn(
            "absolute z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <TrustExplainerPanel gate={gate} className="border-0 bg-transparent p-2 dark:bg-transparent" />
        </div>
      )}
    </div>
  );
}
