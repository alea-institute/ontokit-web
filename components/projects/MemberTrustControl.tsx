"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { trustApi, type MemberTrust, type TrustOverride } from "@/lib/api/trust";
import { cn } from "@/lib/utils";

const OVERRIDE_OPTIONS: { value: TrustOverride; label: string; hint: string }[] = [
  {
    value: "granted",
    label: "Grant trusted",
    hint: "Full suggestion powers now, without waiting for the threshold",
  },
  {
    value: "refused",
    label: "Refuse trust",
    hint: "Never auto-promote this member, however many suggestions land",
  },
  {
    value: "revoked",
    label: "Revoke trust",
    hint: "Take trusted status away and keep it off",
  },
  {
    value: "none",
    label: "Leave it to the ladder",
    hint: "Clear the decision — auto-promotion applies again",
  },
];

const STATE_LABELS: Record<TrustOverride, string> = {
  none: "Earning trust",
  granted: "Trusted (granted)",
  refused: "Trust refused",
  revoked: "Trust revoked",
};

function deriveOptimisticTrust(
  current: MemberTrust,
  next: TrustOverride,
): Pick<MemberTrust, "is_trusted" | "tier"> {
  switch (next) {
    case "granted":
      return { is_trusted: true, tier: "trusted" };
    case "none":
      return { is_trusted: current.is_trusted, tier: current.tier };
    case "refused":
    case "revoked":
      return {
        is_trusted: false,
        tier: current.tier === "reviewer" ? "reviewer" : "untrusted",
      };
  }
}

interface MemberTrustControlProps {
  projectId: string;
  userId: string;
  /** Current grant state; null while the trust list is still loading. */
  trust: MemberTrust | null;
  token: string;
  /** Fired with the server's answer so the parent list can stay in step. */
  onChanged?: (next: MemberTrust) => void;
  disabled?: boolean;
}

/**
 * Grant, refuse, revoke, or clear a member's trusted status (R6, KTD1).
 *
 * An admin decision is sticky: auto-promotion may only move a member whose
 * override is "none", so "refused" and "revoked" survive any number of further
 * accepted suggestions. That is why the control offers an explicit "leave it
 * to the ladder" rather than treating the absence of a decision as one.
 *
 * The row updates optimistically and rolls back on failure — a privilege
 * change that silently did not happen is worse than a visible error.
 */
export function MemberTrustControl({
  projectId,
  userId,
  trust,
  token,
  onChanged,
  disabled = false,
}: MemberTrustControlProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TrustOverride | null>(null);
  const [optimistic, setOptimistic] = useState<MemberTrust | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optimisticBaseRef = useRef<MemberTrust | null>(null);

  const current = optimistic ?? trust;

  const close = useCallback(() => setOpen(false), []);

  // Keep the optimistic result only while the parent still exposes the exact
  // authoritative row it was based on. A cache refresh supplies a new row;
  // from then on that authoritative value wins, even when it contradicts the
  // mutation response.
  useEffect(() => {
    if (optimistic && trust !== optimisticBaseRef.current) {
      setOptimistic(null);
      optimisticBaseRef.current = null;
    }
  }, [optimistic, trust]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = setTimeout(() => document.addEventListener("mousedown", onPointerDown), 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, close]);

  const apply = useCallback(
    async (next: TrustOverride) => {
      if (!current) return;
      close();
      setError(null);
      setPending(next);

      const previous = optimistic;
      optimisticBaseRef.current = trust;
      // Optimistic: the row moves now, so the admin sees their decision land.
      setOptimistic({
        ...current,
        trust_override: next,
        ...deriveOptimisticTrust(current, next),
      });

      try {
        const updated = await trustApi.setMemberTrust(projectId, userId, next, token);
        setOptimistic(updated);
        onChanged?.(updated);
      } catch (err) {
        setOptimistic(previous);
        if (!previous) optimisticBaseRef.current = null;
        setError(err instanceof Error ? err.message : "Couldn't update trust");
      } finally {
        setPending(null);
      }
    },
    [current, optimistic, projectId, userId, trust, token, onChanged, close],
  );

  if (!current) return null;

  const isBusy = pending !== null;
  const stateLabel = STATE_LABELS[current.trust_override] ?? STATE_LABELS.none;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || isBusy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Trust status for this member: ${stateLabel}`}
        className={cn(
          "flex min-h-[36px] items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
          "focus:outline-hidden focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50",
          current.is_trusted
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
        )}
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{stateLabel}</span>
        {current.trust_override === "none" && (
          <span className="text-slate-400 dark:text-slate-500">
            · {current.accepted_count} accepted
          </span>
        )}
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Change trust status"
          className="absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {OVERRIDE_OPTIONS.map((option) => {
            const isCurrent = option.value === current.trust_override;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => apply(option.value)}
                disabled={isCurrent}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                  isCurrent
                    ? "cursor-default bg-slate-50 text-slate-400 dark:bg-slate-700/40 dark:text-slate-500"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
                )}
              >
                <span className="font-medium">
                  {option.label}
                  {isCurrent && " (current)"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
