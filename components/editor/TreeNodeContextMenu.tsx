"use client";

import { Plus, Copy, Code, Trash2 } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { ClassTreeNode } from "@/lib/ontology/types";

interface TreeNodeContextMenuProps {
  node: ClassTreeNode;
  onAddChild?: (parentIri: string) => void;
  onCopyIri?: (iri: string) => void;
  onDelete?: (iri: string, label: string) => void;
  onViewInSource?: (iri: string) => void;
}

export function TreeNodeContextMenu({
  node,
  onAddChild,
  onCopyIri,
  onDelete,
  onViewInSource,
}: TreeNodeContextMenuProps) {
  const label = node.label || node.iri;

  return (
    <ContextMenuContent>
      {onAddChild && (
        <>
          <ContextMenuItem onSelect={() => onAddChild(node.iri)}>
            <Plus className="h-4 w-4" />
            Add Subclass
          </ContextMenuItem>
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
