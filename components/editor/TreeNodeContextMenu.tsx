"use client";

import { Plus, Copy, Code, Trash2, Lock } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
interface TreeNodeContextMenuProps {
  node: { iri: string; label: string };
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
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
