import { cn } from "@/lib/utils";
import type { TrustTier } from "@/lib/api/trust";

/**
 * The rung a submission came from, on the row that reviews it (R9).
 *
 * Provenance is meant to be self-evident: a reviewer should never have to ask
 * who a contributor is before judging their suggestion. The labels are written
 * for the reviewer's eyes, not the schema's — "untrusted" is a data value, not
 * something to say about a person.
 */
const TIER_STYLES: Record<TrustTier, { label: string; className: string; title: string }> = {
  anonymous: {
    label: "Anonymous",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    title: "Submitted without an account — never auto-merges",
  },
  untrusted: {
    label: "New contributor",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    title: "Signed in, not yet trusted on this project — never auto-merges",
  },
  trusted: {
    label: "Trusted",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    title: "Trusted contributor on this project",
  },
  reviewer: {
    label: "Reviewer",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    title: "Owner, admin or editor on this project",
  },
};

interface TierBadgeProps {
  tier?: TrustTier | null;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (!tier) return null;
  const style = TIER_STYLES[tier];
  if (!style) return null;

  return (
    <span
      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", style.className, className)}
      title={style.title}
    >
      {/* sr-only prefix: an aria-label on a role-less span is unreliably exposed */}
      <span className="sr-only">Submitter tier: </span>
      {style.label}
    </span>
  );
}
