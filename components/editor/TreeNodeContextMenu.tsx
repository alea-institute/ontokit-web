"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
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
import { projectOntologyApi } from "@/lib/api/client";
import { storeKey, suggestionBatchBusyReason, useSuggestionStore, type SuggestionScope } from "@/lib/stores/suggestionStore";

export type OnClassSuggest = (iri: string, kind: Extract<SuggestionType, "children" | "siblings">) => void;

export const BulkExpansionMenuContext = createContext<{
  getTargets: (iri: string) => BulkExpansionTarget[];
  open: (iri: string, targets: BulkExpansionTarget[]) => void;
  lockedReason?: string;
  scope?: SuggestionScope & { accessToken?: string };
} | null>(null);

export function suggestionLockReason(gate: ReturnType<typeof useLLMGate>): string | undefined {
  if (gate.canUseLLM) return undefined;
  if (gate.isAnonymous) return "Sign in to use AI suggestions.";
  if (!gate.hasRoleAccess) return "Your project role does not allow AI suggestions.";
  if (gate.budgetExhausted) {
    return "This project's AI spending limit has been reached. Ask a project admin to review it.";
  }
  if (gate.notConfigured) return "Choose a generation model in project AI settings.";
  return "AI suggestions are currently unavailable.";
}

export function siblingSuggestionLockReason(parentIris: string[]) {
  if (parentIris.length === 0) return "This class has no parent, so it has no siblings.";
  if (parentIris.length > 1) return "This class has multiple parents. Sibling suggestions require a single parent.";
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
        <ClassSuggestionMenuItems
          node={node}
          onSuggest={onSuggest}
          suggestLockedReason={suggestLockedReason}
          siblingLockedReason={siblingLockedReason}
        />
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


function ClassSuggestionMenuItems({ node, onSuggest, suggestLockedReason, siblingLockedReason }: Pick<
  TreeNodeContextMenuProps, "node" | "suggestLockedReason" | "siblingLockedReason"
> & { onSuggest: OnClassSuggest }) {
  const bulkExpansion = useContext(BulkExpansionMenuContext);
  const scope = bulkExpansion?.scope;
  const projectId = scope?.projectId;
  const branch = scope?.branch;
  const accessToken = scope?.accessToken;
  const [parents, setParents] = useState<{ key: string; reason?: string } | null>(null);
  const parentKey = JSON.stringify([projectId, branch, node.iri, accessToken]);
  useEffect(() => {
    if (!projectId || !accessToken || suggestLockedReason) return;
    let current = true;
    // The tree's visual depth does not describe the class's asserted parents.
    void projectOntologyApi.getClassDetail(projectId, node.iri, accessToken, branch).then(
      (detail) => {
        if (current) setParents({ key: parentKey, reason: siblingSuggestionLockReason(detail.parent_iris) });
      },
      () => {
        if (current) setParents({ key: parentKey, reason: "Could not check this class's parents. Reopen the menu to try again." });
      },
    );
    return () => { current = false; };
  }, [accessToken, branch, node.iri, parentKey, projectId, suggestLockedReason]);

  const childrenOperation = useSuggestionStore((state) => scope && state.batchOperations[storeKey(scope, node.iri, "children")]);
  const siblingsOperation = useSuggestionStore((state) => scope && state.batchOperations[storeKey(scope, node.iri, "siblings")]);
  const childrenReason = suggestLockedReason || suggestionBatchBusyReason(childrenOperation);
  const parentReason = scope
    ? parents?.key === parentKey ? parents.reason : "Checking this class's parents…"
    : siblingLockedReason;
  const siblingsReason = suggestLockedReason || suggestionBatchBusyReason(siblingsOperation) || parentReason;

  const targets = bulkExpansion?.getTargets(node.iri) ?? [];
  const noTargetsReason = node.hasChildren
    ? "Expand this class in the tree to choose its subclasses."
    : "This class has no subclasses.";
  const bulkReason = suggestLockedReason || (targets.length === 0 ? noTargetsReason : bulkExpansion?.lockedReason);
  const childrenReasonId = useId();
  const siblingsReasonId = useId();
  const bulkReasonId = useId();

  return (
    <>
      <ContextMenuItem disabled={!!childrenReason} aria-describedby={childrenReason ? childrenReasonId : undefined}
        onSelect={() => onSuggest(node.iri, "children")}>
        {childrenReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        Suggest Subclasses
      </ContextMenuItem>
      <ContextMenuItem disabled={!!siblingsReason}
        aria-describedby={siblingsReason ? (siblingsReason === childrenReason ? childrenReasonId : siblingsReasonId) : undefined}
        onSelect={() => onSuggest(node.iri, "siblings")}>
        {siblingsReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        Suggest Siblings
      </ContextMenuItem>
      {bulkExpansion && (
        <ContextMenuItem disabled={!!bulkReason}
          aria-describedby={bulkReason ? (bulkReason === childrenReason ? childrenReasonId : bulkReasonId) : undefined}
          onSelect={() => bulkExpansion.open(node.iri, targets)}>
          {bulkReason ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          Suggest subclasses for each subclass…
        </ContextMenuItem>
      )}
      {childrenReason && <MenuReason id={childrenReasonId}>{childrenReason}</MenuReason>}
      {siblingsReason && siblingsReason !== childrenReason && <MenuReason id={siblingsReasonId}>{siblingsReason}</MenuReason>}
      {bulkExpansion && bulkReason && bulkReason !== childrenReason && <MenuReason id={bulkReasonId}>{bulkReason}</MenuReason>}
      <ContextMenuSeparator />
    </>
  );
}

function MenuReason({ id, children }: { id: string; children: string }) {
  return <ContextMenuLabel id={id} className="max-w-[220px] whitespace-normal font-normal leading-snug">{children}</ContextMenuLabel>;
}
