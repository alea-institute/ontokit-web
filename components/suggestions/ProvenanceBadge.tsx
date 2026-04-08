import { Sparkles, Pencil, User } from "lucide-react";
import type { Provenance } from "@/lib/api/generation";
import { cn } from "@/lib/utils";

const PROVENANCE_CONFIG: Record<
  Provenance,
  { icon: typeof Sparkles; label: string; color: string }
> = {
  "llm-proposed": { icon: Sparkles, label: "LLM proposed", color: "text-amber-500" },
  "user-edited-from-llm": { icon: Pencil, label: "Edited", color: "text-blue-500" },
  "user-written": { icon: User, label: "Human", color: "text-slate-400 dark:text-slate-500" },
};

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

interface ProvenanceBadgeProps {
  provenance: Provenance;
  confidence: number | null;
}

export function ProvenanceBadge({ provenance, confidence }: ProvenanceBadgeProps) {
  const config = PROVENANCE_CONFIG[provenance];
  const Icon = config.icon;
  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  const ariaLabel =
    pct !== null ? `${config.label} — ${pct}% confidence` : config.label;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px]"
      aria-label={ariaLabel}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={cn("font-medium", config.color)}>{config.label}</span>
      {pct !== null ? (
        <span className={cn(confidenceColor(confidence!))}>{pct}%</span>
      ) : (
        <span className="text-slate-400">---</span>
      )}
    </span>
  );
}
