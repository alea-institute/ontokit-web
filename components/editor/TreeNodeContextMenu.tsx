"use client";

import { createContext, useContext, useId } from "react";
import { Plus, Copy, Code, Trash2, Lock, Sparkles } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { useLLMGate } from "@/lib/hooks/useLLMGate";
import type { BulkExpansionTarget } from "@/lib/hooks/useBulkExpansion";
import type { SuggestionType } from "@/lib/api/generation";

export type OnClassSuggest = (iri: string, kind: Extract<SuggestionType, "children" | "siblings">) => void;

export const BulkExpansionMenuContext = createContext<{
  getTargets: (iri: string) => BulkExpansionTarget[];
  open: (iri: string, targets: BulkExpansionTarget[]) => void;
  lockedReason?: string;
} | null>(null);

export function suggestionLockReason(gate: ReturnType<typeof useLLMGate>): string | undefined {
  if (gate.canUseLLM) return undefined;
  if (gate.isAnonymous) return "Sign in to use AI suggestions.";
  if (!gate.hasRoleAccess) return "Your project role does not allow AI suggestions.";
  if (gate.budgetExhausted) return "This project's AI budget has been exhausted.";
  if (gate.notConfigured) return "Choose a generation model in project AI settings.";
  return "AI suggestions are currently unavailable.";
}

interface TreeNodeContextMenuProps {
  node: { iri: string; label: string; hasChildren?: boolean };
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
  onSuggest?: OnClassSuggest;
  suggestLockedReason?: string;
  siblingLockedReason?: string;
  /** Trust ladder (R8): creating entities is above this contributor's rung. */
  addChildLocked?: boolean;
  /** Plain-language reason, rendered under the disabled item (AE2). */
  addChildLockedReason?: string;
}

export function TreeNodeContextMenu({
  node,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
  onSuggest,
  suggestLockedReason,
  siblingLockedReason,
  addChildLocked = false,
  addChildLockedReason,
}: TreeNodeContextMenuProps) {
  const label = node.label || node.iri;
  const bulkExpansion = useContext(BulkExpansionMenuContext);
  const targets = bulkExpansion?.getTargets(node.iri) ?? [];
  const suggestionReasonId = useId();
  const bulkReasonId = useId();
  const noTargetsReason = node.hasChildren
    ? "Expand this class in the tree to choose its subclasses."
    : "This class has no subclasses.";
  const bulkOnlyReason = targets.length === 0 ? noTargetsReason : bulkExpansion?.lockedReason;
  const bulkLockedReason = suggestLockedReason || bulkOnlyReason;

  return (
    <ContextMenuContent>
      {onAddChild && (
        <>
          <ContextMenuItem
            disabled={addChildLocked}
            onSelect={() => onAddChild(node.iri)}
          >
            {addChildLocked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Subclass
          </ContextMenuItem>
          {addChildLocked && addChildLockedReason && (
            <ContextMenuLabel className="max-w-[220px] whitespace-normal font-normal leading-snug">
              {addChildLockedReason}
            </ContextMenuLabel>
          )}
          <ContextMenuSeparator />
        </>
      )}

      {onSuggest && (
        <>
          <ContextMenuItem disabled={!!suggestLockedReason} onSelect={() => onSuggest(node.iri, "children")}>
            {suggestLockedReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            Suggest Subclasses
          </ContextMenuItem>
          <ContextMenuItem disabled={!!(suggestLockedReason || siblingLockedReason)} onSelect={() => onSuggest(node.iri, "siblings")}>
            {suggestLockedReason || siblingLockedReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            Suggest Siblings
          </ContextMenuItem>
          {bulkExpansion && (
            <ContextMenuItem
              disabled={!!bulkLockedReason}
              aria-describedby={suggestLockedReason ? suggestionReasonId : bulkOnlyReason ? bulkReasonId : undefined}
              onSelect={() => bulkExpansion.open(node.iri, targets)}
            >
              {bulkLockedReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Suggest subclasses for each subclass…
            </ContextMenuItem>
          )}
          {(suggestLockedReason || siblingLockedReason) && (
            <ContextMenuLabel id={suggestionReasonId} className="max-w-[220px] whitespace-normal font-normal leading-snug">
              {suggestLockedReason || siblingLockedReason}
            </ContextMenuLabel>
          )}
          {bulkExpansion && !suggestLockedReason && bulkOnlyReason && (
            <ContextMenuLabel id={bulkReasonId} className="max-w-[220px] whitespace-normal font-normal leading-snug">
              {bulkOnlyReason}
            </ContextMenuLabel>
          )}
          <ContextMenuSeparator />
        </>
      )}

      {onCopyIri && (
        <ContextMenuItem onSelect={() => onCopyIri(node.iri)}>
          <Copy className="h-4 w-4" />
          Copy IRI
        </ContextMenuItem>
      )}

      {onViewInSource && (
        <ContextMenuItem onSelect={() => onViewInSource(node.iri)}>
          <Code className="h-4 w-4" />
          View in Source
        </ContextMenuItem>
      )}

      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            destructive
            onSelect={() => onDelete(node.iri, label)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
